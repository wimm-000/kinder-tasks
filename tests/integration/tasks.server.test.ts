// @vitest-environment node
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = resolve(tmpdir(), `kinder-tasks-tasks-${process.pid}.db`);
const databaseUrl = `file:${databasePath}`;
let db: typeof import("~/lib/db/client.server").db;
let databaseClient: typeof import("~/lib/db/client.server").databaseClient;
let taskService: typeof import("~/services/tasks/tasks.server");
const userId = "0198b123-0000-7000-8000-000000000301";
let familyId: string;
let childId: string;
let childRequest: Request;
let taskId: string;
let childCookieHeader: string;
let csrfToken: string;
beforeAll(async () => {
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("APP_URL", "http://localhost:5173");
  vi.stubEnv("BETTER_AUTH_SECRET", "tasks-integration-secret-with-more-than-thirty-two-characters");
  const client = createClient({ url: databaseUrl });
  await migrate(drizzle(client), { migrationsFolder: resolve("drizzle/migrations") });
  client.close();
  ({ db, databaseClient } = await import("~/lib/db/client.server"));
  taskService = await import("~/services/tasks/tasks.server");
  const { user, userProfiles } = await import("~/lib/db/schema");
  await db
    .insert(user)
    .values({ id: userId, name: "Paula", email: "tasks@example.test", emailVerified: true });
  await db.insert(userProfiles).values({ userId });
  const families = await import("~/services/families/families.server");
  familyId = await families.createFamily(userId, "Familia Tareas");
  const children = await import("~/services/children/children.server");
  childId = await children.createChild({
    userId,
    familyId,
    alias: "Leo",
    avatarKey: "fox",
    profileColor: "teal",
    pin: "2468",
  });
  const token = await children.authorizeChildDevice(userId, familyId, "Tablet");
  const { childDeviceCookie } = await import("~/lib/auth/child-session.server");
  const devicePair = (await childDeviceCookie.serialize(token)).split(";")[0];
  const auth = await import("~/services/children/child-auth.server");
  const unlocked = await auth.unlockChild(
    new Request("http://localhost/kids", {
      headers: { cookie: devicePair, "x-nf-client-connection-ip": "192.0.2.40" },
    }),
    childId,
    "2468",
  );
  const { childCsrfCookie } = await import("~/lib/auth/child-session.server");
  const csrfPair = unlocked.csrfCookie.split(";")[0];
  csrfToken = (await childCsrfCookie.parse(csrfPair)) as string;
  childCookieHeader = `${devicePair}; ${unlocked.sessionCookie.split(";")[0]}; ${csrfPair}`;
  childRequest = new Request("http://localhost/kids/tasks", {
    headers: { cookie: childCookieHeader },
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

describe("task completion and rewards", () => {
  it("creates an assigned task and exposes it only to that child", async () => {
    taskId = await taskService.createTask({
      userId,
      familyId,
      title: "Bajar el reciclaje",
      type: "open",
      rewardCents: 150,
      openLimitCount: 3,
      openLimitPeriod: "day",
      childIds: [childId],
    });
    const available = await taskService.listChildTasks(childRequest);
    expect(available.tasks).toEqual([
      expect.objectContaining({ title: "Bajar el reciclaje", rewardCents: 150 }),
    ]);
  });
  it("deduplicates submission and pays an approval exactly once", async () => {
    const assignmentId = (await taskService.listChildTasks(childRequest)).tasks[0]!.assignmentId;
    const requestId = "0198b123-0000-7000-8000-000000000399";
    const first = await taskService.requestTaskCompletion(childRequest, assignmentId, requestId);
    expect(await taskService.requestTaskCompletion(childRequest, assignmentId, requestId)).toBe(
      first,
    );
    await taskService.reviewTaskRequest({
      userId,
      familyId,
      requestId: first,
      decision: "approve",
    });
    await taskService.reviewTaskRequest({
      userId,
      familyId,
      requestId: first,
      decision: "approve",
    });
    const { moneyTransactions, taskCompletionRequests } = await import("~/lib/db/schema");
    expect(await db.select().from(taskCompletionRequests)).toHaveLength(1);
    expect(
      (await db.select().from(moneyTransactions)).filter((row) => row.type === "task_reward"),
    ).toHaveLength(1);
    expect(
      await db.query.taskCompletionRequests.findFirst({
        where: eq(taskCompletionRequests.id, first),
      }),
    ).toMatchObject({ status: "approved" });
  });
  it("accepts repeated sync payloads without creating another request", async () => {
    const { action } = await import("~/routes/api-kids-sync");
    const assignmentId = (await db.query.taskAssignments.findFirst())!.id;
    const invoke = () => {
      const request = new Request("http://localhost/api/kids/sync", {
        method: "POST",
        headers: {
          cookie: childCookieHeader,
          origin: "http://localhost",
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          requests: [
            {
              assignmentId,
              clientRequestId: "0198b123-0000-7000-8000-000000000399",
            },
          ],
        }),
      });
      return action({ request, params: {}, context: {} as never } as never);
    };
    expect(await invoke()).toMatchObject({ results: [{ status: "synced" }] });
    expect(await invoke()).toMatchObject({ results: [{ status: "synced" }] });
    const { taskCompletionRequests } = await import("~/lib/db/schema");
    expect(await db.select().from(taskCompletionRequests)).toHaveLength(1);
  });
  it("edits assignments and archives without deleting history", async () => {
    await taskService.updateTask({
      userId,
      familyId,
      taskId,
      title: "Bajar vidrio",
      type: "open",
      rewardCents: 200,
      openLimitCount: 4,
      openLimitPeriod: "week",
      childIds: [childId],
    });
    expect(await taskService.getFamilyTask(userId, familyId, taskId)).toMatchObject({
      task: { title: "Bajar vidrio", rewardCents: 200 },
    });
    await taskService.archiveTask(userId, familyId, taskId);
    expect((await taskService.listFamilyTasks(userId, familyId)).tasks).toHaveLength(0);
    const { taskCompletionRequests } = await import("~/lib/db/schema");
    expect(await db.select().from(taskCompletionRequests)).toHaveLength(1);
  });
});
