import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { BrandMark } from "~/components/brand/brand-mark";
import { Button } from "~/components/ui/button";
import { t } from "~/lib/i18n";

interface LegalPageProps {
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}

export function LegalPage({ title, intro, sections }: LegalPageProps) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      <Link
        className="inline-flex min-h-11 items-center gap-3 rounded-lg"
        to="/"
        aria-label={t("app.name")}
      >
        <BrandMark />
        <span className="font-display text-xl font-bold">{t("app.name")}</span>
      </Link>
      <article className="mt-12 rounded-[2rem] border bg-card/80 p-7 shadow-lift sm:p-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-2xl font-semibold">{section.title}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
        <Button className="mt-10" variant="outline" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" />
            {t("legal.back")}
          </Link>
        </Button>
      </article>
    </main>
  );
}
