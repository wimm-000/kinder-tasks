// @vitest-environment node
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = resolve(tmpdir(), `kinder-tasks-wallet-${process.pid}.db`);
const databaseUrl = `file:${databasePath}`;
let db: typeof import("~/lib/db/client.server").db;
let databaseClient: typeof import("~/lib/db/client.server").databaseClient;
let wallet: typeof import("~/services/wallet/wallet.server");
let allowances: typeof import("~/services/allowances/allowances.server");
const userId = "0198b123-0000-7000-8000-000000000201";
let familyId: string;
let childId: string;

beforeAll(async () => {
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("APP_URL", "http://localhost:5173");
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "wallet-integration-secret-with-more-than-thirty-two-characters",
  );
  const client = createClient({ url: databaseUrl });
  await migrate(drizzle(client), { migrationsFolder: resolve("drizzle/migrations") });
  client.close();
  ({ db, databaseClient } = await import("~/lib/db/client.server"));
  wallet = await import("~/services/wallet/wallet.server");
  allowances = await import("~/services/allowances/allowances.server");
  const { user, userProfiles } = await import("~/lib/db/schema");
  await db
    .insert(user)
    .values({ id: userId, name: "Paula", email: "wallet@example.test", emailVerified: true });
  await db.insert(userProfiles).values({ userId });
  const familyService = await import("~/services/families/families.server");
  familyId = await familyService.createFamily(userId, "Familia Wallet");
  const children = await import("~/services/children/children.server");
  childId = await children.createChild({
    userId,
    familyId,
    alias: "Leo",
    avatarKey: "fox",
    profileColor: "teal",
    pin: "2468",
  });
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

describe("immutable wallet", () => {
  it("processes the same allowance period once", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
    await allowances.saveAllowance({
      userId,
      familyId,
      childId,
      amountCents: 250,
      frequency: "weekly",
      weekday,
      startDate: today,
    });
    await allowances.processDueAllowances(2);
    await allowances.processDueAllowances(2);
    const { allowanceRuns, moneyTransactions } = await import("~/lib/db/schema");
    expect(await db.select().from(allowanceRuns)).toHaveLength(1);
    expect(
      (await db.select().from(moneyTransactions)).filter((row) => row.type === "allowance"),
    ).toHaveLength(1);
  });
  it("derives balance and prevents overdraw under competing withdrawals", async () => {
    await wallet.createAdjustment(userId, familyId, childId, "credit", 1000, "Saldo inicial");
    const results = await Promise.allSettled([
      wallet.createWithdrawal(userId, familyId, childId, 700, "Compra A"),
      wallet.createWithdrawal(userId, familyId, childId, 700, "Compra B"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await wallet.getParentWallet(userId, familyId, childId)).balanceCents).toBe(550);
  });
  it("rejects updates and deletes in the database", async () => {
    const { moneyTransactions } = await import("~/lib/db/schema");
    const row = await db.query.moneyTransactions.findFirst();
    await expect(
      db
        .update(moneyTransactions)
        .set({ description: "alterado" })
        .where(eq(moneyTransactions.id, row!.id)),
    ).rejects.toThrow();
    await expect(
      db.delete(moneyTransactions).where(eq(moneyTransactions.id, row!.id)),
    ).rejects.toThrow();
  });
});
