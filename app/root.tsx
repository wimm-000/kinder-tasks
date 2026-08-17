import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useEffect } from "react";

import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import { t } from "./lib/i18n";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "icon", href: "/app-icon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-180x180.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#174b4a" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = t("error.defaultTitle");
  let details = t("error.defaultDescription");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? t("error.notFoundTitle") : t("error.responseTitle");
    details = error.status === 404 ? t("error.notFoundDescription") : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-primary">Kinder Tasks</p>
      <h1 className="font-display text-4xl font-semibold text-foreground">{message}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{details}</p>
      <a className="mt-8 font-semibold text-primary underline underline-offset-4" href="/">
        {t("error.backHome")}
      </a>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
