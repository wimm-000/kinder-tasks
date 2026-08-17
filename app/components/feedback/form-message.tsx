import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "~/lib/utils";

export function FormMessage({
  message,
  variant = "error",
}: {
  message?: string;
  variant?: "error" | "success";
}) {
  if (!message) return null;
  const Icon = variant === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold",
        variant === "success"
          ? "border-primary/25 bg-primary/10"
          : "border-secondary/40 bg-secondary/10",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
