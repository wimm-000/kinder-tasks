import { House, LogOut, Shield, UserRound } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";

import { BrandMark } from "~/components/brand/brand-mark";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth/auth-client";
import { t } from "~/lib/i18n";
import { cn } from "~/lib/utils";

interface AppPageProps {
  name: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

const navigation = [
  { to: "/app/families", label: t("appNav.families"), icon: House },
  { to: "/app/profile", label: t("appNav.profile"), icon: UserRound },
  { to: "/app/security", label: t("appNav.security"), icon: Shield },
];

export function AppPage({ name, title, description, children }: AppPageProps) {
  const navigate = useNavigate();

  const signOut = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card/75 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            aria-label={t("app.name")}
            className="flex min-h-11 items-center gap-3 rounded-lg"
            to="/app"
          >
            <BrandMark />
            <span className="hidden font-display text-xl font-bold sm:inline">{t("app.name")}</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label={t("appNav.accountLabel")}>
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                aria-label={label}
                className={({ isActive }) =>
                  cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold transition-colors hover:bg-muted sm:px-4",
                    isActive && "bg-muted",
                  )
                }
                key={to}
                to={to}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
            <Button aria-label={t("appNav.logout")} size="sm" variant="ghost" onClick={signOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t("appNav.logout")}</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-secondary">
          {t("appNav.hello")}, {name}
        </p>
        <h1 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}
