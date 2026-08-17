import { and, asc, eq, inArray, ne, notInArray } from "drizzle-orm";
import { data } from "react-router";
import { v7 as uuidv7 } from "uuid";

import { getTaskPeriod } from "~/domain/tasks/availability";
import { db } from "~/lib/db/client.server";
import {
  auditLogs,
  childProfiles,
  moneyTransactions,
  taskAssignments,
  taskCompletionRequests,
  tasks,
} from "~/lib/db/schema";
import { requireChildContext } from "~/services/children/child-auth.server";
import { requireFamilyParent } from "~/services/families/families.server";

export async function listFamilyTasks(userId: string, familyId: string) {
  const context = await requireFamilyParent(userId, familyId);
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      type: tasks.type,
      status: tasks.status,
      rewardCents: tasks.rewardCents,
    })
    .from(tasks)
    .where(and(eq(tasks.familyId, familyId), ne(tasks.status, "archived")))
    .orderBy(asc(tasks.createdAt));
  return { context, tasks: rows };
}

export async function getFamilyTask(userId: string, familyId: string, taskId: string) {
  const context = await requireFamilyParent(userId, familyId);
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.familyId, familyId), ne(tasks.status, "archived")),
  });
  if (!task) throw data("Tarea no encontrada.", { status: 404 });
  const assignments = await db
    .select({ childId: taskAssignments.childId })
    .from(taskAssignments)
    .where(
      and(
        eq(taskAssignments.taskId, taskId),
        eq(taskAssignments.familyId, familyId),
        eq(taskAssignments.status, "active"),
      ),
    );
  const children = await db
    .select({ id: childProfiles.id, alias: childProfiles.alias })
    .from(childProfiles)
    .where(and(eq(childProfiles.familyId, familyId), eq(childProfiles.status, "active")))
    .orderBy(asc(childProfiles.alias));
  return {
    context,
    task,
    assignedChildIds: assignments.map((assignment) => assignment.childId),
    children,
  };
}

export async function updateTask(input: Parameters<typeof createTask>[0] & { taskId: string }) {
  await getFamilyTask(input.userId, input.familyId, input.taskId);
  const children = await db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(
      and(
        eq(childProfiles.familyId, input.familyId),
        eq(childProfiles.status, "active"),
        inArray(childProfiles.id, input.childIds),
      ),
    );
  if (children.length !== new Set(input.childIds).size)
    throw data("Algún perfil no pertenece a esta familia.", { status: 404 });

  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({
        title: input.title,
        description: input.description || null,
        type: input.type,
        rewardCents: input.rewardCents,
        recurrenceUnit: input.type === "recurring" ? input.recurrenceUnit : null,
        recurrenceInterval: input.type === "recurring" ? (input.recurrenceInterval ?? 1) : null,
        recurrenceWeekday: input.type === "recurring" ? input.recurrenceWeekday : null,
        recurrenceMonthDay: input.type === "recurring" ? input.recurrenceMonthDay : null,
        openLimitCount: input.type === "open" ? input.openLimitCount : null,
        openLimitPeriod: input.type === "open" ? input.openLimitPeriod : null,
      })
      .where(and(eq(tasks.id, input.taskId), eq(tasks.familyId, input.familyId)));

    await tx
      .update(taskAssignments)
      .set({ status: "removed" })
      .where(
        and(
          eq(taskAssignments.taskId, input.taskId),
          eq(taskAssignments.familyId, input.familyId),
          notInArray(taskAssignments.childId, input.childIds),
        ),
      );
    for (const childId of input.childIds) {
      await tx
        .insert(taskAssignments)
        .values({ id: uuidv7(), familyId: input.familyId, taskId: input.taskId, childId })
        .onConflictDoUpdate({
          target: [taskAssignments.taskId, taskAssignments.childId],
          set: { status: "active", assignedAt: new Date() },
        });
    }
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId: input.familyId,
      actorType: "user",
      actorUserId: input.userId,
      action: "task.updated",
      targetType: "task",
      targetId: input.taskId,
      result: "success",
    });
  });
}

export async function archiveTask(userId: string, familyId: string, taskId: string) {
  await getFamilyTask(userId, familyId, taskId);
  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({ status: "archived" })
      .where(and(eq(tasks.id, taskId), eq(tasks.familyId, familyId)));
    await tx
      .update(taskAssignments)
      .set({ status: "removed" })
      .where(and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.familyId, familyId)));
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId,
      actorType: "user",
      actorUserId: userId,
      action: "task.archived",
      targetType: "task",
      targetId: taskId,
      result: "success",
    });
  });
}

