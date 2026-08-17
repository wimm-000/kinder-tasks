import { Link } from "react-router";

import { BrandMark } from "~/components/brand/brand-mark";
import { t } from "~/lib/i18n";

interface AuthPageProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthPage({ eyebrow, title, description, children, footer }: AuthPageProps) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[0.8fr_1.2fr]">
      <div className="flex flex-col px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <Link className="flex min-h-11 w-fit items-center gap-3 rounded-lg" to="/">
          <BrandMark />
          <span className="font-display text-xl font-bold">{t("app.name")}</span>
        </Link>
        <div className="my-auto w-full max-w-lg py-12 lg:mx-auto">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-secondary">{eyebrow}</p>
          <h1 className="mt-4 text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{description}</p>
          <div className="mt-9">{children}</div>
          {footer ? <div className="mt-8 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
      <aside className="paper-grid hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <p className="max-w-md font-display text-4xl font-semibold leading-tight">
          {t("auth.aside.quote")}
        </p>
        <div className="max-w-lg rounded-[2rem] border border-primary-foreground/20 bg-primary-foreground/10 p-7 backdrop-blur">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
            {t("auth.aside.label")}
          </p>
          <p className="mt-4 text-lg leading-8 text-primary-foreground/80">
            {t("auth.aside.description")}
          </p>
        </div>
      </aside>
    </main>
  );
}
