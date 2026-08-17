import { Cloud, CloudOff } from "lucide-react";
import { useEffect, useState } from "react";

import { t } from "~/lib/i18n";
import { cn } from "~/lib/utils";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      setHasChanged(true);
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs font-bold",
        isOnline
          ? "border-border bg-card/70 text-muted-foreground"
          : "border-secondary bg-secondary/15 text-foreground",
      )}
      title={
        hasChanged ? (isOnline ? t("network.backOnline") : t("network.lostConnection")) : undefined
      }
    >
      {isOnline ? <Cloud className="size-4" /> : <CloudOff className="size-4" />}
      <span>{isOnline ? t("network.online") : t("network.offline")}</span>
    </div>
  );
}
