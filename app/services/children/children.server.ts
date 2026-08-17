import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { data } from "react-router";
import { v7 as uuidv7 } from "uuid";

import { hashChildPin } from "~/lib/auth/child-pin.server";
import { createSecret, hashSecret } from "~/lib/auth/child-session.server";
import { db } from "~/lib/db/client.server";
import {
  auditLogs,
  childCredentials,
  childDeviceAuthorizations,
  childProfiles,
  childSessions,
} from "~/lib/db/schema";
import { requireFamilyParent } from "~/services/families/families.server";

const DEVICE_LIFETIME = 90 * 24 * 60 * 60 * 1000;

function audit(
  userId: string,
  familyId: string,
  action: string,
  targetType: string,
  targetId: string,
) {
  return {
    id: uuidv7(),
    familyId,
    actorType: "user",
    actorUserId: userId,
    action,
    targetType,
    targetId,
    result: "success",
  } as const;
}

export async function listChildren(userId: string, familyId: string) {
  const context = await requireFamilyParent(userId, familyId);
  const children = await db
    .select({
      id: childProfiles.id,
      alias: childProfiles.alias,
      avatarKey: childProfiles.avatarKey,
      profileColor: childProfiles.profileColor,
      status: childProfiles.status,
    })
    .from(childProfiles)
    .where(eq(childProfiles.familyId, familyId))
    .orderBy(asc(childProfiles.alias));
  const devices = await db
    .select({
      id: childDeviceAuthorizations.id,
      name: childDeviceAuthorizations.name,
      expiresAt: childDeviceAuthorizations.expiresAt,
      lastUsedAt: childDeviceAuthorizations.lastUsedAt,
      revokedAt: childDeviceAuthorizations.revokedAt,
    })
    .from(childDeviceAuthorizations)
    .where(eq(childDeviceAuthorizations.familyId, familyId))
    .orderBy(asc(childDeviceAuthorizations.createdAt));
  return { context, children, devices };
}

export async function getChild(userId: string, familyId: string, childId: string) {
  const context = await requireFamilyParent(userId, familyId);
  const [child] = await db
    .select({
      id: childProfiles.id,
      alias: childProfiles.alias,
      avatarKey: childProfiles.avatarKey,
      profileColor: childProfiles.profileColor,
      status: childProfiles.status,
    })
    .from(childProfiles)
    .where(and(eq(childProfiles.id, childId), eq(childProfiles.familyId, familyId)))
    .limit(1);
  if (!child) throw data("Perfil no encontrado", { status: 404 });
  return { context, child };
}

export async function createChild(input: {
  userId: string;
  familyId: string;
  alias: string;
  avatarKey: string;
  profileColor: string;
  pin: string;
}) {
  await requireFamilyParent(input.userId, input.familyId);
  const childId = uuidv7();
  const pinHash = await hashChildPin(input.pin);
  await db.transaction(async (tx) => {
    await tx.insert(childProfiles).values({
      id: childId,
      familyId: input.familyId,
      alias: input.alias,
      avatarKey: input.avatarKey,
      profileColor: input.profileColor,
    });
    await tx.insert(childCredentials).values({ childId, familyId: input.familyId, pinHash });
    await tx
      .insert(auditLogs)
      .values(audit(input.userId, input.familyId, "child.created", "child", childId));
  });
  return childId;
}

export async function updateChild(input: {
  userId: string;
  familyId: string;
  childId: string;
  alias: string;
  avatarKey: string;
  profileColor: string;
}) {
  await requireFamilyParent(input.userId, input.familyId);
  const changed = await db
    .update(childProfiles)
    .set({ alias: input.alias, avatarKey: input.avatarKey, profileColor: input.profileColor })
    .where(and(eq(childProfiles.id, input.childId), eq(childProfiles.familyId, input.familyId)))
    .returning({ id: childProfiles.id });
  if (!changed.length) throw data("Perfil no encontrado", { status: 404 });
}

export async function setChildStatus(
  userId: string,
  familyId: string,
  childId: string,
  status: "active" | "disabled",
) {
  await requireFamilyParent(userId, familyId);
  await db.transaction(async (tx) => {
    const changed = await tx
      .update(childProfiles)
      .set({ status, deletedAt: status === "disabled" ? new Date() : null })
      .where(and(eq(childProfiles.id, childId), eq(childProfiles.familyId, familyId)))
      .returning({ id: childProfiles.id });
    if (!changed.length) throw data("Perfil no encontrado", { status: 404 });
    if (status === "disabled")
      await tx
        .update(childSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(childSessions.childId, childId),
            eq(childSessions.familyId, familyId),
            isNull(childSessions.revokedAt),
          ),
        );
    await tx.insert(auditLogs).values(audit(userId, familyId, `child.${status}`, "child", childId));
  });
}

export async function resetChildPin(
  userId: string,
  familyId: string,
  childId: string,
  pin: string,
) {
  await requireFamilyParent(userId, familyId);
  const pinHash = await hashChildPin(pin);
  await db.transaction(async (tx) => {
    const changed = await tx
      .update(childCredentials)
      .set({
        pinHash,
        failedAttempts: 0,
        lockedUntil: null,
        lastFailedAt: null,
        pinChangedAt: new Date(),
      })
      .where(and(eq(childCredentials.childId, childId), eq(childCredentials.familyId, familyId)))
      .returning({ childId: childCredentials.childId });
    if (!changed.length) throw data("Perfil no encontrado", { status: 404 });
    await tx
      .update(childSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(childSessions.childId, childId),
          eq(childSessions.familyId, familyId),
          isNull(childSessions.revokedAt),
        ),
      );
    await tx.insert(auditLogs).values(audit(userId, familyId, "child.pin_reset", "child", childId));
  });
}

export async function authorizeChildDevice(userId: string, familyId: string, name: string) {
  await requireFamilyParent(userId, familyId);
  const token = createSecret();
  const id = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(childDeviceAuthorizations).values({
      id,
      familyId,
      tokenHash: hashSecret(token),
      name,
      expiresAt: new Date(Date.now() + DEVICE_LIFETIME),
      authorizedByUserId: userId,
    });
    await tx
      .insert(auditLogs)
      .values(audit(userId, familyId, "child_device.authorized", "child_device", id));
  });
  return token;
}

export async function revokeChildDevice(userId: string, familyId: string, deviceId: string) {
  await requireFamilyParent(userId, familyId);
  await db.transaction(async (tx) => {
    const changed = await tx
      .update(childDeviceAuthorizations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(childDeviceAuthorizations.id, deviceId),
          eq(childDeviceAuthorizations.familyId, familyId),
          isNull(childDeviceAuthorizations.revokedAt),
          gt(childDeviceAuthorizations.expiresAt, new Date()),
        ),
      )
      .returning({ id: childDeviceAuthorizations.id });
    if (!changed.length) throw data("Dispositivo no encontrado", { status: 404 });
    await tx
      .update(childSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(childSessions.deviceAuthorizationId, deviceId), isNull(childSessions.revokedAt)),
      );
    await tx
      .insert(auditLogs)
      .values(audit(userId, familyId, "child_device.revoked", "child_device", deviceId));
  });
}
