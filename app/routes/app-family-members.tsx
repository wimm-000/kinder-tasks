import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-members";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { listMembers } from "~/services/families/families.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await listMembers(session.auth.user.id, params.familyId)),
  };
}
export default function Members() {
  const page = useLoaderData<typeof loader>();
  return (
    <AppPage
      name={page.name}
      title={t("family.members")}
      description={t("family.members.description")}
    >
      <div className="space-y-3">
        {page.members.map((member) => (
          <article
            className="flex items-center gap-4 rounded-3xl border bg-card/80 p-5"
            key={member.id}
          >
            <span className="grid size-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {member.name.charAt(0)}
            </span>
            <div>
              <h2 className="font-bold">{member.name}</h2>
              <p className="text-sm text-muted-foreground">{member.email}</p>
            </div>
          </article>
        ))}
      </div>
      <Button className="mt-6" variant="ghost" asChild>
        <Link to={`/app/${page.context.familyId}`}>{t("family.back")}</Link>
      </Button>
    </AppPage>
  );
}
