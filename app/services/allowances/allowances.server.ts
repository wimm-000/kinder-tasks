import { and, asc, eq, lte } from "drizzle-orm";
import { data } from "react-router";
import { v7 as uuidv7 } from "uuid";

import {
  allowancePeriodKey,
  dateToLocalDate,
  dueDateToDate,
  firstDueDate,
  nextDueDate,
  type AllowanceCalendar,
} from "~/domain/allowances/calendar";
import { db } from "~/lib/db/client.server";
import {
  allowanceRuns,
  allowanceSchedules,
  auditLogs,
  childProfiles,
  families,
  moneyTransactions,
} from "~/lib/db/schema";
import { getChild } from "~/services/children/children.server";

export async function getAllowance(userId: string, familyId: string, childId: string) {
  const child = await getChild(userId, familyId, childId);
  const schedule = await db.query.allowanceSchedules.findFirst({
    where: and(eq(allowanceSchedules.familyId, familyId), eq(allowanceSchedules.childId, childId)),
    orderBy: [asc(allowanceSchedules.createdAt)],
  });
  return { ...child, schedule: schedule ?? null };
}

export async function saveAllowance(input: {
  userId: string;
  familyId: string;
  childId: string;
  amountCents: number;
  frequency: "weekly" | "monthly";
  weekday?: number;
  monthDay?: number;
  startDate: string;
}) {
  await getChild(input.userId, input.familyId, input.childId);
  const config =
    input.frequency === "weekly"
      ? { frequency: "weekly" as const, weekday: input.weekday! }
      : { frequency: "monthly" as const, monthDay: input.monthDay! };
  const nextRunAt = dueDateToDate(firstDueDate(config, input.startDate));
  const existing = await db.query.allowanceSchedules.findFirst({
    where: and(
      eq(allowanceSchedules.familyId, input.familyId),
      eq(allowanceSchedules.childId, input.childId),
    ),
  });
  await db.transaction(async (tx) => {
    const id = existing?.id ?? uuidv7();
    if (existing)
      await tx
        .update(allowanceSchedules)
        .set({
          amountCents: input.amountCents,
          frequency: input.frequency,
          weekday: input.frequency === "weekly" ? input.weekday : null,
          monthDay: input.frequency === "monthly" ? input.monthDay : null,
          startDate: input.startDate,
          nextRunAt,
          status: "active",
        })
        .where(and(eq(allowanceSchedules.id, id), eq(allowanceSchedules.familyId, input.familyId)));
    else
      await tx.insert(allowanceSchedules).values({
        id,
        familyId: input.familyId,
        childId: input.childId,
        amountCents: input.amountCents,
        frequency: input.frequency,
        weekday: input.frequency === "weekly" ? input.weekday : null,
        monthDay: input.frequency === "monthly" ? input.monthDay : null,
        startDate: input.startDate,
        nextRunAt,
      });
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId: input.familyId,
      actorType: "user",
      actorUserId: input.userId,
      action: existing ? "allowance.schedule.updated" : "allowance.schedule.created",
      targetType: "allowance_schedule",
      targetId: id,
      result: "success",
    });
  });
}

export async function setAllowancePaused(
  userId: string,
  familyId: string,
  childId: string,
  paused: boolean,
) {
  const current = await getAllowance(userId, familyId, childId);
  if (!current.schedule) throw data("No hay una paga configurada.", { status: 404 });
  let nextRunAt = current.schedule.nextRunAt;
  if (!paused) {
    const config = scheduleConfig(current.schedule);
    const today = dateToLocalDate(new Date()).toString();
    nextRunAt = dueDateToDate(firstDueDate(config, today));
  }
  await db
    .update(allowanceSchedules)
    .set({ status: paused ? "paused" : "active", nextRunAt })
    .where(
      and(
        eq(allowanceSchedules.id, current.schedule.id),
        eq(allowanceSchedules.familyId, familyId),
      ),
    );
}

