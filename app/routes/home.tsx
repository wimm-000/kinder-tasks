import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  History,
  LockKeyhole,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router";

import { BrandMark } from "~/components/brand/brand-mark";
import { NetworkStatus } from "~/components/feedback/network-status";
import { Button } from "~/components/ui/button";
import { t, type MessageKey } from "~/lib/i18n";

const trustMessageKeys = [
  "home.trust.private",
  "home.trust.noAds",
  "home.trust.installable",
] satisfies MessageKey[];

export function meta() {
  return [
    { title: `${t("app.name")} | ${t("app.tagline")}` },
    { name: "description", content: t("home.description") },
  ];
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link
          className="flex min-h-11 items-center gap-3 rounded-lg"
          to="/"
          aria-label={t("app.name")}
        >
          <BrandMark />
          <span className="font-display text-xl font-bold tracking-tight">{t("app.name")}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.mainLabel")}>
          <Button variant="ghost" asChild>
            <a href="#como-funciona">{t("nav.howItWorks")}</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="#familia">{t("nav.values")}</a>
          </Button>
        </nav>
        <div className="flex items-center gap-2">
          <Button className="hidden sm:inline-flex" variant="ghost" asChild>
            <Link to="/login">{t("nav.login")}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/register">{t("nav.register")}</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:pb-32 lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-primary shadow-sm">
              <Sparkles className="size-4 text-secondary" />
              {t("home.eyebrow")}
            </p>
            <h1 className="max-w-3xl text-balance font-display text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              {t("home.title")}
            </h1>
            <p className="mt-7 max-w-2xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl">
              {t("home.description")}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/register">
                  {t("home.primaryCta")}
                  <ArrowRight className="size-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#como-funciona">{t("home.secondaryCta")}</a>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-muted-foreground">
              {trustMessageKeys.map((key) => (
                <li className="flex items-center gap-2" key={key}>
                  <Check className="size-4 text-primary" strokeWidth={3} />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>

          <DashboardPreview />
        </section>

        <section id="como-funciona" className="border-y bg-card/65 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-secondary">
                  {t("home.steps.eyebrow")}
                </p>
                <h2 className="mt-4 max-w-2xl text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                  {t("home.steps.title")}
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
                {t("home.steps.description")}
              </p>
            </div>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              <StepCard
                number="01"
                icon={ClipboardCheck}
                title={t("home.steps.assign.title")}
                description={t("home.steps.assign.description")}
              />
              <StepCard
                number="02"
                icon={PiggyBank}
                title={t("home.steps.complete.title")}
                description={t("home.steps.complete.description")}
              />
              <StepCard
                number="03"
                icon={CheckCircle2}
                title={t("home.steps.approve.title")}
                description={t("home.steps.approve.description")}
              />
            </div>
          </div>
        </section>

        <section id="familia" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-secondary">
                {t("home.values.eyebrow")}
              </p>
              <h2 className="mt-4 text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                {t("home.values.title")}
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                {t("home.values.description")}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ValueCard
                icon={Users}
                title={t("home.values.children.title")}
                description={t("home.values.children.description")}
              />
              <ValueCard
                icon={ShieldCheck}
                title={t("home.values.parents.title")}
                description={t("home.values.parents.description")}
              />
              <ValueCard
                className="sm:col-span-2"
                icon={WifiOff}
                title={t("home.values.offline.title")}
                description={t("home.values.offline.description")}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 sm:pb-28 lg:px-10">
          <div className="paper-grid relative overflow-hidden rounded-[2.25rem] bg-primary px-6 py-14 text-primary-foreground shadow-lift sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16">
            <div className="relative max-w-2xl">
              <h2 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                {t("home.cta.title")}
              </h2>
              <p className="mt-5 text-lg text-primary-foreground/75">{t("home.cta.description")}</p>
            </div>
            <Button
              className="relative mt-8 bg-accent text-accent-foreground hover:bg-accent/90 lg:mt-0"
              size="lg"
              asChild
            >
              <Link to="/register">
                {t("home.cta.button")}
                <ChevronRight className="size-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/50">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end lg:px-10">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark className="size-9" />
              <span className="font-display text-lg font-bold">{t("app.name")}</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              {t("footer.summary")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-sm font-semibold">
            <Link className="rounded underline-offset-4 hover:underline" to="/privacy">
              {t("footer.privacy")}
            </Link>
            <Link className="rounded underline-offset-4 hover:underline" to="/terms">
              {t("footer.terms")}
            </Link>
            <NetworkStatus />
          </div>
        </div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-2xl lg:mr-0">
      <div className="absolute -left-8 top-10 size-24 rounded-full bg-accent/60 blur-2xl" />
      <div className="absolute -right-8 bottom-8 size-32 rounded-full bg-secondary/40 blur-3xl" />
      <div className="relative rotate-[1.2deg] rounded-[2rem] border bg-card p-3 shadow-lift sm:p-5">
        <div className="rounded-[1.45rem] bg-primary p-5 text-primary-foreground sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground/60">
                {t("home.preview.family")}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold">
                {t("home.preview.greeting")}
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-accent-foreground">
              P
            </span>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl bg-primary-foreground p-5 text-foreground">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  {t("home.preview.balance")}
                </span>
                <CircleDollarSign className="size-5 text-secondary" />
              </div>
              <p className="mt-4 font-display text-4xl font-semibold tracking-tight">
                {t("home.preview.amount")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{t("home.preview.updated")}</p>
            </div>
            <div className="rounded-3xl bg-accent p-5 text-accent-foreground">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                  {t("home.preview.taskLabel")}
                </span>
                <ClipboardCheck className="size-5" />
              </div>
              <p className="mt-5 font-display text-xl font-semibold leading-tight">
                {t("home.preview.task")}
              </p>
              <p className="mt-2 font-bold">{t("home.preview.reward")}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 px-2 pb-2 pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/70 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
              <CheckCircle2 className="size-5" />
            </span>
            <p className="text-sm font-semibold leading-5">{t("home.preview.pending")}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-muted/70 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <History className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{t("home.preview.movement")}</p>
              <p className="text-sm font-bold text-muted-foreground">
                {t("home.preview.movementAmount")}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 flex rotate-[-5deg] items-center gap-2 rounded-full border bg-card px-4 py-3 text-sm font-bold shadow-lg sm:-left-8">
        <LockKeyhole className="size-4 text-primary" />
        {t("home.trust.private")}
      </div>
    </div>
  );
}

function StepCard({
  number,
  icon: Icon,
  title,
  description,
}: {
  number: string;
  icon: typeof ClipboardCheck;
  title: string;
  description: string;
}) {
  return (
    <article className="group rounded-[1.75rem] border bg-background/70 p-6 transition-transform hover:-translate-y-1 sm:p-7">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold text-muted-foreground">{number}</span>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Icon className="size-6" />
        </span>
      </div>
      <h3 className="mt-8 font-display text-2xl font-semibold">{title}</h3>
      <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
    </article>
  );
}

function ValueCard({
  icon: Icon,
  title,
  description,
  className = "",
}: {
  icon: typeof Users;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <article className={`rounded-[1.75rem] border bg-card/75 p-6 shadow-sm sm:p-7 ${className}`}>
      <Icon className="size-7 text-secondary" />
      <h3 className="mt-8 font-display text-2xl font-semibold">{title}</h3>
      <p className="mt-3 max-w-xl leading-7 text-muted-foreground">{description}</p>
    </article>
  );
}
