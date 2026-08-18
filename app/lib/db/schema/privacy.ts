import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { now, timestamp } from "./shared";

export const accountRecoveryTokens = sqliteTable(
  "account_recovery_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("account_recovery_token_hash_unique").on(table.tokenHash),
    index("account_recovery_user_idx").on(table.userId),
    index("account_recovery_expires_idx").on(table.expiresAt),
  ],
);