function scheduleConfig(schedule: {
  frequency: string;
  weekday: number | null;
  monthDay: number | null;
}): AllowanceCalendar {
  return schedule.frequency === "weekly"
    ? { frequency: "weekly", weekday: schedule.weekday! }
    : { frequency: "monthly", monthDay: schedule.monthDay! };
}

export async function processOneDueAllowance(now = new Date()) {
  const [due] = await db
    .select({ id: allowanceSchedules.id })
    .from(allowanceSchedules)
    .innerJoin(
      childProfiles,
      and(
        eq(allowanceSchedules.childId, childProfiles.id),
        eq(allowanceSchedules.familyId, childProfiles.familyId),
      ),
    )
    .innerJoin(families, eq(allowanceSchedules.familyId, families.id))
    .where(
      and(
        eq(allowanceSchedules.status, "active"),
        lte(allowanceSchedules.nextRunAt, now),
        eq(childProfiles.status, "active"),
        eq(families.status, "active"),
      ),
    )
    .orderBy(asc(allowanceSchedules.nextRunAt))
    .limit(1);
  if (!due) return false;
  return db.transaction(async (tx) => {
    const schedule = await tx.query.allowanceSchedules.findFirst({
      where: and(
        eq(allowanceSchedules.id, due.id),
        eq(allowanceSchedules.status, "active"),
        lte(allowanceSchedules.nextRunAt, now),
      ),
    });
    if (!schedule) return false;
    const localDue = dateToLocalDate(schedule.nextRunAt, schedule.timezone);
    const periodKey = allowancePeriodKey(schedule.frequency as "weekly" | "monthly", localDue);
    const runId = uuidv7();
    const claimed = await tx
      .insert(allowanceRuns)
      .values({
        id: runId,
        familyId: schedule.familyId,
        allowanceScheduleId: schedule.id,
        periodKey,
        dueAt: schedule.nextRunAt,
        amountCents: schedule.amountCents,
      })
      .onConflictDoNothing({ target: [allowanceRuns.allowanceScheduleId, allowanceRuns.periodKey] })
      .returning({ id: allowanceRuns.id });
    const next = dueDateToDate(
      nextDueDate(scheduleConfig(schedule), localDue.toString()),
      schedule.timezone,
    );
    if (!claimed.length) {
      await tx
        .update(allowanceSchedules)
        .set({ nextRunAt: next })
        .where(
          and(
            eq(allowanceSchedules.id, schedule.id),
            eq(allowanceSchedules.nextRunAt, schedule.nextRunAt),
          ),
        );
      return true;
    }
    const transactionId = uuidv7();
    await tx.insert(moneyTransactions).values({
      id: transactionId,
      familyId: schedule.familyId,
      childId: schedule.childId,
      amountCents: schedule.amountCents,
      type: "allowance",
      description: "Paga periódica",
      createdByKind: "system",
      allowanceScheduleId: schedule.id,
      idempotencyKey: `allowance:${schedule.id}:${periodKey}`,
      effectiveAt: schedule.nextRunAt,
    });
    await tx
      .update(allowanceRuns)
      .set({ status: "completed", moneyTransactionId: transactionId })
      .where(eq(allowanceRuns.id, runId));
    await tx
      .update(allowanceSchedules)
      .set({ lastRunAt: schedule.nextRunAt, nextRunAt: next })
      .where(eq(allowanceSchedules.id, schedule.id));
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId: schedule.familyId,
      actorType: "system",
      action: "allowance.processed",
      targetType: "allowance_run",
      targetId: runId,
      result: "success",
    });
    return true;
  });
}

export async function processDueAllowances(limit = 50, budgetMs = 24_000) {
  const started = Date.now();
  let completed = 0;
  while (completed < limit && Date.now() - started < budgetMs) {
    if (!(await processOneDueAllowance())) break;
    completed += 1;
  }
  return { completed, elapsedMs: Date.now() - started };
}
