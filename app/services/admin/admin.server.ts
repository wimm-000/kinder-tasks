import { and, desc, eq, like, or, sql } from "drizzle-orm";

import { db } from "~/lib/db/client.server";
import {
  auditLogs,
  childDeviceAuthorizations,
  childSessions,
  families,
  familyMembers,
  session,
  user,
  userProfiles,
} from "~/lib/db/schema";
import { writeAuditLog } from "~/services/audit/audit.server";

const RESULT_LIMIT = 50;

export async function getAdminOverview(search: string) {
  const normalizedSearch = search.trim().slice(0, 100);
  const pattern = `%${normalizedSearch}%`;
  const userFilter = normalizedSearch
    ? or(like(user.name, pattern), like(user.email, pattern))
    : undefined;
  const familyFilter = normalizedSearch ? like(families.name, pattern) : undefined;

  const [users, familyList, events] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        role: userProfiles.globalRole,
        status: userProfiles.status,
        createdAt: user.createdAt,
        familyCount: sql<number>`(
          select count(*) from ${familyMembers}
          where ${familyMembers.userId} = ${user.id}
        )`,
      })
      .from(user)
      .innerJoin(userProfiles, eq(userProfiles.userId, user.id))
      .where(userFilter)
      .orderBy(desc(user.createdAt))
      .limit(RESULT_LIMIT),
    db
      .select({
        id: families.id,
        name: families.name,
        status: families.status,
        timezone: families.timezone,
        createdAt: families.createdAt,
        memberCount: sql<number>`(
          select count(*) from ${familyMembers}
          where ${familyMembers.familyId} = ${families.id}
        )`,
      })
      .from(families)
      .where(familyFilter)
      .orderBy(desc(families.createdAt))
      .limit(RESULT_LIMIT),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorType: auditLogs.actorType,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        result: auditLogs.result,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(RESULT_LIMIT),
  ]);

  return { users, families: familyList, events };
}

export async function setUserBlocked(input: {
  actorUserId: string;
  targetUserId: string;
  blocked: boolean;
  reason?: string;
  request: Request;
}) {
  if (input.actorUserId === input.targetUserId) {
    throw new Response("No puedes bloquear tu propia cuenta", { status: 400 });
  }

  const now = new Date();
  const updated = await db
    .update(userProfiles)
    .set(
      input.blocked
        ? { status: "blocked", blockedAt: now, blockedReason: input.reason?.slice(0, 300) }
        : { status: "active", blockedAt: null, blockedReason: null },
    )
    .where(
      and(
        eq(userProfiles.userId, input.targetUserId),
        eq(userProfiles.status, input.blocked ? "active" : "blocked"),
      ),
    )
    .returning({ id: userProfiles.userId });

  if (updated.length === 0) throw new Response("Usuario no disponible", { status: 409 });
  if (input.blocked) await db.delete(session).where(eq(session.userId, input.targetUserId));

  await writeAuditLog({
    actor: { type: "superadmin", userId: input.actorUserId },
    action: input.blocked ? "admin.user.blocked" : "admin.user.unblocked",
    targetType: "user",
    targetId: input.targetUserId,
    result: "success",
    metadata: { reason: input.reason?.slice(0, 300) ?? null },
    request: input.request,
  });
}

export async function setFamilyDisabled(input: {
  actorUserId: string;
  familyId: string;
  disabled: boolean;
  reason?: string;
  request: Request;
}) {
  const now = new Date();
  const updated = await db
    .update(families)
    .set(
      input.disabled
        ? { status: "disabled", disabledAt: now, disabledReason: input.reason?.slice(0, 300) }
        : { status: "active", disabledAt: null, disabledReason: null },
    )
    .where(
      and(
        eq(families.id, input.familyId),
        eq(families.status, input.disabled ? "active" : "disabled"),
      ),
    )
    .returning({ id: families.id });

  if (updated.length === 0) throw new Response("Familia no disponible", { status: 409 });
  if (input.disabled) {
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
    ]);
  }

  await writeAuditLog({
    actor: { type: "superadmin", userId: input.actorUserId },
    action: input.disabled ? "admin.family.disabled" : "admin.family.enabled",
    targetType: "family",
    targetId: input.familyId,
    familyId: input.familyId,
    result: "success",
    metadata: { reason: input.reason?.slice(0, 300) ?? null },
    request: input.request,
  });
}
