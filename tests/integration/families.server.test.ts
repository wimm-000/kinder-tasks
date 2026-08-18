// @vitest-environment node

import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = resolve(tmpdir(), `kinder-tasks-families-${process.pid}.db`);
const databaseUrl = `file:${databasePath}`;

let db: typeof import("~/lib/db/client.server").db;
let databaseClient: typeof import("~/lib/db/client.server").databaseClient;
let service: typeof import("~/services/families/families.server");
let outbox: InstanceType<typeof import("~/services/email/email-service.server").MemoryEmailService>;
let emailProvider: typeof import("~/services/email/email.server");

const paulaId = "0198b123-0000-7000-8000-000000000001";
const saraId = "0198b123-0000-7000-8000-000000000002";

beforeAll(async () => {
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("APP_URL", "http://localhost:5173");
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "family-integration-secret-with-more-than-thirty-two-characters",
  );
  const migrationClient = createClient({ url: databaseUrl });
  await migrate(drizzle(migrationClient), { migrationsFolder: resolve("drizzle/migrations") });
  migrationClient.close();

  const emailModule = await import("~/services/email/email-service.server");
  emailProvider = await import("~/services/email/email.server");
  outbox = new emailModule.MemoryEmailService();
  emailProvider.setEmailServiceForTests(outbox);
  ({ db, databaseClient } = await import("~/lib/db/client.server"));
  service = await import("~/services/families/families.server");
  const { user, userProfiles } = await import("~/lib/db/schema");
  await db.insert(user).values([
    { id: paulaId, name: "Paula Robles", email: "paula.family@example.test", emailVerified: true },
    { id: saraId, name: "Sara Martín", email: "sara.family@example.test", emailVerified: true },
  ]);
  await db.insert(userProfiles).values([{ userId: paulaId }, { userId: saraId }]);
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

describe("family tenancy and invitations", () => {
  it("creates the family, creator membership and audit atomically", async () => {
    const familyId = await service.createFamily(paulaId, "Familia Robles");
    const { auditLogs, familyMembers } = await import("~/lib/db/schema");
    expect(await service.listFamilies(paulaId)).toEqual([
      expect.objectContaining({ id: familyId, name: "Familia Robles" }),
    ]);
    expect(
      await db.query.familyMembers.findFirst({
        where: and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, paulaId)),
      }),
    ).toMatchObject({ status: "active", role: "parent" });
    expect(
      await db.query.auditLogs.findFirst({ where: eq(auditLogs.familyId, familyId) }),
    ).toMatchObject({ action: "family.created", result: "success" });
  });

  it("deduplicates repeated family creation requests", async () => {
    const clientRequestId = "0198b123-0000-7000-8000-000000000099";
    const first = await service.createFamily(paulaId, "Familia Única", clientRequestId);
    const repeated = await service.createFamily(paulaId, "Familia Única", clientRequestId);

    expect(repeated).toBe(first);
    expect((await service.listFamilies(paulaId)).filter(({ id }) => id === first)).toHaveLength(1);
  });

  it("blocks horizontal access to another family", async () => {
    const saraFamily = await service.createFamily(saraId, "Familia Martín");
    await expect(service.requireFamilyParent(paulaId, saraFamily)).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect((await service.listFamilies(paulaId)).map((family) => family.name)).not.toContain(
      "Familia Martín",
    );
  });

  it("stores a token hash and accepts only the matching account", async () => {
    const familyId = (await service.listFamilies(paulaId)).find(
      ({ name }) => name === "Familia Robles",
    )!.id;
    await service.inviteParent({
      userId: paulaId,
      inviterName: "Paula Robles",
      familyId,
      email: "sara.family@example.test",
    });
    const url = outbox.messages.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
    expect(url).toBeDefined();
    const token = new URL(url!).pathname.split("/").at(-1)!;
    const { familyInvitations, familyMembers } = await import("~/lib/db/schema");
    const invitation = await db.query.familyInvitations.findFirst({
      where: eq(familyInvitations.familyId, familyId),
    });
    expect(invitation?.tokenHash).not.toBe(token);
    await expect(
      service.acceptInvitation(token, paulaId, "paula.family@example.test"),
    ).rejects.toMatchObject({ init: { status: 403 } });
    await expect(service.acceptInvitation(token, saraId, "sara.family@example.test")).resolves.toBe(
      familyId,
    );
    expect(
      await db.query.familyMembers.findFirst({
        where: and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, saraId)),
      }),
    ).toMatchObject({ status: "active" });
  });

  it("revokes the invitation and returns a form-safe error when delivery fails", async () => {
    const familyId = (await service.listFamilies(paulaId)).find(
      ({ name }) => name === "Familia Robles",
    )!.id;
    emailProvider.setEmailServiceForTests({
      send: async () => {
        throw new Error("Provider unavailable");
      },
    });

    await expect(
      service.inviteParent({
        userId: paulaId,
        inviterName: "Paula Robles",
        familyId,
        email: "delivery-failure@example.test",
      }),
    ).rejects.toMatchObject({
      data: expect.stringContaining("No pudimos enviar la invitación"),
      init: { status: 502 },
    });

    const { auditLogs, familyInvitations } = await import("~/lib/db/schema");
    const failed = await db.query.familyInvitations.findFirst({
      where: and(
        eq(familyInvitations.familyId, familyId),
        eq(familyInvitations.emailNormalized, "delivery-failure@example.test"),
      ),
    });
    expect(failed).toMatchObject({ status: "revoked" });
    expect(
      await db.query.auditLogs.findFirst({
        where: and(
          eq(auditLogs.targetId, failed!.id),
          eq(auditLogs.action, "invitation.delivery_failed"),
        ),
      }),
    ).toMatchObject({ result: "failure" });

    await service.deleteRevokedInvitation(paulaId, familyId, failed!.id);
    expect(
      await db.query.familyInvitations.findFirst({
        where: eq(familyInvitations.id, failed!.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.auditLogs.findFirst({
        where: and(eq(auditLogs.targetId, failed!.id), eq(auditLogs.action, "invitation.deleted")),
      }),
    ).toMatchObject({ result: "success" });

    emailProvider.setEmailServiceForTests(outbox);
  });
});
