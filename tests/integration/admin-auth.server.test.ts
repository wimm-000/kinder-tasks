// @vitest-environment node

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("~/lib/auth/auth.server", () => ({
  auth: { api: { getSession } },
}));

const databasePath = resolve(tmpdir(), `kinder-tasks-admin-auth-${process.pid}.db`);
const databaseUrl = `file:${databasePath}`;

type Database = typeof import("~/lib/db/client.server").db;
type DatabaseClient = typeof import("~/lib/db/client.server").databaseClient;

let db: Database;
let databaseClient: DatabaseClient;

beforeAll(async () => {
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("APP_URL", "http://localhost:5173");
  vi.stubEnv("BETTER_AUTH_SECRET", "admin-integration-secret-with-more-than-thirty-two-characters");
  vi.stubEnv("SUPERADMIN_EMAILS", "admin@example.test");

  const migrationClient = createClient({ url: databaseUrl });
  await migrate(drizzle(migrationClient), { migrationsFolder: resolve("drizzle/migrations") });
  migrationClient.close();

  ({ db, databaseClient } = await import("~/lib/db/client.server"));
  const { user, userProfiles } = await import("~/lib/db/schema");
  await db.insert(user).values([
    {
      id: "normal-user",
      name: "Normal User",
      email: "normal@example.test",
      emailVerified: true,
    },
    {
      id: "admin-user",
      name: "Admin User",
      email: "admin@example.test",
      emailVerified: true,
    },
  ]);
  await db.insert(userProfiles).values([{ userId: "normal-user" }, { userId: "admin-user" }]);
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

describe("superadmin authorization", () => {
  it("denies and audits a regular adult", async () => {
    getSession.mockResolvedValue({
      user: {
        id: "normal-user",
        email: "normal@example.test",
        emailVerified: true,
      },
      session: { id: "normal-session" },
    });
    const { requireSuperadmin } = await import("~/lib/auth/session.server");

    await expect(
      requireSuperadmin(new Request("http://localhost:5173/admin")),
    ).rejects.toMatchObject({ status: 403 });

    const { auditLogs } = await import("~/lib/db/schema");
    const denied = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.actorUserId, "normal-user"),
    });
    expect(denied).toMatchObject({ action: "superadmin.access", result: "denied" });
  });

  it("bootstraps only the configured verified adult", async () => {
    const { bootstrapSuperadmin } = await import("~/services/admin/bootstrap.server");
    expect(
      await bootstrapSuperadmin({
        id: "normal-user",
        email: "admin@example.test",
        emailVerified: false,
      }),
    ).toBe(false);

    getSession.mockResolvedValue({
      user: {
        id: "admin-user",
        email: "admin@example.test",
        emailVerified: true,
      },
      session: { id: "admin-session" },
    });
    const { requireSuperadmin } = await import("~/lib/auth/session.server");
    const context = await requireSuperadmin(new Request("http://localhost:5173/admin"));

    expect(context.profile.globalRole).toBe("superadmin");
    const profile = await db.query.userProfiles.findFirst({
      where: (profiles, { eq }) => eq(profiles.userId, "admin-user"),
    });
    expect(profile?.globalRole).toBe("superadmin");
  });
});
