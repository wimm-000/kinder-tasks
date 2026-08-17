import { Link, redirect, useLoaderData } from "react-router";

import type { Route } from "./+types/kids-index";
import { ProfileAvatar } from "~/components/children/profile-avatar";
import { KidsPage } from "~/components/layout/kids-page";
import { Button } from "~/components/ui/button";
import { t } from "~/lib/i18n";
import { getChildContext, listAuthorizedProfiles } from "~/services/children/child-auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (await getChildContext(request)) throw redirect("/kids/home");
  return { authorized: await listAuthorizedProfiles(request) };
}
export default function KidsIndex() {
  const page = useLoaderData<typeof loader>();
  if (!page.authorized)
    return (
      <KidsPage
        title={t("kids.unauthorized.title")}
        description={t("kids.unauthorized.description")}
      >
        <Button asChild>
          <Link to="/login">{t("kids.adultLogin")}</Link>
        </Button>
      </KidsPage>
    );
  return (
    <KidsPage title={t("kids.selector.title")} description={t("kids.selector.description")}>
      <div className="grid gap-4 sm:grid-cols-2">
        {page.authorized.profiles.map((profile) => (
          <Link
            className="flex min-h-24 items-center gap-4 rounded-3xl border bg-card/90 p-5 text-left shadow-sm transition hover:-translate-y-1 focus-visible:ring-2"
            key={profile.id}
            to={`/kids/unlock/${profile.id}`}
          >
            <ProfileAvatar avatar={profile.avatarKey} color={profile.profileColor} />
            <span className="font-display text-2xl font-semibold">{profile.alias}</span>
          </Link>
        ))}
      </div>
    </KidsPage>
  );
}
