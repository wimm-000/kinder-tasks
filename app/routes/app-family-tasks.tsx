import { ArrowLeft } from "lucide-react";
import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-tasks";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { formatMoney } from "~/domain/money/money";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { listFamilyTasks } from "~/services/tasks/tasks.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await listFamilyTasks(session.auth.user.id, params.familyId)),
  };
}
export default function FamilyTasks() {
  const page = useLoaderData<typeof loader>();
  return (
    <AppPage name={page.name} title={t("tasks.title")} description={t("tasks.description")}>
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" asChild>
          <Link to={`/app/${page.context.familyId}`}>
            <ArrowLeft className="size-4" />
            {t("tasks.backToFamily")}
          </Link>
        </Button>
        <Button asChild>
          <Link to={`/app/${page.context.familyId}/tasks/new`}>{t("tasks.create")}</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {page.tasks.map((task) => (
          <article className="rounded-3xl border bg-card/80 p-6" key={task.id}>
            <p className="text-sm font-bold uppercase tracking-wider text-secondary">{task.type}</p>
            <h2 className="mt-3 font-display text-2xl font-semibold">{task.title}</h2>
            <p className="mt-4 font-bold">{formatMoney(task.rewardCents)}</p>
            <Button className="mt-5" variant="outline" asChild>
              <Link to={`/app/${page.context.familyId}/tasks/${task.id}/edit`}>
                {t("tasks.form.edit")}
              </Link>
            </Button>
          </article>
        ))}
      </div>
      {!page.tasks.length ? (
        <p className="mt-6 rounded-3xl border bg-card p-6">{t("tasks.empty")}</p>
      ) : null}
    </AppPage>
  );
}
