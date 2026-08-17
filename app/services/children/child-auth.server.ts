import { createHmac } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { data } from "react-router";
import { v7 as uuidv7 } from "uuid";

import { childLockDuration, verifyChildPin } from "~/lib/auth/child-pin.server";
import {
  childCsrfCookie,
  childDeviceCookie,
  childSessionCookie,
  createSecret,
  hashSecret,
  readCookie,
} from "~/lib/auth/child-session.server";
import { db } from "~/lib/db/client.server";
import {
  auditLogs,
  childCredentials,
  childDeviceAuthorizations,
  childProfiles,
  childSessions,
  families,
  rateLimitBuckets,
} from "~/lib/db/schema";
import { getServerEnv } from "~/lib/env.server";

const SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const GENERIC_ERROR = "No hemos podido desbloquear este perfil.";

function rateKey(value: string) {
  return createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update(`child-pin:${value}`)
    .digest("hex");
}

async function getDevice(request: Request) {
  const token = await readCookie(childDeviceCookie, request);
  if (!token) return null;
  const [device] = await db
    .select({
      id: childDeviceAuthorizations.id,
      familyId: childDeviceAuthorizations.familyId,
      familyName: families.name,
    })
    .from(childDeviceAuthorizations)
    .innerJoin(families, eq(childDeviceAuthorizations.familyId, families.id))
    .where(
      and(
        eq(childDeviceAuthorizations.tokenHash, hashSecret(token)),
        isNull(childDeviceAuthorizations.revokedAt),
        gt(childDeviceAuthorizations.expiresAt, new Date()),
        eq(families.status, "active"),
      ),
    )
    .limit(1);
  return device ?? null;
}

export async function listAuthorizedProfiles(request: Request) {
  const device = await getDevice(request);
  if (!device) return null;
  const profiles = await db
    .select({
      id: childProfiles.id,
      alias: childProfiles.alias,
      avatarKey: childProfiles.avatarKey,
      profileColor: childProfiles.profileColor,
    })
    .from(childProfiles)
    .where(and(eq(childProfiles.familyId, device.familyId), eq(childProfiles.status, "active")))
    .orderBy(childProfiles.alias);
  return { device, profiles };
}

export async function getAuthorizedProfile(request: Request, childId: string) {
  const authorized = await listAuthorizedProfiles(request);
  if (!authorized) return null;
  return authorized.profiles.find((profile) => profile.id === childId) ?? null;
}

async function checkRateLimit(request: Request, deviceId: string) {
  const ip = request.headers.get("x-nf-client-connection-ip") ?? "local";
  for (const [scope, value] of [
    ["child-device", deviceId],
    ["child-ip", ip],
  ] as const) {
    const bucket = await db.query.rateLimitBuckets.findFirst({
      where: eq(rateLimitBuckets.keyHash, rateKey(`${scope}:${value}`)),
    });
    if (bucket?.blockedUntil && bucket.blockedUntil > new Date())
      throw data(GENERIC_ERROR, { status: 429 });
  }
}

async function recordRateFailure(request: Request, deviceId: string) {
  const ip = request.headers.get("x-nf-client-connection-ip") ?? "local";
  const now = new Date();
  for (const [scope, value, limit] of [
    ["child-device", deviceId, 20],
    ["child-ip", ip, 30],
  ] as const) {
    const keyHash = rateKey(`${scope}:${value}`);
    const existing = await db.query.rateLimitBuckets.findFirst({
      where: eq(rateLimitBuckets.keyHash, keyHash),
    });
    const reset = !existing || now.getTime() - existing.windowStartedAt.getTime() > 15 * 60_000;
    const count = reset ? 1 : existing.attemptCount + 1;
    await db
      .insert(rateLimitBuckets)
      .values({
        keyHash,
        scope,
        attemptCount: count,
        windowStartedAt: reset ? now : existing!.windowStartedAt,
        blockedUntil: count >= limit ? new Date(now.getTime() + 15 * 60_000) : null,
        expiresAt: new Date(now.getTime() + 30 * 60_000),
      })
      .onConflictDoUpdate({
        target: rateLimitBuckets.keyHash,
        set: {
          attemptCount: count,
          windowStartedAt: reset ? now : existing!.windowStartedAt,
          blockedUntil: count >= limit ? new Date(now.getTime() + 15 * 60_000) : null,
          expiresAt: new Date(now.getTime() + 30 * 60_000),
        },
      });
  }
}