export async function createTask(input: {
  userId: string;
  familyId: string;
  title: string;
  description?: string;
  type: "one_off" | "recurring" | "open";
  rewardCents: number;
  recurrenceUnit?: "daily" | "weekly" | "monthly";
  recurrenceInterval?: number;
  recurrenceWeekday?: number;
  recurrenceMonthDay?: number;
  openLimitCount?: number;
  openLimitPeriod?: "day" | "week" | "month";
  childIds: string[];
}) {
  await requireFamilyParent(input.userId, input.familyId);
  const children = await db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(
      and(
        eq(childProfiles.familyId, input.familyId),
        eq(childProfiles.status, "active"),
        inArray(childProfiles.id, input.childIds),
      ),
    );
  if (children.length !== new Set(input.childIds).size)
    throw data("Algún perfil no pertenece a esta familia.", { status: 404 });
  const taskId = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id: taskId,
      familyId: input.familyId,
      title: input.title,
      description: input.description || null,
      type: input.type,
      rewardCents: input.rewardCents,
      recurrenceUnit: input.type === "recurring" ? input.recurrenceUnit : null,
      recurrenceInterval: input.type === "recurring" ? (input.recurrenceInterval ?? 1) : null,
      recurrenceWeekday: input.type === "recurring" ? input.recurrenceWeekday : null,
      recurrenceMonthDay: input.type === "recurring" ? input.recurrenceMonthDay : null,
      openLimitCount: input.type === "open" ? input.openLimitCount : null,
      openLimitPeriod: input.type === "open" ? input.openLimitPeriod : null,
      createdByUserId: input.userId,
    });
    await tx.insert(taskAssignments).values(
      input.childIds.map((childId) => ({
        id: uuidv7(),
        familyId: input.familyId,
        taskId,
        childId,
      })),
    );
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId: input.familyId,
      actorType: "user",
      actorUserId: input.userId,
      action: "task.created",
      targetType: "task",
      targetId: taskId,
      result: "success",
    });
  });
  return taskId;
}

export async function listChildTasks(request: Request, now = new Date()) {
  const context = await requireChildContext(request);
  const rows = await db
    .select({
      assignmentId: taskAssignments.id,
      taskId: tasks.id,
      title: tasks.title,
      description: tasks.description,
      type: tasks.type,
      rewardCents: tasks.rewardCents,
      recurrenceUnit: tasks.recurrenceUnit,
      recurrenceInterval: tasks.recurrenceInterval,
      recurrenceWeekday: tasks.recurrenceWeekday,
      recurrenceMonthDay: tasks.recurrenceMonthDay,
      openLimitCount: tasks.openLimitCount,
      openLimitPeriod: tasks.openLimitPeriod,
      startsAt: tasks.startsAt,
      endsAt: tasks.endsAt,
    })
    .from(taskAssignments)
    .innerJoin(
      tasks,
      and(eq(taskAssignments.taskId, tasks.id), eq(taskAssignments.familyId, tasks.familyId)),
    )
    .where(
      and(
        eq(taskAssignments.childId, context.childId),
        eq(taskAssignments.familyId, context.familyId),
        eq(taskAssignments.status, "active"),
        eq(tasks.status, "active"),
      ),
    );
  const requests = await db
    .select({
      assignmentId: taskCompletionRequests.assignmentId,
      periodKey: taskCompletionRequests.periodKey,
      status: taskCompletionRequests.status,
    })
    .from(taskCompletionRequests)
    .where(
      and(
        eq(taskCompletionRequests.childId, context.childId),
        eq(taskCompletionRequests.familyId, context.familyId),
      ),
    );
  return {
    context,
    tasks: rows.flatMap((task) => {
      const period = getTaskPeriod(
        {
          type: task.type as "one_off" | "recurring" | "open",
          recurrenceUnit: task.recurrenceUnit as "daily" | "weekly" | "monthly" | null,
          recurrenceInterval: task.recurrenceInterval,
          recurrenceWeekday: task.recurrenceWeekday,
          recurrenceMonthDay: task.recurrenceMonthDay,
          openLimitPeriod: task.openLimitPeriod as "day" | "week" | "month" | null,
          startsAt: task.startsAt,
          endsAt: task.endsAt,
        },
        now,
      );
      if (!period) return [];
      const used = requests.filter(
        (entry) => entry.assignmentId === task.assignmentId && entry.periodKey === period.key,
      ).length;
      const limit = task.type === "open" ? (task.openLimitCount ?? 1) : 1;
      return used < limit ? [{ ...task, periodKey: period.key, occurrenceNumber: used + 1 }] : [];
    }),
  };
}

