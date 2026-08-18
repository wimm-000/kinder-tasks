import { ClipboardCheck, ListChecks, MailPlus, Shield, Smile, Users } from "lucide-react";
import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-dashboard";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireFamilyParent } from "~/services/families/families.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  const family = await requireFamilyParent(session.auth.user.id, params.familyId);
  return { name: session.auth.user.name, family };
}
export default function FamilyDashboard() {
  const page = useLoaderData<typeof loader>();
  return (
    <AppPage
      name={page.name}
      title={page.family.familyName}
      description={t("family.dashboard.description")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-[1.75rem] border bg-card/80 p-7">
          <Users className="size-7 text-primary" />
          <h2 className="mt-6 font-display text-2xl font-semibold">{t("family.members")}</h2>
          <Button className="mt-6" variant="outline" asChild>
            <Link to={`/app/${page.family.familyId}/members`}>{t("family.members")}</Link>
          </Button>
        </article>
        <article className="rounded-[1.75rem] border bg-card/80 p-7">
          <ListChecks className="size-7 text-primary" />
          <h2 className="mt-6 font-display text-2xl font-semibold">{t("tasks.title")}</h2>
          <Button className="mt-6" variant="outline" asChild>
            <Link to={`/app/${page.family.familyId}/tasks`}>{t("tasks.title")}</Link>
          </Button>
        </article>
        <article className="rounded-[1.75rem] border bg-card/80 p-7">
          <ClipboardCheck className="size-7 text-secondary" />
          <h2 className="mt-6 font-display text-2xl font-semibold">{t("tasks.requests.title")}</h2>
          <Button className="mt-6" variant="outline" asChild>
            <Link to={`/app/${page.family.familyId}/requests`}>{t("tasks.requests.title")}</Link>
          </Button>
        </article>
        <article className="rounded-[1.75rem] border bg-card/80 p-7">
          <Smile className="size-7 text-primary" />
          <h2 className="mt-6 font-display text-2xl font-semibold">{t("children.title")}</h2>
          <Button className="mt-6" variant="outline" asChild>
            <Link to={`/app/${page.family.familyId}/children`}>{t("children.title")}</Link>
          </Button>
        </article>
        <article className="rounded-[1.75rem] border bg-card/80 p-7">
          <MailPlus className="size-7 text-secondary" />
          <h2 className="mt-6 font-display text-2xl font-semibold">{t("family.invitations")}</h2>
          <Button className="mt-6" variant="outline" asChild>
            <Link to={`/app/${page.family.familyId}/invitations`}>{t("family.invitations")}</Link>
          </Button>
        </article>
        <article className="rounded-[1.75rem] border bg-card/80 p-7">
          <Shield className="size-7 text-secondary" />
          <h2 className="mt-6 font-display text-2xl font-semibold">Privacidad familiar</h2>
          <Button className="mt-6" variant="outline" asChild>
            <Link to={`/app/${page.family.familyId}/privacy`}>Gestionar datos</Link>
          </Button>
        </article>
      </div>
    </AppPage>
  );
}
