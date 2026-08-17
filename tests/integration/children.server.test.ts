// @vitest-environment node

import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = resolve(tmpdir(), `kinder-tasks-children-${process.pid}.db`);
const databaseUrl = `file:${databasePath}`;
let db: typeof import("~/lib/db/client.server").db;
let databaseClient: typeof import("~/lib/db/client.server").databaseClient;
let children: typeof import("~/services/children/children.server");
let childAuth: typeof import("~/services/children/child-auth.server");
const parentId = "0198b123-0000-7000-8000-000000000101";
const otherId = "0198b123-0000-7000-8000-000000000102";
let familyId: string;
let childId: string;

beforeAll(async () => {
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("APP_URL", "http://localhost:5173");
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "children-integration-secret-with-more-than-thirty-two-characters",
  );
  const migrationClient = createClient({ url: databaseUrl });
  await migrate(drizzle(migrationClient), { migrationsFolder: resolve("drizzle/migrations") });
  migrationClient.close();
  ({ db, databaseClient } = await import("~/lib/db/client.server"));
  children = await import("~/services/children/children.server");
  childAuth = await import("~/services/children/child-auth.server");
  const { user, userProfiles } = await import("~/lib/db/schema");
  await db.insert(user).values([
    { id: parentId, name: "Paula", email: "paula.children@example.test", emailVerified: true },
    { id: otherId, name: "Sara", email: "sara.children@example.test", emailVerified: true },
  ]);
  await db.insert(userProfiles).values([{ userId: parentId }, { userId: otherId }]);
  const families = await import("~/services/families/families.server");
  familyId = await families.createFamily(parentId, "Familia Infantil");
  await families.createFamily(otherId, "Otra Familia");
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

describe("child profiles and sessions", () => {
  it("stores an Argon2id hash and blocks horizontal parent access", async () => {
    childId = await children.createChild({
      userId: parentId,
      familyId,
      alias: "Leo",
      avatarKey: "fox",
      profileColor: "teal",
      pin: "0123",
    });
    const { childCredentials } = await import("~/lib/db/schema");
    const credential = await db.query.childCredentials.findFirst({
      where: eq(childCredentials.childId, childId),
    });
    expect(credential?.pinHash).toMatch(/^\$argon2id\$/);
    expect(credential?.pinHash).not.toContain("0123");
    await expect(children.getChild(otherId, familyId, childId)).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("requires an authorized device and derives child identity from its session", async () => {
    const token = await children.authorizeChildDevice(parentId, familyId, "Tablet de prueba");
    const { childDeviceCookie, readCookie } = await import("~/lib/auth/child-session.server");
    const devicePair = (await childDeviceCookie.serialize(token)).split(";")[0];
    const deviceRequest = new Request("http://localhost:5173/kids", {
      headers: { cookie: devicePair, "x-nf-client-connection-ip": "192.0.2.20" },
    });
    expect(await readCookie(childDeviceCookie, deviceRequest)).toBe(token);
    expect((await childAuth.listAuthorizedProfiles(deviceRequest))?.profiles).toEqual([
      expect.objectContaining({ id: childId, alias: "Leo" }),
    ]);
    const unlocked = await childAuth.unlockChild(deviceRequest, childId, "0123");
    const sessionPair = unlocked.sessionCookie.split(";")[0];
    const context = await childAuth.requireChildContext(
      new Request("http://localhost:5173/kids/home", {
        headers: { cookie: `${devicePair}; ${sessionPair}` },
      }),
    );
    expect(context).toMatchObject({ childId, familyId, alias: "Leo" });
    await children.setChildStatus(parentId, familyId, childId, "disabled");
    await expect(
      childAuth.requireChildContext(
        new Request("http://localhost:5173/kids/home", {
          headers: { cookie: `${devicePair}; ${sessionPair}` },
        }),
      ),
    ).rejects.toMatchObject({ init: { status: 401 } });
  });

  it("persists a progressive lock after five invalid PIN attempts", async () => {
    await children.setChildStatus(parentId, familyId, childId, "active");
    const token = await children.authorizeChildDevice(parentId, familyId, "Dispositivo de bloqueo");
    const { childDeviceCookie } = await import("~/lib/auth/child-session.server");
    const devicePair = (await childDeviceCookie.serialize(token)).split(";")[0];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        childAuth.unlockChild(
          new Request("http://localhost:5173/kids", {
            headers: { cookie: devicePair, "x-nf-client-connection-ip": "192.0.2.21" },
          }),
          childId,
          "9999",
        ),
      ).rejects.toMatchObject({ init: { status: 401 } });
    }
    const { childCredentials } = await import("~/lib/db/schema");
    const credential = await db.query.childCredentials.findFirst({
      where: eq(childCredentials.childId, childId),
    });
    expect(credential?.failedAttempts).toBe(5);
    expect(credential?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });
});
