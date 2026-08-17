import { data } from "react-router";

import type { Route } from "./+types/api-kids-sync";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { offlinePreferenceSchema, offlineSyncSchema } from "~/schemas/offline";
import {
  requireChildCsrf,
  setCurrentDeviceOfflineEnabled,
} from "~/services/children/child-auth.server";
import { requestTaskCompletion } from "~/services/tasks/tasks.server";

export async function action({ request }: Route.ActionArgs) {
  requireSameOrigin(request);
  const csrf = request.headers.get("x-csrf-token");
  await requireChildCsrf(request, csrf);
  const payload: unknown = await request.json();

  if (request.headers.get("x-offline-operation") === "preference") {
    const parsed = offlinePreferenceSchema.safeParse(payload);
    if (!parsed.success) return data({ error: "invalid_preference" }, { status: 400 });
    await setCurrentDeviceOfflineEnabled(request, parsed.data.enabled);
    return { enabled: parsed.data.enabled };
  }

  const parsed = offlineSyncSchema.safeParse(payload);
  if (!parsed.success) return data({ error: "invalid_sync_payload" }, { status: 400 });
  const results = [];
  for (const entry of parsed.data.requests) {
    try {
      const requestId = await requestTaskCompletion(
        request,
        entry.assignmentId,
        entry.clientRequestId,
      );
      results.push({ clientRequestId: entry.clientRequestId, status: "synced", requestId });
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "init" in error
          ? (error as { init?: { status?: number } }).init?.status
          : undefined;
      results.push({
        clientRequestId: entry.clientRequestId,
        status: status === 409 ? "conflict" : "failed",
        errorCode: status === 409 ? "not_available" : "retryable",
      });
    }
  }
  return { results };
}
