import { useState } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { enqueueCompletion, isOfflineEnabled } from "~/lib/offline/database";
import { t } from "~/lib/i18n";

export function OfflineCompletionForm({
  familyId,
  childId,
  assignmentId,
  clientRequestId,
  csrf,
  label,
}: {
  familyId: string;
  childId: string;
  assignmentId: string;
  clientRequestId: string;
  csrf: string;
  label: string;
}) {
  const fetcher = useFetcher();
  const [message, setMessage] = useState<string>();
  const response = fetcher.data as { success?: string; error?: string } | undefined;

  const submit = async () => {
    if (navigator.onLine) {
      await fetcher.submit({ _csrf: csrf, assignmentId, clientRequestId }, { method: "post" });
      return;
    }
    if (!(await isOfflineEnabled(familyId, childId))) {
      setMessage(t("offline.enableFirst"));
      return;
    }
    await enqueueCompletion({ familyId, childId, assignmentId, clientRequestId });
    setMessage(t("offline.queued"));
    window.dispatchEvent(new Event("kinder:offline-queued"));
  };

  return (
    <div className="mt-5">
      <Button type="button" disabled={fetcher.state !== "idle"} onClick={() => void submit()}>
        {label}
      </Button>
      {message || response?.success || response?.error ? (
        <p className="mt-3 text-sm font-semibold" role="status">
          {message ?? response?.success ?? response?.error}
        </p>
      ) : null}
    </div>
  );
}
