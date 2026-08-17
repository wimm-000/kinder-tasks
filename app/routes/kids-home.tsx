import { Coins, History, ListChecks } from "lucide-react";
import { Form, Link, redirect, useLoaderData } from "react-router";

import type { Route } from "./+types/kids-home";
import { ProfileAvatar } from "~/components/children/profile-avatar";
import { KidsPage } from "~/components/layout/kids-page";
import { ClearOfflineSubmit } from "~/components/offline/clear-offline-submit";
import { OfflineController } from "~/components/offline/offline-controller";
import { Button } from "~/components/ui/button";
import { childCsrfCookie, clearChildCookies, readCookie } from "~/lib/auth/child-session.server";
import { t } from "~/lib/i18n";
import { snapshotKey, type OfflineSnapshot } from "~/lib/offline/database";
import { requireSameOrigin } from "~/lib/security/origin.server";
import {
  requireChildContext,
  requireChildCsrf,
  revokeCurrentChildSession,
} from "~/services/children/child-auth.server";
import { listChildTasks } from "~/services/tasks/tasks.server";
import { getChildWallet } from "~/services/wallet/wallet.server";

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireChildContext(request);
  const csrf = await readCookie(childCsrfCookie, request);
  const [wallet, available] = await Promise.all([getChildWallet(request), listChildTasks(request)]);
  const now = new Date();
  const snapshot: OfflineSnapshot = {
    key: snapshotKey(context.familyId, context.childId),
    familyId: context.familyId,
    childId: context.childId,
    schemaVersion: 1,
    balanceCents: wallet.balanceCents,
    transactions: wallet.transactions.map((entry) => ({
      ...entry,
      effectiveAt: entry.effectiveAt.toISOString(),
    })),
    tasks: available.tasks.map((entry) => ({
      assignmentId: entry.assignmentId,
      title: entry.title,
      description: entry.description,
      rewardCents: entry.rewardCents,
    })),
    syncedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  return { context, csrf, snapshot };
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
          <Form
            method="post"
            onSubmit={() => sessionStorage.removeItem("kinder-offline-active-key")}
          >
            <input type="hidden" name="_csrf" value={page.csrf ?? ""} />
            <input type="hidden" name="intent" value="switch" />
            <Button className="w-full" type="submit">
              {t("kids.switch")}
            </Button>
          </Form>
          <ClearOfflineSubmit csrf={page.csrf ?? ""} label={t("kids.leave")} />
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
      <Link className="mt-4 block rounded-3xl border bg-card/90 p-6" to="/kids/tasks">
        <ListChecks className="size-7 text-primary" />
        <h2 className="mt-5 font-display text-2xl font-semibold">{t("tasks.available.title")}</h2>
      </Link>
      <OfflineController
        familyId={page.context.familyId}
        childId={page.context.childId}
        csrf={page.csrf ?? ""}
        snapshot={page.snapshot}
      />
    </KidsPage>
  );
}
