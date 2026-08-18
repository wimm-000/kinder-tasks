import { and, eq, inArray, lt, lte, or, sql } from "drizzle-orm";

import { db } from "~/lib/db/client.server";
import {
  account,
  accountRecoveryTokens,
  allowanceRuns,
  allowanceSchedules,
  auditLogs,
  childSessions,
  families,
  familyInvitations,
  familyMembers,
  moneyTransactions,
  rateLimit,
  rateLimitBuckets,
  session,
  taskAssignments,
  taskCompletionRequests,
  tasks,
  user,
  userProfiles,
  verification,
} from "~/lib/db/schema";
import { writeAuditLog } from "~/services/audit/audit.server";

const DAY = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  familiesPurged: number;
  usersAnonymized: number;
}

export async function runRetention(now = new Date()): Promise<RetentionResult> {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY);
  const twelveMonthsAgo = new Date(now.getTime() - 365 * DAY);

  await Promise.all([
    db
      .update(familyInvitations)
      .set({ status: "expired" })
      .where(and(eq(familyInvitations.status, "pending"), lt(familyInvitations.expiresAt, now))),
    db
      .delete(familyInvitations)
      .where(
        and(
          inArray(familyInvitations.status, ["expired", "revoked"]),
          lt(familyInvitations.updatedAt, ninetyDaysAgo),
        ),
      ),
    db
      .delete(childSessions)
      .where(
        or(
          lt(childSessions.expiresAt, thirtyDaysAgo),
          and(
            sql`${childSessions.revokedAt} is not null`,
            lt(childSessions.revokedAt, thirtyDaysAgo),
          ),
        ),
      ),
    db.delete(session).where(lt(session.expiresAt, thirtyDaysAgo)),
    db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.expiresAt, now)),
    db.delete(rateLimit).where(lt(rateLimit.lastRequest, thirtyDaysAgo.getTime())),
    db.delete(verification).where(lt(verification.expiresAt, now)),
    db.delete(auditLogs).where(lt(auditLogs.createdAt, twelveMonthsAgo)),
    db
      .delete(accountRecoveryTokens)
      .where(
        or(
          lt(accountRecoveryTokens.expiresAt, now),
          and(
            sql`${accountRecoveryTokens.usedAt} is not null`,
            lt(accountRecoveryTokens.usedAt, thirtyDaysAgo),
          ),
        ),
      ),
  ]);

  const dueFamilies = await db
    .select({ id: families.id })
    .from(families)
    .where(
      and(
        eq(families.status, "pending_deletion"),
        sql`${families.purgeAfter} is not null`,
        lte(families.purgeAfter, now),
      ),
    );

  for (const { id } of dueFamilies) {
    await db.transaction(async (tx) => {
      await tx.delete(taskCompletionRequests).where(eq(taskCompletionRequests.familyId, id));
      await tx.delete(allowanceRuns).where(eq(allowanceRuns.familyId, id));
      await tx.delete(moneyTransactions).where(eq(moneyTransactions.familyId, id));
      await tx.delete(allowanceSchedules).where(eq(allowanceSchedules.familyId, id));
      await tx.delete(taskAssignments).where(eq(taskAssignments.familyId, id));
      await tx.delete(tasks).where(eq(tasks.familyId, id));
      await tx.delete(families).where(eq(families.id, id));
    });
  }

  const dueUsers = await db
    .select({ id: userProfiles.userId })
    .from(userProfiles)
    .where(
      and(
        eq(userProfiles.status, "pending_deletion"),
        sql`${userProfiles.purgeAfter} is not null`,
        lte(userProfiles.purgeAfter, now),
      ),
    );

  for (const { id } of dueUsers) {
    await db.transaction(async (tx) => {
      await tx.delete(account).where(eq(account.userId, id));
      await tx.delete(session).where(eq(session.userId, id));
      await tx.delete(accountRecoveryTokens).where(eq(accountRecoveryTokens.userId, id));
      await tx
        .update(familyInvitations)
        .set({ status: "revoked", revokedAt: now })
        .where(
          and(eq(familyInvitations.invitedByUserId, id), eq(familyInvitations.status, "pending")),
        );
      await tx.delete(familyMembers).where(eq(familyMembers.userId, id));
      await tx
        .update(user)
        .set({
          name: "Usuario eliminado",
          email: `deleted-${id}@invalid.local`,
          image: null,
          emailVerified: false,
        })
        .where(eq(user.id, id));
      await tx
        .update(userProfiles)
        .set({
          status: "deleted",
          globalRole: "user",
          blockedAt: null,
          blockedReason: null,
          deletionRequestedAt: null,
          purgeAfter: null,
          deletedAt: now,
        })
        .where(eq(userProfiles.userId, id));
    });
  }

  await writeAuditLog({
    actor: { type: "system" },
    action: "privacy.retention_completed",
    targetType: "retention_job",
    result: "success",
    metadata: {
      familiesPurged: dueFamilies.length,
      usersAnonymized: dueUsers.length,
    },
  });

  return { familiesPurged: dueFamilies.length, usersAnonymized: dueUsers.length };
}