export async function requestTaskCompletion(
  request: Request,
  assignmentId: string,
  clientRequestId: string,
) {
  const context = await requireChildContext(request);
  const existing = await db.query.taskCompletionRequests.findFirst({
    where: and(
      eq(taskCompletionRequests.clientRequestId, clientRequestId),
      eq(taskCompletionRequests.familyId, context.familyId),
      eq(taskCompletionRequests.childId, context.childId),
    ),
  });
  if (existing) return existing.id;
  const available = await listChildTasks(request);
  const task = available.tasks.find((entry) => entry.assignmentId === assignmentId);
  if (!task) throw data("Esta tarea no está disponible.", { status: 409 });
  const id = uuidv7();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(taskCompletionRequests).values({
        id,
        familyId: context.familyId,
        taskId: task.taskId,
        assignmentId,
        childId: context.childId,
        periodKey: task.periodKey,
        occurrenceNumber: task.occurrenceNumber,
        clientRequestId,
        rewardCentsSnapshot: task.rewardCents,
      });
      await tx.insert(auditLogs).values({
        id: uuidv7(),
        familyId: context.familyId,
        actorType: "child",
        actorChildId: context.childId,
        action: "task.completion_requested",
        targetType: "task_completion_request",
        targetId: id,
        result: "success",
      });
    });
  } catch (error) {
    const repeated = await db.query.taskCompletionRequests.findFirst({
      where: eq(taskCompletionRequests.clientRequestId, clientRequestId),
    });
    if (repeated) return repeated.id;
    const refreshed = await listChildTasks(request);
    if (refreshed.tasks.some((entry) => entry.assignmentId === assignmentId)) {
      return requestTaskCompletion(request, assignmentId, clientRequestId);
    }
    throw error;
  }
  return id;
}

export async function listPendingRequests(userId: string, familyId: string) {
  const context = await requireFamilyParent(userId, familyId);
  const requests = await db
    .select({
      id: taskCompletionRequests.id,
      title: tasks.title,
      childAlias: childProfiles.alias,
      rewardCents: taskCompletionRequests.rewardCentsSnapshot,
      requestedAt: taskCompletionRequests.requestedAt,
    })
    .from(taskCompletionRequests)
    .innerJoin(
      tasks,
      and(
        eq(taskCompletionRequests.taskId, tasks.id),
        eq(taskCompletionRequests.familyId, tasks.familyId),
      ),
    )
    .innerJoin(
      childProfiles,
      and(
        eq(taskCompletionRequests.childId, childProfiles.id),
        eq(taskCompletionRequests.familyId, childProfiles.familyId),
      ),
    )
    .where(
      and(
        eq(taskCompletionRequests.familyId, familyId),
        eq(taskCompletionRequests.status, "pending_approval"),
      ),
    )
    .orderBy(asc(taskCompletionRequests.requestedAt));
  return { context, requests };
}

export async function reviewTaskRequest(input: {
  userId: string;
  familyId: string;
  requestId: string;
  decision: "approve" | "reject";
  rejectionReason?: string;
}) {
  await requireFamilyParent(input.userId, input.familyId);
  return db.transaction(async (tx) => {
    const current = await tx.query.taskCompletionRequests.findFirst({
      where: and(
        eq(taskCompletionRequests.id, input.requestId),
        eq(taskCompletionRequests.familyId, input.familyId),
      ),
    });
    if (!current) throw data("Solicitud no encontrada.", { status: 404 });
    if (current.status !== "pending_approval") return current.status;
    const status = input.decision === "approve" ? "approved" : "rejected";
    const changed = await tx
      .update(taskCompletionRequests)
      .set({
        status,
        reviewedAt: new Date(),
        reviewedByUserId: input.userId,
        rejectionReason: status === "rejected" ? input.rejectionReason || null : null,
      })
      .where(
        and(
          eq(taskCompletionRequests.id, input.requestId),
          eq(taskCompletionRequests.status, "pending_approval"),
        ),
      )
      .returning({ id: taskCompletionRequests.id });
    if (!changed.length) return status;
    if (status === "approved" && current.rewardCentsSnapshot > 0) {
      await tx
        .insert(moneyTransactions)
        .values({
          id: uuidv7(),
          familyId: input.familyId,
          childId: current.childId,
          amountCents: current.rewardCentsSnapshot,
          type: "task_reward",
          description: "Recompensa por tarea",
          createdByKind: "user",
          createdByUserId: input.userId,
          taskId: current.taskId,
          taskCompletionRequestId: current.id,
          idempotencyKey: `task-reward:${current.id}`,
          effectiveAt: new Date(),
        })
        .onConflictDoNothing({ target: moneyTransactions.idempotencyKey });
    }
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId: input.familyId,
      actorType: "user",
      actorUserId: input.userId,
      action: `task.request_${status}`,
      targetType: "task_completion_request",
      targetId: current.id,
      result: "success",
    });
    return status;
  });
}
