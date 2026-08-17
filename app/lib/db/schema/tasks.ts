import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { childProfiles } from "./children";
import { families } from "./families";
import { now, timestamp } from "./shared";

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade", onUpdate: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    status: text("status").notNull().default("active"),
    rewardCents: integer("reward_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    recurrenceUnit: text("recurrence_unit"),
    recurrenceInterval: integer("recurrence_interval"),
    recurrenceWeekday: integer("recurrence_weekday"),
    recurrenceMonthDay: integer("recurrence_month_day"),
    openLimitCount: integer("open_limit_count"),
    openLimitPeriod: text("open_limit_period"),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("tasks_type_check", sql`${table.type} IN ('one_off','recurring','open')`),
    check("tasks_status_check", sql`${table.status} IN ('active','paused','archived')`),
    check("tasks_reward_check", sql`${table.rewardCents} BETWEEN 0 AND 100000000`),
    check("tasks_currency_check", sql`${table.currency} = 'EUR'`),
    uniqueIndex("tasks_id_family_unique").on(table.id, table.familyId),
    index("tasks_family_status_idx").on(table.familyId, table.status),
  ],
);

export const taskAssignments = sqliteTable(
  "task_assignments",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull(),
    taskId: text("task_id").notNull(),
    childId: text("child_id").notNull(),
    status: text("status").notNull().default("active"),
    assignedAt: timestamp("assigned_at").notNull().default(now),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.taskId, table.familyId],
      foreignColumns: [tasks.id, tasks.familyId],
      name: "task_assignments_task_family_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.childId, table.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: "task_assignments_child_family_fk",
    }).onDelete("cascade"),
    check("task_assignments_status_check", sql`${table.status} IN ('active','paused','removed')`),
    uniqueIndex("task_assignments_task_child_unique").on(table.taskId, table.childId),
    uniqueIndex("task_assignments_id_family_unique").on(table.id, table.familyId),
    index("task_assignments_child_status_idx").on(table.childId, table.status),
  ],
);

export const taskCompletionRequests = sqliteTable(
  "task_completion_requests",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull(),
    taskId: text("task_id").notNull(),
    assignmentId: text("assignment_id").notNull(),
    childId: text("child_id").notNull(),
    periodKey: text("period_key").notNull(),
    occurrenceNumber: integer("occurrence_number").notNull().default(1),
    clientRequestId: text("client_request_id").notNull(),
    status: text("status").notNull().default("pending_approval"),
    rewardCentsSnapshot: integer("reward_cents_snapshot").notNull(),
    currency: text("currency").notNull().default("EUR"),
    requestedAt: timestamp("requested_at").notNull().default(now),
    reviewedAt: timestamp("reviewed_at"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.taskId, table.familyId],
      foreignColumns: [tasks.id, tasks.familyId],
      name: "completion_requests_task_family_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.assignmentId, table.familyId],
      foreignColumns: [taskAssignments.id, taskAssignments.familyId],
      name: "completion_requests_assignment_family_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.childId, table.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: "completion_requests_child_family_fk",
    }).onDelete("restrict"),
    check(
      "completion_requests_status_check",
      sql`${table.status} IN ('pending_approval','approved','rejected','cancelled')`,
    ),
    check(
      "completion_requests_reward_check",
      sql`${table.rewardCentsSnapshot} BETWEEN 0 AND 100000000`,
    ),
    uniqueIndex("completion_requests_client_unique").on(table.clientRequestId),
    uniqueIndex("completion_requests_occurrence_unique").on(
      table.taskId,
      table.childId,
      table.periodKey,
      table.occurrenceNumber,
    ),
    uniqueIndex("completion_requests_id_family_unique").on(table.id, table.familyId),
    index("completion_requests_family_status_idx").on(
      table.familyId,
      table.status,
      table.requestedAt,
    ),
    index("completion_requests_child_status_idx").on(
      table.childId,
      table.status,
      table.requestedAt,
    ),
  ],
);
