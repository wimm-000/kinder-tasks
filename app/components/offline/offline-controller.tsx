import { useCallback, useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  clearOfflineData,
  isOfflineEnabled,
  listQueuedCompletions,
  saveSnapshot,
  setOfflineEnabled,
  updateCompletionStatus,
  type OfflineSnapshot,
} from "~/lib/offline/database";
import { t } from "~/lib/i18n";

export function OfflineController({
  familyId,
  childId,
  csrf,
  snapshot,
}: {
  familyId: string;
  childId: string;
  csrf: string;
  snapshot?: OfflineSnapshot;
}) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "saving" | "syncing" | "synced" | "conflict" | "error"
  >("idle");

  const sync = useCallback(async () => {
    if (!navigator.onLine || !(await isOfflineEnabled(familyId, childId))) return;
    const queued = await listQueuedCompletions();
    setStatus("syncing");
    for (const entry of queued) await updateCompletionStatus(entry.clientRequestId, "syncing");
    try {
      const response = await fetch("/api/kids/sync", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          requests: queued.map(({ clientRequestId, assignmentId }) => ({
            clientRequestId,
            assignmentId,
          })),
        }),
      });
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("kinder-offline-active-key");
        await clearOfflineData();
        setEnabled(false);
        throw new Error("session_invalid");
      }
      if (!response.ok) throw new Error("sync_failed");
      const payload = (await response.json()) as {
        results: Array<{
          clientRequestId: string;
          status: "synced" | "conflict" | "failed";
          errorCode?: string;
        }>;
      };
      for (const result of payload.results) {
        await updateCompletionStatus(result.clientRequestId, result.status, result.errorCode);
      }
      setStatus(
        payload.results.some((result) => result.status === "conflict") ? "conflict" : "synced",
      );
    } catch {
      for (const entry of queued) {
        await updateCompletionStatus(entry.clientRequestId, "failed", "network");
      }
      setStatus("error");
    }
  }, [childId, csrf, familyId]);

  useEffect(() => {
    void isOfflineEnabled(familyId, childId).then(async (current) => {
      setEnabled(current);
      if (current) {
        sessionStorage.setItem("kinder-offline-active-key", `${familyId}:${childId}`);
        if (snapshot) await saveSnapshot(snapshot);
        await sync();
      }
    });
    const handleSync = () => void sync();
    window.addEventListener("online", handleSync);
    window.addEventListener("focus", handleSync);
    window.addEventListener("kinder:offline-queued", handleSync);
    return () => {
      window.removeEventListener("online", handleSync);
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("kinder:offline-queued", handleSync);
    };
  }, [childId, familyId, snapshot, sync]);

  const changePreference = async (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    setStatus("saving");
    try {
      const response = await fetch("/api/kids/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf,
          "x-offline-operation": "preference",
        },
        body: JSON.stringify({ enabled: next }),
      });
      if (!response.ok) throw new Error("preference_failed");
      if (next) {
        await setOfflineEnabled(familyId, childId, true);
        sessionStorage.setItem("kinder-offline-active-key", `${familyId}:${childId}`);
        if (snapshot) await saveSnapshot(snapshot);
      } else {
        sessionStorage.removeItem("kinder-offline-active-key");
        await clearOfflineData();
      }
      setStatus("idle");
    } catch {
      setEnabled(previous);
      setStatus("error");
    }
  };

  return (
    <section className="mt-5 rounded-3xl border bg-card/90 p-6" aria-labelledby="offline-title">
      <h2 className="font-display text-2xl font-semibold" id="offline-title">
        {t("offline.title")}
      </h2>
      <p className="mt-2 leading-7 text-muted-foreground">{t("offline.description")}</p>
      <label className="mt-5 flex min-h-11 items-center gap-3 font-bold">
        <input
          type="checkbox"
          checked={enabled}
          disabled={status === "saving"}
          onChange={(event) => void changePreference(event.target.checked)}
        />
        {t("offline.remember")}
      </label>
      {enabled ? (
        <Button className="mt-4" variant="outline" onClick={() => void sync()}>
          {t("offline.retry")}
        </Button>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground" role="status">
        {status === "syncing" ? t("offline.syncing") : null}
        {status === "synced" ? t("offline.synced") : null}
        {status === "conflict" ? t("offline.conflict") : null}
        {status === "error" ? t("offline.error") : null}
      </p>
    </section>
  );
}
