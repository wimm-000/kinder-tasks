// @vitest-environment node

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = resolve(tmpdir(), `kinder-tasks-retention-${process.pid}.db`);
const databaseUrl = `file:${databasePath}`;

type Database = typeof import("~/lib/db/client.server").db;
type DatabaseClient = typeof import("~/lib/db/client.server").databaseClient;

let db: Database;
let databaseClient: DatabaseClient;

beforeAll(async () => {
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("APP_URL", "http://localhost:5173");
  vi.stubEnv("BETTER_AUTH_SECRET", "retention-test-secret-with-more-than-thirty-two-characters");

  const migrationClient = createClient({ url: databaseUrl });
  await migrate(drizzle(migrationClient), { migrationsFolder: resolve("drizzle/migrations") });
  migrationClient.close();
  ({ db, databaseClient } = await import("~/lib/db/client.server"));
});

afterAll(async () => {
  databaseClient.close();
  await Promise.all([
    rm(databasePath, { force: true }),
    rm(`${databasePath}-shm`, { force: true }),
    rm(`${databasePath}-wal`, { force: true }),
  ]);
  vi.unstubAllEnvs();
});

describe("privacy retention", () => {
  it("keeps the ledger immutable outside a due family purge", async () => {
    const { childProfiles, families, familyMembers, moneyTransactions, user, userProfiles } =
      await import("~/lib/db/schema");
    await db.insert(user).values({
      id: "ledger-parent",
      name: "Ledger Parent",
      email: "ledger@example.test",
      emailVerified: true,
    });
    await db.insert(userProfiles).values({ userId: "ledger-parent" });
    await db.insert(families).values({
      id: "due-family",
      name: "Due Family",
      createdByUserId: "ledger-parent",
    });
    await db
      .insert(familyMembers)
      .values({ id: "due-membership", familyId: "due-family", userId: "ledger-parent" });
    await db.insert(childProfiles).values({
      id: "due-child",
      familyId: "due-family",
      alias: "Alias",
      avatarKey: "bear",
      profileColor: "teal",
    });
    await db.insert(moneyTransactions).values({
      id: "due-transaction",
      familyId: "due-family",
      childId: "due-child",
      amountCents: 100,
      type: "correction_credit",
      description: "Initial balance",
      createdByKind: "user",
      createdByUserId: "ledger-parent",
      idempotencyKey: "due-transaction-key",
      effectiveAt: new Date(),
    });

    await expect(
      db.delete(moneyTransactions).where(eq(moneyTransactions.id, "due-transaction")),
    ).rejects.toThrow();

    await db
      .update(families)
      .set({ status: "pending_deletion", purgeAfter: new Date(Date.now() - 1_000) })
      .where(eq(families.id, "due-family"));
    const { runRetention } = await import("~/services/privacy/retention.server");
    const result = await runRetention();

    expect(result.familiesPurged).toBe(1);
    expect(await db.query.families.findFirst()).toBeUndefined();
    expect(await db.query.moneyTransactions.findFirst()).toBeUndefined();
  });

  it("removes credentials and anonymizes a due adult", async () => {
    const { account, user, userProfiles } = await import("~/lib/db/schema");
    await db.insert(user).values({
      id: "due-user",
      name: "Personal Name",
      email: "personal@example.test",
      emailVerified: true,
    });
    await db.insert(userProfiles).values({
      userId: "due-user",
      status: "pending_deletion",
      deletionRequestedAt: new Date(Date.now() - 31 * 86_400_000),
      purgeAfter: new Date(Date.now() - 1_000),
    });
    await db.insert(account).values({
      id: "due-account",
      accountId: "due-user",
      providerId: "credential",
      userId: "due-user",
      password: "sensitive-hash",
    });

    const { runRetention } = await import("~/services/privacy/retention.server");
    const result = await runRetention();
    const anonymized = await db.query.user.findFirst({ where: eq(user.id, "due-user") });
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, "due-user"),
    });

    expect(result.usersAnonymized).toBe(1);
    expect(anonymized).toMatchObject({
      name: "Usuario eliminado",
      email: "deleted-due-user@invalid.local",
      emailVerified: false,
    });
    expect(profile?.status).toBe("deleted");
    expect(await db.query.account.findFirst()).toBeUndefined();
  });

  it("recovers every pending family where the adult remains a member", async () => {
    const { accountRecoveryTokens, families, familyMembers, user, userProfiles } =
      await import("~/lib/db/schema");
    const token = "a".repeat(43);
    const future = new Date(Date.now() + 86_400_000);
    await db.insert(user).values({
      id: "recover-user",
      name: "Recover User",
      email: "recover@example.test",
      emailVerified: true,
    });
    await db.insert(userProfiles).values({
      userId: "recover-user",
      status: "pending_deletion",
      deletionRequestedAt: new Date(),
      purgeAfter: future,
    });
    await db.insert(families).values({
      id: "recover-family",
      name: "Recover Family",
      status: "pending_deletion",
      purgeAfter: future,
    });
    await db.insert(familyMembers).values({
      id: "recover-membership",
      familyId: "recover-family",
      userId: "recover-user",
    });
    await db.insert(accountRecoveryTokens).values({
      id: "recover-token",
      userId: "recover-user",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: future,
    });

    const { recoverAccount } = await import("~/services/privacy/privacy.server");
    expect(await recoverAccount(token)).toBe(true);
    expect(
      (await db.query.families.findFirst({ where: eq(families.id, "recover-family") }))?.status,
    ).toBe("active");
  });
});
