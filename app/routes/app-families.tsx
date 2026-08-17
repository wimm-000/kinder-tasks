import { ArrowRight, Plus } from "lucide-react";
import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/app-families";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { listFamilies } from "~/services/families/families.server";

export function meta() {
  return [{ title: `${t("families.title")} | ${t("app.name")}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return { name: session.auth.user.name, families: await listFamilies(session.auth.user.id) };
}

export default function FamilySelector() {
  const page = useLoaderData<typeof loader>();
  return (
    <AppPage name={page.name} title={t("families.title")} description={t("families.description")}>
      <div className="grid gap-4 sm:grid-cols-2">
        {page.families.map((family) => (
          <article className="rounded-[1.75rem] border bg-card/80 p-7 shadow-sm" key={family.id}>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-secondary">
              {family.currency}
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold">{family.name}</h2>
            <Button className="mt-7" asChild>
              <Link to={`/app/${family.id}`}>
                {t("families.open")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
      {!page.families.length ? (
        <p className="rounded-3xl border bg-card p-7">{t("families.empty")}</p>
      ) : null}
      <Button className="mt-6" variant="outline" asChild>
        <Link to="/app/families/new">
          <Plus className="size-4" />
          {t("families.create")}
        </Link>
      </Button>
    </AppPage>
  );
}
