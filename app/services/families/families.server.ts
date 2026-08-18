import { createHash, randomBytes } from "node:crypto";

import { and, asc, eq, gt } from "drizzle-orm";
import { data } from "react-router";
import { v7 as uuidv7 } from "uuid";

import { db } from "~/lib/db/client.server";
import { auditLogs, families, familyInvitations, familyMembers, user } from "~/lib/db/schema";
import { getServerEnv } from "~/lib/env.server";
import { EmailDeliveryError } from "~/services/email/email-service.server";
import { sendEmail } from "~/services/email/email.server";

const INVITATION_LIFETIME = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function auditValues(input: {
  userId: string;
  familyId: string;
  action: string;
  targetType: string;
  targetId: string;
}) {
  return {
    id: uuidv7(),
    familyId: input.familyId,
    actorType: "user",
    actorUserId: input.userId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    result: "success",
  } as const;
}

export async function listFamilies(userId: string) {
  return db
    .select({ id: families.id, name: families.name, currency: families.currency })
    .from(familyMembers)
    .innerJoin(families, eq(familyMembers.familyId, families.id))
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.status, "active"),
        eq(families.status, "active"),
      ),
    )
    .orderBy(asc(families.name));
}

export async function createFamily(userId: string, name: string, clientRequestId?: string) {
  if (clientRequestId) {
    const existing = await db.query.families.findFirst({
      where: and(
        eq(families.creationRequestId, clientRequestId),
        eq(families.createdByUserId, userId),
      ),
      columns: { id: true },
    });
    if (existing) return existing.id;
  }

  const familyId = uuidv7();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(families).values({
        id: familyId,
        name,
        createdByUserId: userId,
        creationRequestId: clientRequestId,
      });
      await tx.insert(familyMembers).values({ id: uuidv7(), familyId, userId });
      await tx.insert(auditLogs).values(
        auditValues({
          userId,
          familyId,
          action: "family.created",
          targetType: "family",
          targetId: familyId,
        }),
      );
    });
  } catch (error) {
    const repeated = clientRequestId
      ? await db.query.families.findFirst({
          where: and(
            eq(families.creationRequestId, clientRequestId),
            eq(families.createdByUserId, userId),
          ),
          columns: { id: true },
        })
      : undefined;
    if (repeated) return repeated.id;
    throw error;
  }
  return familyId;
}

export async function requireFamilyParent(userId: string, familyId: string) {
  const [context] = await db
    .select({
      familyId: families.id,
      familyName: families.name,
      currency: families.currency,
      timezone: families.timezone,
      membershipId: familyMembers.id,
    })
    .from(familyMembers)
    .innerJoin(families, eq(familyMembers.familyId, families.id))
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId),
        eq(familyMembers.role, "parent"),
        eq(familyMembers.status, "active"),
        eq(families.status, "active"),
      ),
    )
    .limit(1);

  if (!context) throw data("Familia no encontrada", { status: 404 });
  return context;
}

export async function listMembers(userId: string, familyId: string) {
  const context = await requireFamilyParent(userId, familyId);
  const members = await db
    .select({
      id: familyMembers.id,
      name: user.name,
      email: user.email,
      joinedAt: familyMembers.joinedAt,
    })
    .from(familyMembers)
    .innerJoin(user, eq(familyMembers.userId, user.id))
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.status, "active")))
    .orderBy(asc(user.name));
  return { context, members };
}

export async function listInvitations(userId: string, familyId: string) {
  const context = await requireFamilyParent(userId, familyId);
  const invitations = await db
    .select({
      id: familyInvitations.id,
      email: familyInvitations.emailNormalized,
      status: familyInvitations.status,
      expiresAt: familyInvitations.expiresAt,
    })
    .from(familyInvitations)
    .where(eq(familyInvitations.familyId, familyId))
    .orderBy(asc(familyInvitations.createdAt));
  return { context, invitations };
}

