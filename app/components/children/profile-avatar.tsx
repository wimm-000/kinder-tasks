import { Bird, Cat, Heart, Rabbit, Sparkles, Star } from "lucide-react";

import { cn } from "~/lib/utils";

const icons = { bear: Heart, cat: Cat, fox: Sparkles, owl: Bird, rabbit: Rabbit, star: Star };
const colors = {
  teal: "bg-primary/15 text-primary",
  coral: "bg-secondary/15 text-secondary",
  yellow: "bg-accent/30 text-foreground",
  blue: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  green: "bg-emerald-100 text-emerald-700",
};

export function ProfileAvatar({
  avatar,
  color,
  className,
}: {
  avatar: string;
  color: string;
  className?: string;
}) {
  const Icon = icons[avatar as keyof typeof icons] ?? Star;
  return (
    <span
      className={cn(
        "grid size-14 shrink-0 place-items-center rounded-2xl",
        colors[color as keyof typeof colors] ?? colors.teal,
        className,
      )}
    >
      <Icon className="size-7" aria-hidden="true" />
    </span>
  );
}
