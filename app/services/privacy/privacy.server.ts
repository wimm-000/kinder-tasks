import { createHash, randomBytes } from "node:crypto";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { db } from "~/lib/db/client.server";
import {
  accountRecoveryTokens,
  allowanceRuns,
  allowanceSchedules,
  childDeviceAuthorizations,
  childSessions,
  childProfiles,
  families,
  familyMembers,
  moneyTransactions,
  session,
  taskAssignments,
  taskCompletionRequests,
  tasks,
  user,
  userProfiles,
} from "~/lib/db/schema";
import { getServerEnv } from "~/lib/env.server";
import { writeAuditLog } from "~/services/audit/audit.server";
import { sendEmail } from "~/services/email/email.server";

const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestAccountDeletion(input: {
  userId: string;
  email: string;
  request: Request;
}) {
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + DELETION_GRACE_PERIOD_MS);
  const token = randomBytes(32).toString("base64url");

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(userProfiles)
      .set({ status: "pending_deletion", deletionRequestedAt: now, purgeAfter })
      .where(and(eq(userProfiles.userId, input.userId), eq(userProfiles.status, "active")))
      .returning({ id: userProfiles.userId });
    if (updated.length === 0) throw new Response("Cuenta no disponible", { status: 409 });

    await tx.insert(accountRecoveryTokens).values({
      id: uuidv7(),
      userId: input.userId,
      tokenHash: hashToken(token),
      expiresAt: purgeAfter,
    });
    await tx.delete(session).where(eq(session.userId, input.userId));

    const memberships = await tx
      .select({ familyId: familyMembers.familyId })
      .from(familyMembers)
      .where(and(eq(familyMembers.userId, input.userId), eq(familyMembers.status, "active")));
    for (const membership of memberships) {
      const [otherAdults] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, membership.familyId),
            eq(familyMembers.status, "active"),
            ne(familyMembers.userId, input.userId),
          ),
        );
      if (Number(otherAdults?.count ?? 0) === 0) {
        await tx
          .update(families)
          .set({ status: "pending_deletion", deletionRequestedAt: now, purgeAfter })
          .where(and(eq(families.id, membership.familyId), eq(families.status, "active")));
      }
    }
  });

  await Promise.all([
    writeAuditLog({
      actor: { type: "user", userId: input.userId },
      action: "privacy.account_deletion_requested",
      targetType: "user",
      targetId: input.userId,
      result: "success",
      metadata: { purgeAfter: purgeAfter.toISOString() },
      request: input.request,
    }),
    sendEmail({
      to: input.email,
      subject: "Solicitud de eliminación de Kinder Tasks",
      text: `Tu cuenta se eliminará después del ${purgeAfter.toLocaleDateString("es")}. Puedes recuperarla antes de esa fecha: ${getServerEnv().APP_URL}/recover-account?token=${token}`,
    }),
  ]);
}

export async function recoverAccount(token: string): Promise<boolean> {
  const now = new Date();
  return db.transaction(async (tx) => {
    const recovery = await tx.query.accountRecoveryTokens.findFirst({
      where: and(
        eq(accountRecoveryTokens.tokenHash, hashToken(token)),
        sql`${accountRecoveryTokens.usedAt} is null`,
        sql`${accountRecoveryTokens.expiresAt} > ${now}`,
      ),
    });
    if (!recovery) return false;

    const updated = await tx
      .update(userProfiles)
      .set({ status: "active", deletionRequestedAt: null, purgeAfter: null })
      .where(
        and(eq(userProfiles.userId, recovery.userId), eq(userProfiles.status, "pending_deletion")),
      )
      .returning({ id: userProfiles.userId });
    if (updated.length === 0) return false;

    await tx
      .update(accountRecoveryTokens)
      .set({ usedAt: now })
      .where(eq(accountRecoveryTokens.id, recovery.id));
    const memberships = await tx
      .select({ familyId: familyMembers.familyId })
      .from(familyMembers)
      .where(and(eq(familyMembers.userId, recovery.userId), eq(familyMembers.status, "active")));
    if (memberships.length > 0) {
      await tx
        .update(families)
        .set({ status: "active", deletionRequestedAt: null, purgeAfter: null })
        .where(
          and(
            inArray(
              families.id,
              memberships.map(({ familyId }) => familyId),
            ),
            eq(families.status, "pending_deletion"),
            sql`${families.purgeAfter} > ${now}`,
          ),
        );
    }
    return true;
  });
}

