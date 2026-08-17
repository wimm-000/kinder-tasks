import { BrandMark } from "~/components/brand/brand-mark";
import { t } from "~/lib/i18n";

export function KidsPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_hsl(var(--accent)/0.3),_transparent_45%)]">
      <header className="px-5 py-5">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <BrandMark />
          <span className="font-display text-xl font-bold">{t("app.name")}</span>
          <span className="ml-auto rounded-full bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
            {t("kids.mode")}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:pt-12">
        <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">{description}</p>
        <div className="mt-9">{children}</div>
      </main>
    </div>
  );
}
