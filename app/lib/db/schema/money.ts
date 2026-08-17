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

export const allowanceSchedules = sqliteTable(
  "allowance_schedules",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade", onUpdate: "cascade" }),
    childId: text("child_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    frequency: text("frequency").notNull(),
    weekday: integer("weekday"),
    monthDay: integer("month_day"),
    timezone: text("timezone").notNull().default("Europe/Madrid"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    nextRunAt: timestamp("next_run_at").notNull(),
    lastRunAt: timestamp("last_run_at"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.childId, table.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: "allowance_schedules_child_family_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    check("allowance_schedules_amount_check", sql`${table.amountCents} BETWEEN 1 AND 100000000`),
    check("allowance_schedules_currency_check", sql`${table.currency} = 'EUR'`),
    check("allowance_schedules_frequency_check", sql`${table.frequency} IN ('weekly', 'monthly')`),
    check(
      "allowance_schedules_period_check",
      sql`(${table.frequency} = 'weekly' AND ${table.weekday} BETWEEN 1 AND 7 AND ${table.monthDay} IS NULL) OR (${table.frequency} = 'monthly' AND ${table.monthDay} BETWEEN 1 AND 31 AND ${table.weekday} IS NULL)`,
    ),
    check(
      "allowance_schedules_status_check",
      sql`${table.status} IN ('active', 'paused', 'ended')`,
    ),
    uniqueIndex("allowance_schedules_id_family_unique").on(table.id, table.familyId),
    uniqueIndex("allowance_schedules_active_child_unique")
      .on(table.childId)
      .where(sql`${table.status} = 'active'`),
    index("allowance_schedules_due_idx").on(table.status, table.nextRunAt),
    index("allowance_schedules_family_child_idx").on(table.familyId, table.childId),
  ],
);

export const moneyTransactions = sqliteTable(
  "money_transactions",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade", onUpdate: "cascade" }),
    childId: text("child_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    type: text("type").notNull(),
    description: text("description").notNull(),
    createdByKind: text("created_by_kind").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "restrict" }),
    taskId: text("task_id"),
    taskCompletionRequestId: text("task_completion_request_id"),
    allowanceScheduleId: text("allowance_schedule_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    effectiveAt: timestamp("effective_at").notNull(),
    createdAt: timestamp("created_at").notNull().default(now),
  },
  (table) => [
    foreignKey({
      columns: [table.childId, table.familyId],
      foreignColumns: [childProfiles.id, childProfiles.familyId],
      name: "money_transactions_child_family_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.allowanceScheduleId, table.familyId],
      foreignColumns: [allowanceSchedules.id, allowanceSchedules.familyId],
      name: "money_transactions_schedule_family_fk",
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    check(
      "money_transactions_amount_check",
      sql`${table.amountCents} BETWEEN -100000000 AND 100000000 AND ${table.amountCents} != 0`,
    ),
    check("money_transactions_currency_check", sql`${table.currency} = 'EUR'`),
    check(
      "money_transactions_type_check",
      sql`${table.type} IN ('allowance', 'task_reward', 'withdrawal', 'correction_credit', 'correction_debit')`,
    ),
    check(
      "money_transactions_sign_check",
      sql`(${table.type} IN ('allowance', 'task_reward', 'correction_credit') AND ${table.amountCents} > 0) OR (${table.type} IN ('withdrawal', 'correction_debit') AND ${table.amountCents} < 0)`,
    ),
    check(
      "money_transactions_creator_check",
      sql`(${table.createdByKind} = 'user' AND ${table.createdByUserId} IS NOT NULL) OR (${table.createdByKind} = 'system' AND ${table.createdByUserId} IS NULL)`,
    ),
    uniqueIndex("money_transactions_id_family_unique").on(table.id, table.familyId),
    uniqueIndex("money_transactions_idempotency_unique").on(table.idempotencyKey),
    index("money_transactions_child_effective_idx").on(table.childId, table.effectiveAt),
    index("money_transactions_family_effective_idx").on(table.familyId, table.effectiveAt),
    index("money_transactions_schedule_idx").on(table.allowanceScheduleId),
  ],
);

export const allowanceRuns = sqliteTable(
  "allowance_runs",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull(),
    allowanceScheduleId: text("allowance_schedule_id").notNull(),
    periodKey: text("period_key").notNull(),
    dueAt: timestamp("due_at").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("processing"),
    moneyTransactionId: text("money_transaction_id"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.allowanceScheduleId, table.familyId],
      foreignColumns: [allowanceSchedules.id, allowanceSchedules.familyId],
      name: "allowance_runs_schedule_family_fk",
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.moneyTransactionId, table.familyId],
      foreignColumns: [moneyTransactions.id, moneyTransactions.familyId],
      name: "allowance_runs_transaction_family_fk",
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    check("allowance_runs_amount_check", sql`${table.amountCents} BETWEEN 1 AND 100000000`),
    check(
      "allowance_runs_status_check",
      sql`${table.status} IN ('processing', 'completed', 'failed')`,
    ),
    uniqueIndex("allowance_runs_schedule_period_unique").on(
      table.allowanceScheduleId,
      table.periodKey,
    ),
    uniqueIndex("allowance_runs_transaction_unique").on(table.moneyTransactionId),
    index("allowance_runs_status_due_idx").on(table.status, table.dueAt),
    index("allowance_runs_family_created_idx").on(table.familyId, table.createdAt),
  ],
);
