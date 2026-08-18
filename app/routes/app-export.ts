import type { Route } from "./+types/app-export";
import { requireAdultSession } from "~/lib/auth/session.server";
import { exportAccountData } from "~/services/privacy/privacy.server";

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireAdultSession(request);
  const exported = await exportAccountData(context.auth.user.id, request);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(exported, null, 2), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="kinder-tasks-export-${date}.json"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