export async function unlockChild(request: Request, childId: string, pin: string) {
  const device = await getDevice(request);
  if (!device) throw data(GENERIC_ERROR, { status: 403 });
  await checkRateLimit(request, device.id);
  const [entry] = await db
    .select({
      childId: childProfiles.id,
      pinHash: childCredentials.pinHash,
      failedAttempts: childCredentials.failedAttempts,
      lockedUntil: childCredentials.lockedUntil,
    })
    .from(childProfiles)
    .innerJoin(
      childCredentials,
      and(
        eq(childCredentials.childId, childProfiles.id),
        eq(childCredentials.familyId, childProfiles.familyId),
      ),
    )
    .where(
      and(
        eq(childProfiles.id, childId),
        eq(childProfiles.familyId, device.familyId),
        eq(childProfiles.status, "active"),
      ),
    )
    .limit(1);
  if (!entry || (entry.lockedUntil && entry.lockedUntil > new Date()))
    throw data(GENERIC_ERROR, { status: 401 });
  if (!(await verifyChildPin(entry.pinHash, pin))) {
    const attempts = entry.failedAttempts + 1;
    const lock = childLockDuration(attempts);
    await db
      .update(childCredentials)
      .set({
        failedAttempts: attempts,
        lastFailedAt: new Date(),
        lockedUntil: lock ? new Date(Date.now() + lock) : null,
      })
      .where(
        and(eq(childCredentials.childId, childId), eq(childCredentials.familyId, device.familyId)),
      );
    await recordRateFailure(request, device.id);
    if (lock) {
      await db.insert(auditLogs).values({
        id: uuidv7(),
        familyId: device.familyId,
        actorType: "child",
        actorChildId: childId,
        action: "child.pin_locked",
        targetType: "child",
        targetId: childId,
        result: "denied",
        metadataJson: JSON.stringify({
          lockLevel: attempts >= 7 ? "long" : attempts === 6 ? "medium" : "short",
        }),
      });
    }
    throw data(GENERIC_ERROR, { status: 401 });
  }
  const token = createSecret();
  const csrf = createSecret();
  const sessionId = uuidv7();
  await db.transaction(async (tx) => {
    await tx
      .update(childCredentials)
      .set({ failedAttempts: 0, lastFailedAt: null, lockedUntil: null })
      .where(eq(childCredentials.childId, childId));
    await tx.insert(childSessions).values({
      id: sessionId,
      familyId: device.familyId,
      childId,
      deviceAuthorizationId: device.id,
      tokenHash: hashSecret(token),
      csrfSecretHash: hashSecret(csrf),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME),
      lastSeenAt: new Date(),
    });
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId: device.familyId,
      actorType: "child",
      actorChildId: childId,
      action: "child.session_created",
      targetType: "child_session",
      targetId: sessionId,
      result: "success",
    });
    await tx
      .update(childDeviceAuthorizations)
      .set({ lastUsedAt: new Date() })
      .where(eq(childDeviceAuthorizations.id, device.id));
  });
  return {
    sessionCookie: await childSessionCookie.serialize(token),
    csrfCookie: await childCsrfCookie.serialize(csrf),
  };
}

export async function getChildContext(request: Request) {
  const token = await readCookie(childSessionCookie, request);
  if (!token) return null;
  const [context] = await db
    .select({
      sessionId: childSessions.id,
      childId: childSessions.childId,
      familyId: childSessions.familyId,
      deviceId: childSessions.deviceAuthorizationId,
      csrfHash: childSessions.csrfSecretHash,
      alias: childProfiles.alias,
      avatarKey: childProfiles.avatarKey,
      profileColor: childProfiles.profileColor,
    })
    .from(childSessions)
    .innerJoin(
      childProfiles,
      and(
        eq(childSessions.childId, childProfiles.id),
        eq(childSessions.familyId, childProfiles.familyId),
      ),
    )
    .innerJoin(
      childDeviceAuthorizations,
      and(
        eq(childSessions.deviceAuthorizationId, childDeviceAuthorizations.id),
        eq(childSessions.familyId, childDeviceAuthorizations.familyId),
      ),
    )
    .innerJoin(families, eq(childSessions.familyId, families.id))
    .where(
      and(
        eq(childSessions.tokenHash, hashSecret(token)),
        isNull(childSessions.revokedAt),
        gt(childSessions.expiresAt, new Date()),
        eq(childProfiles.status, "active"),
        isNull(childDeviceAuthorizations.revokedAt),
        gt(childDeviceAuthorizations.expiresAt, new Date()),
        eq(families.status, "active"),
      ),
    )
    .limit(1);
  return context ?? null;
}

export async function requireChildContext(request: Request) {
  const context = await getChildContext(request);
  if (!context) throw data("Sesión infantil no válida", { status: 401 });
  return context;
}

export async function requireChildCsrf(request: Request, submitted: unknown) {
  const context = await requireChildContext(request);
  const cookie = await readCookie(childCsrfCookie, request);
  if (
    !cookie ||
    typeof submitted !== "string" ||
    cookie !== submitted ||
    hashSecret(cookie) !== context.csrfHash
  )
    throw data("Solicitud no permitida", { status: 403 });
  return context;
}

export async function revokeCurrentChildSession(request: Request) {
  const context = await getChildContext(request);
  if (context)
    await db
      .update(childSessions)
      .set({ revokedAt: new Date() })
      .where(eq(childSessions.id, context.sessionId));
}
