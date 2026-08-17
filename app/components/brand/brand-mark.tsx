import { Sprout } from "lucide-react";

import { cn } from "~/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-10 rotate-[-4deg] items-center justify-center rounded-[1rem] bg-accent text-accent-foreground shadow-sm",
        className,
      )}
    >
      <Sprout className="size-5" strokeWidth={2.5} />
    </span>
  );
}
