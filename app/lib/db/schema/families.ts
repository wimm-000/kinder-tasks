import { relations, sql } from "drizzle-orm";
import { check, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { now, timestamp } from "./shared";

export const families = sqliteTable(
  "families",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("EUR"),
    timezone: text("timezone").notNull().default("Europe/Madrid"),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    deletionRequestedAt: timestamp("deletion_requested_at"),
    purgeAfter: timestamp("purge_after"),
    disabledAt: timestamp("disabled_at"),
    disabledReason: text("disabled_reason"),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("families_currency_check", sql`${table.currency} = 'EUR'`),
    check(
      "families_status_check",
      sql`${table.status} IN ('active', 'disabled', 'pending_deletion', 'deleted')`,
    ),
    index("families_status_idx").on(table.status),
    index("families_created_by_idx").on(table.createdByUserId),
    index("families_purge_idx").on(table.status, table.purgeAfter),
  ],
);

export const familyMembers = sqliteTable(
  "family_members",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    role: text("role").notNull().default("parent"),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at").notNull().default(now),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("family_members_role_check", sql`${table.role} = 'parent'`),
    check("family_members_status_check", sql`${table.status} IN ('active', 'suspended', 'left')`),
    uniqueIndex("family_members_family_user_unique").on(table.familyId, table.userId),
    index("family_members_family_status_idx").on(table.familyId, table.status),
    index("family_members_user_status_idx").on(table.userId, table.status),
  ],
);

export const familyInvitations = sqliteTable(
  "family_invitations",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    emailNormalized: text("email_normalized").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, { onDelete: "set null" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().default(now),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(now)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "family_invitations_status_check",
      sql`${table.status} IN ('pending', 'accepted', 'revoked', 'expired')`,
    ),
    uniqueIndex("family_invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("family_invitations_pending_family_email_unique")
      .on(table.familyId, table.emailNormalized)
      .where(sql`${table.status} = 'pending'`),
    index("family_invitations_email_status_idx").on(table.emailNormalized, table.status),
    index("family_invitations_family_status_idx").on(table.familyId, table.status),
    index("family_invitations_expires_idx").on(table.expiresAt),
  ],
);

export const familyRelations = relations(families, ({ many, one }) => ({
  creator: one(user, { fields: [families.createdByUserId], references: [user.id] }),
  members: many(familyMembers),
  invitations: many(familyInvitations),
}));

export const familyMemberRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, { fields: [familyMembers.familyId], references: [families.id] }),
  user: one(user, { fields: [familyMembers.userId], references: [user.id] }),
}));

export const familyInvitationRelations = relations(familyInvitations, ({ one }) => ({
  family: one(families, { fields: [familyInvitations.familyId], references: [families.id] }),
}));
