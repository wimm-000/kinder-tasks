import { createHmac } from "node:crypto";
import { v7 as uuidv7 } from "uuid";

import { db } from "~/lib/db/client.server";
import { auditLogs } from "~/lib/db/schema";
import { getServerEnv } from "~/lib/env.server";

type AuditActor =
  | { type: "system" }
  | { type: "user" | "superadmin"; userId: string }
  | { type: "child"; childId: string };

interface WriteAuditLogInput {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId?: string;
  familyId?: string;
  result: "success" | "denied" | "failure";
  metadata?: Record<string, boolean | number | string | null>;
  request?: Request;
}

function requestMetadata(request: Request | undefined) {
  if (!request) return {};

  const ip = request.headers.get("x-nf-client-connection-ip");
  const ipHash = ip
    ? createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET).update(ip).digest("hex")
    : undefined;

  return {
    ipHash,
    requestId: request.headers.get("x-nf-request-id") ?? uuidv7(),
  };
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await db.insert(auditLogs).values({
    id: uuidv7(),
    familyId: input.familyId,
    actorType: input.actor.type,
    actorUserId: "userId" in input.actor ? input.actor.userId : undefined,
    actorChildId: "childId" in input.actor ? input.actor.childId : undefined,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    result: input.result,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    ...requestMetadata(input.request),
  });
}
