import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { families } from "./families";
import { now, timestamp } from "./shared";

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").references(() => families.id, { onDelete: "set null" }),
    actorType: text("actor_type").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorChildId: text("actor_child_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    result: text("result").notNull(),
    metadataJson: text("metadata_json"),
    ipHash: text("ip_hash"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at").notNull().default(now),
  },
  (table) => [
    check(
      "audit_logs_actor_type_check",
      sql`${table.actorType} IN ('user', 'child', 'system', 'superadmin')`,
    ),
    check("audit_logs_result_check", sql`${table.result} IN ('success', 'denied', 'failure')`),
    index("audit_logs_family_created_idx").on(table.familyId, table.createdAt),
    index("audit_logs_actor_user_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_action_created_idx").on(table.action, table.createdAt),
    index("audit_logs_result_created_idx").on(table.result, table.createdAt),
  ],
);
