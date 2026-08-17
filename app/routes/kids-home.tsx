import { Coins, History } from "lucide-react";
import { Form, Link, redirect, useLoaderData } from "react-router";

import type { Route } from "./+types/kids-home";
import { ProfileAvatar } from "~/components/children/profile-avatar";
import { KidsPage } from "~/components/layout/kids-page";
import { Button } from "~/components/ui/button";
import { childCsrfCookie, clearChildCookies, readCookie } from "~/lib/auth/child-session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import {
  requireChildContext,
  requireChildCsrf,
  revokeCurrentChildSession,
} from "~/services/children/child-auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireChildContext(request);
  const csrf = await readCookie(childCsrfCookie, request);
  return { context, csrf };
}
export async function action({ request }: Route.ActionArgs) {
  requireSameOrigin(request);
  const form = Object.fromEntries(await request.formData());
  await requireChildCsrf(request, form._csrf);
  await revokeCurrentChildSession(request);
  const leave = form.intent === "leave";
  const headers = new Headers();
  for (const value of await clearChildCookies(leave)) headers.append("set-cookie", value);
  throw redirect(leave ? "/" : "/kids", { headers });
}
export default function KidsHome() {
  const page = useLoaderData<typeof loader>();
  return (
    <KidsPage
      title={`${page.context.alias}, ${t("kids.home.title").toLowerCase()}`}
      description={t("kids.home.description")}
    >
      <section className="rounded-[2rem] border bg-card/90 p-7 shadow-sm">
        <ProfileAvatar
          avatar={page.context.avatarKey}
          color={page.context.profileColor}
          className="size-20"
        />
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Form method="post">
            <input type="hidden" name="_csrf" value={page.csrf ?? ""} />
            <input type="hidden" name="intent" value="switch" />
            <Button className="w-full" type="submit">
              {t("kids.switch")}
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="_csrf" value={page.csrf ?? ""} />
            <input type="hidden" name="intent" value="leave" />
            <Button className="w-full" type="submit" variant="outline">
              {t("kids.leave")}
            </Button>
          </Form>
        </div>
      </section>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Link className="rounded-3xl border bg-card/90 p-6" to="/kids/wallet">
          <Coins className="size-7 text-primary" />
          <h2 className="mt-5 font-display text-2xl font-semibold">{t("kids.wallet")}</h2>
        </Link>
        <Link className="rounded-3xl border bg-card/90 p-6" to="/kids/history">
          <History className="size-7 text-secondary" />
          <h2 className="mt-5 font-display text-2xl font-semibold">{t("kids.history")}</h2>
        </Link>
      </div>
    </KidsPage>
  );
}