export async function exportAccountData(userId: string, request: Request) {
  const membershipRows = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId));
  const familyIds = membershipRows.map(({ familyId }) => familyId);
  const familyFilter = familyIds.length ? inArray(families.id, familyIds) : sql`0`;
  const childFilter = familyIds.length ? inArray(childProfiles.familyId, familyIds) : sql`0`;
  const taskFilter = familyIds.length ? inArray(tasks.familyId, familyIds) : sql`0`;

  const [
    accountData,
    profile,
    familyData,
    members,
    children,
    taskData,
    assignments,
    requests,
    schedules,
    runs,
    transactions,
  ] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true, name: true, email: true, image: true, createdAt: true, updatedAt: true },
    }),
    db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
      columns: { locale: true, status: true, createdAt: true, updatedAt: true },
    }),
    db.select().from(families).where(familyFilter),
    familyIds.length
      ? db
          .select({
            familyId: familyMembers.familyId,
            name: user.name,
            email: user.email,
            role: familyMembers.role,
            status: familyMembers.status,
            joinedAt: familyMembers.joinedAt,
          })
          .from(familyMembers)
          .innerJoin(user, eq(user.id, familyMembers.userId))
          .where(inArray(familyMembers.familyId, familyIds))
      : [],
    db.select().from(childProfiles).where(childFilter),
    db.select().from(tasks).where(taskFilter),
    familyIds.length
      ? db.select().from(taskAssignments).where(inArray(taskAssignments.familyId, familyIds))
      : [],
    familyIds.length
      ? db
          .select()
          .from(taskCompletionRequests)
          .where(inArray(taskCompletionRequests.familyId, familyIds))
      : [],
    familyIds.length
      ? db.select().from(allowanceSchedules).where(inArray(allowanceSchedules.familyId, familyIds))
      : [],
    familyIds.length
      ? db.select().from(allowanceRuns).where(inArray(allowanceRuns.familyId, familyIds))
      : [],
    familyIds.length
      ? db.select().from(moneyTransactions).where(inArray(moneyTransactions.familyId, familyIds))
      : [],
  ]);

  await writeAuditLog({
    actor: { type: "user", userId },
    action: "privacy.data_exported",
    targetType: "user",
    targetId: userId,
    result: "success",
    request,
  });

  return {
    exportedAt: new Date().toISOString(),
    account: accountData,
    profile,
    families: familyData,
    members,
    children,
    tasks: taskData,
    taskAssignments: assignments,
    taskCompletionRequests: requests,
    allowanceSchedules: schedules,
    allowanceRuns: runs,
    moneyTransactions: transactions,
  };
}

export async function getFamilyDeletionState(userId: string, familyId: string) {
  const [family] = await db
    .select({
      id: families.id,
      name: families.name,
      status: families.status,
      purgeAfter: families.purgeAfter,
    })
    .from(familyMembers)
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId),
        eq(familyMembers.status, "active"),
      ),
    )
    .limit(1);
  if (!family || !["active", "pending_deletion"].includes(family.status)) {
    throw new Response("Familia no encontrada", { status: 404 });
  }
  return family;
}

export async function requestFamilyDeletion(input: {
  userId: string;
  familyId: string;
  request: Request;
}) {
  await getFamilyDeletionState(input.userId, input.familyId);
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + DELETION_GRACE_PERIOD_MS);
  const updated = await db
    .update(families)
    .set({ status: "pending_deletion", deletionRequestedAt: now, purgeAfter })
    .where(and(eq(families.id, input.familyId), eq(families.status, "active")))
    .returning({ id: families.id });
  if (updated.length === 0) throw new Response("Familia no disponible", { status: 409 });

  await Promise.all([
    db
      .update(childSessions)
      .set({ revokedAt: now })
      .where(
        and(eq(childSessions.familyId, input.familyId), sql`${childSessions.revokedAt} is null`),
      ),
    db
      .update(childDeviceAuthorizations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(childDeviceAuthorizations.familyId, input.familyId),
          sql`${childDeviceAuthorizations.revokedAt} is null`,
        ),
      ),
    writeAuditLog({
      actor: { type: "user", userId: input.userId },
      action: "privacy.family_deletion_requested",
      targetType: "family",
      targetId: input.familyId,
      familyId: input.familyId,
      result: "success",
      metadata: { purgeAfter: purgeAfter.toISOString() },
      request: input.request,
    }),
  ]);
}

export async function recoverFamily(input: { userId: string; familyId: string; request: Request }) {
  await getFamilyDeletionState(input.userId, input.familyId);
  const updated = await db
    .update(families)
    .set({ status: "active", deletionRequestedAt: null, purgeAfter: null })
    .where(
      and(
        eq(families.id, input.familyId),
        eq(families.status, "pending_deletion"),
        sql`${families.purgeAfter} > ${new Date()}`,
      ),
    )
    .returning({ id: families.id });
  if (updated.length === 0)
    throw new Response("El periodo de recuperación ha terminado", { status: 409 });
  await writeAuditLog({
    actor: { type: "user", userId: input.userId },
    action: "privacy.family_recovered",
    targetType: "family",
    targetId: input.familyId,
    familyId: input.familyId,
    result: "success",
    request: input.request,
  });
}
