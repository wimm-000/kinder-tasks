// @vitest-environment node

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databasePath = resolve(tmpdir(), `kinder-tasks-auth-${process.pid}.db`);
const databaseUrl = `file:${databasePath}`;

type Auth = typeof import("~/lib/auth/auth.server").auth;
type Database = typeof import("~/lib/db/client.server").db;
type DatabaseClient = typeof import("~/lib/db/client.server").databaseClient;

let auth: Auth;
let db: Database;
let databaseClient: DatabaseClient;
let outbox: InstanceType<typeof import("~/services/email/email-service.server").MemoryEmailService>;
let verifiedSessionCookie: string;
let activeSessionCookie: string;

function authRequest(path: string, body: Record<string, unknown>, ip = "192.0.2.10") {
  return new Request(`http://localhost:5173/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      "x-nf-client-connection-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  vi.stubEnv("TURSO_DATABASE_URL", databaseUrl);
  vi.stubEnv("APP_URL", "http://localhost:5173");
  vi.stubEnv("BETTER_AUTH_SECRET", "integration-test-secret-with-more-than-thirty-two-characters");

  const migrationClient = createClient({ url: databaseUrl });
  await migrate(drizzle(migrationClient), { migrationsFolder: resolve("drizzle/migrations") });
  migrationClient.close();

  const emailModule = await import("~/services/email/email-service.server");
  const emailProvider = await import("~/services/email/email.server");
  outbox = new emailModule.MemoryEmailService();
  emailProvider.setEmailServiceForTests(outbox);

  ({ auth } = await import("~/lib/auth/auth.server"));
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

describe("adult authentication", () => {
  it("registers, verifies and creates a secure session", async () => {
    const response = await auth.handler(
      authRequest("/sign-up/email", {
        name: "Paula Robles",
        email: "paula.integration@example.test",
        password: "FamiliaRobles2026!",
        callbackURL: "/verify-email?verified=1",
      }),
    );

    expect(response.status).toBe(200);
    expect(outbox.messages).toHaveLength(1);
    expect(outbox.messages[0]?.to).toBe("paula.integration@example.test");

    const verificationUrl = outbox.messages[0]?.text.match(/https?:\/\/\S+/)?.[0];
    expect(verificationUrl).toBeDefined();

    const verificationResponse = await auth.handler(new Request(verificationUrl!));
    expect(verificationResponse.status).toBe(302);

    verifiedSessionCookie = verificationResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(verifiedSessionCookie).toContain("better-auth.session_token=");

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: verifiedSessionCookie }),
    });
    expect(session?.user.emailVerified).toBe(true);

    const profile = await db.query.userProfiles.findFirst();
    expect(profile).toMatchObject({ globalRole: "user", status: "active", locale: "es" });
  });

  it("resets the password and revokes the previous session", async () => {
    const response = await auth.handler(
      authRequest("/request-password-reset", {
        email: "paula.integration@example.test",
        redirectTo: "/reset-password",
      }),
    );

    expect(response.status).toBe(200);
    expect(outbox.messages.at(-1)?.subject).toContain("contraseña");
    expect(outbox.messages.at(-1)?.text).toContain("/api/auth/reset-password/");

    const resetLink = outbox.messages.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
    const resetRedirect = await auth.handler(new Request(resetLink!));
    expect(resetRedirect.status).toBe(302);

    const location = resetRedirect.headers.get("location");
    const token = new URL(location!, "http://localhost:5173").searchParams.get("token");
    expect(token).toBeTruthy();

    const resetResponse = await auth.handler(
      authRequest("/reset-password", { newPassword: "NuevaFamiliaRobles2026!", token }),
    );
    expect(resetResponse.status).toBe(200);

    const previousSession = await auth.api.getSession({
      headers: new Headers({ cookie: verifiedSessionCookie }),
    });
    expect(previousSession).toBeNull();

    const signInResponse = await auth.handler(
      authRequest("/sign-in/email", {
        email: "paula.integration@example.test",
        password: "NuevaFamiliaRobles2026!",
      }),
    );
    expect(signInResponse.status).toBe(200);
    activeSessionCookie = signInResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(activeSessionCookie).toContain("better-auth.session_token=");
  });

  it("denies auth mutations when the global profile is blocked", async () => {
    const { userProfiles } = await import("~/lib/db/schema");
    const { action } = await import("~/routes/api-auth");
    const profile = await db.query.userProfiles.findFirst();
    expect(profile).toBeDefined();

    await db
      .update(userProfiles)
      .set({ status: "blocked" })
      .where(eq(userProfiles.userId, profile!.userId));

    const request = new Request("http://localhost:5173/api/auth/update-user", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: activeSessionCookie,
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({ name: "Nombre no autorizado" }),
    });
    const response = await action({
      request,
      url: new URL(request.url),
      pattern: "/api/auth/*",
      params: { "*": "update-user" },
      context: {} as never,
    });

    expect(response.status).toBe(403);
    await db
      .update(userProfiles)
      .set({ status: "active" })
      .where(eq(userProfiles.userId, profile!.userId));
  });

  it("rate limits repeated invalid sign-in attempts", async () => {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(
        await auth.handler(
          authRequest(
            "/sign-in/email",
            { email: "paula.integration@example.test", password: "incorrect-password" },
            "198.51.100.25",
          ),
        ),
      );
    }

    expect(responses.at(-1)?.status).toBe(429);
    expect(responses.at(-1)?.headers.get("x-retry-after")).toBeTruthy();
  });

  it("lists and revokes the active session", async () => {
    const headers = new Headers({ cookie: activeSessionCookie });
    const sessions = await auth.api.listSessions({ headers });
    expect(sessions).toHaveLength(1);

    await auth.api.revokeSession({ body: { token: sessions[0]!.token }, headers });

    const revokedSession = await auth.api.getSession({ headers });
    expect(revokedSession).toBeNull();
  });
});