export async function inviteParent(input: {
  userId: string;
  inviterName: string;
  familyId: string;
  email: string;
}) {
  const context = await requireFamilyParent(input.userId, input.familyId);
  const existingMember = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .innerJoin(user, eq(familyMembers.userId, user.id))
    .where(
      and(
        eq(familyMembers.familyId, input.familyId),
        eq(familyMembers.status, "active"),
        eq(user.email, input.email),
      ),
    )
    .limit(1);
  if (existingMember.length) throw data("Esta persona ya pertenece a la familia.", { status: 409 });

  const token = randomBytes(32).toString("base64url");
  const invitationId = uuidv7();
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(familyInvitations).values({
        id: invitationId,
        familyId: input.familyId,
        emailNormalized: input.email,
        tokenHash: hashToken(token),
        invitedByUserId: input.userId,
        expiresAt,
      });
      await tx.insert(auditLogs).values(
        auditValues({
          userId: input.userId,
          familyId: input.familyId,
          action: "invitation.created",
          targetType: "invitation",
          targetId: invitationId,
        }),
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      throw data("Ya existe una invitación pendiente para este correo.", { status: 409 });
    }
    throw error;
  }

  const invitationUrl = new URL(`/invite/${token}`, getServerEnv().APP_URL).toString();
  try {
    await sendEmail({
      to: input.email,
      subject: `Invitación a ${context.familyName}`,
      text: `${input.inviterName} te ha invitado a compartir ${context.familyName} en Kinder Tasks. La invitación caduca en 7 días: ${invitationUrl}`,
    });
  } catch (error) {
    const providerStatus = error instanceof EmailDeliveryError ? error.status : undefined;
    await db.transaction(async (tx) => {
      await tx
        .update(familyInvitations)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(
          and(
            eq(familyInvitations.id, invitationId),
            eq(familyInvitations.familyId, input.familyId),
            eq(familyInvitations.status, "pending"),
          ),
        );
      await tx.insert(auditLogs).values({
        id: uuidv7(),
        familyId: input.familyId,
        actorType: "user",
        actorUserId: input.userId,
        action: "invitation.delivery_failed",
        targetType: "invitation",
        targetId: invitationId,
        result: "failure",
        metadataJson: providerStatus ? JSON.stringify({ providerStatus }) : undefined,
      });
    });
    console.warn(
      JSON.stringify({
        event: "invitation_delivery_failed",
        invitationId,
        providerStatus,
      }),
    );
    throw data(
      "No pudimos enviar la invitación. Revisa el remitente o el dominio configurado en Resend e inténtalo de nuevo.",
      { status: 502 },
    );
  }
}

export async function revokeInvitation(userId: string, familyId: string, invitationId: string) {
  await requireFamilyParent(userId, familyId);
  const changed = await db.transaction(async (tx) => {
    const result = await tx
      .update(familyInvitations)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(
        and(
          eq(familyInvitations.id, invitationId),
          eq(familyInvitations.familyId, familyId),
          eq(familyInvitations.status, "pending"),
        ),
      )
      .returning({ id: familyInvitations.id });
    if (!result.length) return false;
    await tx.insert(auditLogs).values(
      auditValues({
        userId,
        familyId,
        action: "invitation.revoked",
        targetType: "invitation",
        targetId: invitationId,
      }),
    );
    return true;
  });
  if (!changed) throw data("La invitación ya no está disponible.", { status: 409 });
}

export async function deleteRevokedInvitation(
  userId: string,
  familyId: string,
  invitationId: string,
) {
  await requireFamilyParent(userId, familyId);
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(familyInvitations)
      .where(
        and(
          eq(familyInvitations.id, invitationId),
          eq(familyInvitations.familyId, familyId),
          eq(familyInvitations.status, "revoked"),
        ),
      )
      .returning({ id: familyInvitations.id });
    if (!deleted.length) throw data("Invitación revocada no encontrada.", { status: 404 });
    await tx.insert(auditLogs).values(
      auditValues({
        userId,
        familyId,
        action: "invitation.deleted",
        targetType: "invitation",
        targetId: invitationId,
      }),
    );
  });
}

export async function getInvitation(token: string) {
  const [invitation] = await db
    .select({
      id: familyInvitations.id,
      familyId: familyInvitations.familyId,
      familyName: families.name,
      email: familyInvitations.emailNormalized,
      status: familyInvitations.status,
      expiresAt: familyInvitations.expiresAt,
    })
    .from(familyInvitations)
    .innerJoin(families, eq(familyInvitations.familyId, families.id))
    .where(eq(familyInvitations.tokenHash, hashToken(token)))
    .limit(1);
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= new Date())
    return null;
  return invitation;
}

export async function acceptInvitation(token: string, userId: string, email: string) {
  const invitation = await getInvitation(token);
  if (!invitation) throw data("La invitación no es válida o ha caducado.", { status: 410 });
  if (invitation.email !== email.trim().toLowerCase()) {
    throw data("Esta invitación corresponde a otra cuenta.", { status: 403 });
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: familyMembers.id, status: familyMembers.status })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, invitation.familyId), eq(familyMembers.userId, userId)))
      .limit(1);
    if (existing[0]?.status === "suspended")
      throw data("La membresía está suspendida.", { status: 403 });
    if (existing[0]) {
      await tx
        .update(familyMembers)
        .set({ status: "active", joinedAt: new Date() })
        .where(eq(familyMembers.id, existing[0].id));
    } else {
      await tx
        .insert(familyMembers)
        .values({ id: uuidv7(), familyId: invitation.familyId, userId });
    }
    const accepted = await tx
      .update(familyInvitations)
      .set({ status: "accepted", acceptedByUserId: userId, acceptedAt: new Date() })
      .where(
        and(
          eq(familyInvitations.id, invitation.id),
          eq(familyInvitations.status, "pending"),
          gt(familyInvitations.expiresAt, new Date()),
        ),
      )
      .returning({ id: familyInvitations.id });
    if (!accepted.length) throw data("La invitación ya no está disponible.", { status: 409 });
    await tx.insert(auditLogs).values(
      auditValues({
        userId,
        familyId: invitation.familyId,
        action: "invitation.accepted",
        targetType: "invitation",
        targetId: invitation.id,
      }),
    );
  });
  return invitation.familyId;
}
