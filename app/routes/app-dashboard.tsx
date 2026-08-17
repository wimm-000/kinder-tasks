import { redirect } from "react-router";

import type { Route } from "./+types/app-dashboard";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { listFamilies } from "~/services/families/families.server";

export function meta() {
  return [{ title: `${t("dashboard.title")} | ${t("app.name")}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireAdultSession(request);
  const familyList = await listFamilies(context.auth.user.id);
  if (familyList.length === 1) throw redirect(`/app/${familyList[0]!.id}`);
  if (familyList.length === 0) throw redirect("/app/families/new");
  throw redirect("/app/families");
}

export default function Dashboard() {
  return null;
}
