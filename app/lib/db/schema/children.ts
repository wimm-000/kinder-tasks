import { relations, sql } from "drizzle-orm";
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
import { families } from "./families";
import { now, timestamp } from "./shared";

export const childProfiles = sqliteTable(
  "child_profiles",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade", onUpdate: "cascade" }),
    alias: text("alias").notNull(),
    avatarKey: text("avatar_key").notNull(),
    profileColor: text("profile_color").notNull(),
    status: text("status").notNull().default("active"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "child_profiles_status_check",
      sql`${table.status} IN ('active', 'disabled', 'pending_deletion')`,
    ),
    check(
      "child_profiles_avatar_check",
      sql`${table.avatarKey} IN ('bear', 'cat', 'fox', 'owl', 'rabbit', 'star')`,
    ),
    check(
      "child_profiles_color_check",
      sql`${table.profileColor} IN ('teal', 'coral', 'yellow', 'blue', 'violet', 'green')`,
    ),
    uniqueIndex("child_profiles_id_family_unique").on(table.id, table.familyId),
    index("child_profiles_family_status_idx").on(table.familyId, table.status),
  ],
);

export const childCredentials = sqliteTable(
  "child_credentials",
  {
    childId: text("child_id").primaryKey(),
    familyId: text("family_id").notNull(),
    pinHash: text("pin_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
    lastFailedAt: timestamp("last_failed_at"),
    pinChangedAt: timestamp("pin_changed_at").notNull().default(now),
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
      name: "child_credentials_profile_family_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    check("child_credentials_failed_attempts_check", sql`${table.failedAttempts} >= 0`),
    index("child_credentials_family_idx").on(table.familyId),
  ],
);

export const childDeviceAuthorizations = sqliteTable(
  "child_device_authorizations",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    name: text("name"),
    offlineEnabled: integer("offline_enabled", { mode: "boolean" }).notNull().default(false),
    expiresAt: timestamp("expires_at").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    authorizedByUserId: text("authorized_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("child_devices_token_hash_unique").on(table.tokenHash),
    uniqueIndex("child_devices_id_family_unique").on(table.id, table.familyId),
    index("child_devices_family_revoked_idx").on(table.familyId, table.revokedAt),
    index("child_devices_expires_idx").on(table.expiresAt),
  ],
);

export const childSessions = sqliteTable(
  "child_sessions",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull(),
    childId: text("child_id").notNull(),
    deviceAuthorizationId: text("device_authorization_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    csrfSecretHash: text("csrf_secret_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    revokedAt: timestamp("revoked_at"),
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
      name: "child_sessions_profile_family_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.deviceAuthorizationId, table.familyId],
      foreignColumns: [childDeviceAuthorizations.id, childDeviceAuthorizations.familyId],
      name: "child_sessions_device_family_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    uniqueIndex("child_sessions_token_hash_unique").on(table.tokenHash),
    index("child_sessions_child_revoked_idx").on(table.childId, table.revokedAt),
    index("child_sessions_device_revoked_idx").on(table.deviceAuthorizationId, table.revokedAt),
    index("child_sessions_family_revoked_idx").on(table.familyId, table.revokedAt),
    index("child_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    keyHash: text("key_hash").primaryKey(),
    scope: text("scope").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at").notNull(),
    blockedUntil: timestamp("blocked_until"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("rate_limit_buckets_count_check", sql`${table.attemptCount} >= 0`),
    index("rate_limit_buckets_expires_idx").on(table.expiresAt),
    index("rate_limit_buckets_scope_blocked_idx").on(table.scope, table.blockedUntil),
  ],
);

export const childProfileRelations = relations(childProfiles, ({ one }) => ({
  family: one(families, { fields: [childProfiles.familyId], references: [families.id] }),
  credential: one(childCredentials),
}));

export const childCredentialRelations = relations(childCredentials, ({ one }) => ({
  profile: one(childProfiles, {
    fields: [childCredentials.childId],
    references: [childProfiles.id],
  }),
}));
