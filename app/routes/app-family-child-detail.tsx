import { ArrowLeft, Coins, CalendarClock } from "lucide-react";
import { Form, Link, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-child-detail";
import { ProfileAvatar } from "~/components/children/profile-avatar";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { resetChildPinSchema } from "~/schemas/children";
import { getChild, resetChildPin, setChildStatus } from "~/services/children/children.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await getChild(session.auth.user.id, params.familyId, params.childId)),
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const form = Object.fromEntries(await request.formData());
  if (form.intent === "status") {
    await setChildStatus(
      session.auth.user.id,
      params.familyId,
      params.childId,
      form.status === "active" ? "active" : "disabled",
    );
    return { success: "Estado actualizado." };
  }
  const parsed = resetChildPinSchema.safeParse(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await resetChildPin(session.auth.user.id, params.familyId, params.childId, parsed.data.pin);
  return { success: "PIN actualizado y sesiones revocadas." };
}
export default function ChildDetail() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppPage name={page.name} title={page.child.alias} description={t("children.description")}>
      <Button className="mb-6" variant="ghost" asChild>
        <Link to={`/app/${page.context.familyId}/children`}>
          <ArrowLeft className="size-4" />
          {t("children.backToList")}
        </Link>
      </Button>
      <div className="flex items-center gap-4 rounded-3xl border bg-card/80 p-6">
        <ProfileAvatar avatar={page.child.avatarKey} color={page.child.profileColor} />
        <span className="font-bold">
          {page.child.status === "active" ? t("children.active") : t("children.disabled")}
        </span>
        <Button className="ml-auto" variant="outline" asChild>
          <Link to={`/app/${page.context.familyId}/children/${page.child.id}/edit`}>
            {t("children.edit")}
          </Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border bg-card/80 p-6">
          <Coins className="size-7 text-primary" />
          <h2 className="mt-5 font-display text-2xl font-semibold">{t("wallet.title")}</h2>
          <Button className="mt-5" asChild>
            <Link to={`/app/${page.context.familyId}/children/${page.child.id}/wallet`}>
              {t("wallet.title")}
            </Link>
          </Button>
        </article>
        <article className="rounded-3xl border bg-card/80 p-6">
          <CalendarClock className="size-7 text-secondary" />
          <h2 className="mt-5 font-display text-2xl font-semibold">{t("allowance.title")}</h2>
          <Button className="mt-5" variant="outline" asChild>
            <Link to={`/app/${page.context.familyId}/children/${page.child.id}/allowance`}>
              {t("wallet.allowance")}
            </Link>
          </Button>
        </article>
        <Form className="rounded-3xl border bg-card/80 p-6" method="post">
          <h2 className="font-display text-2xl font-semibold">{t("children.resetPin")}</h2>
          <div className="mt-5 space-y-4">
            <TextField
              name="pin"
              type="password"
              inputMode="numeric"
              label={t("children.pin")}
              required
            />
            <TextField
              name="confirmPin"
              type="password"
              inputMode="numeric"
              label={t("children.confirmPin")}
              required
            />
            <FormMessage
              message={result?.error ?? result?.success}
              variant={result?.error ? "error" : "success"}
            />
            <Button type="submit">{t("children.resetPin")}</Button>
          </div>
        </Form>
        <Form className="rounded-3xl border bg-card/80 p-6" method="post">
          <input type="hidden" name="intent" value="status" />
          <input
            type="hidden"
            name="status"
            value={page.child.status === "active" ? "disabled" : "active"}
          />
          <h2 className="font-display text-2xl font-semibold">
            {page.child.status === "active" ? t("children.disable") : t("children.reactivate")}
          </h2>
          <Button className="mt-6" type="submit" variant="outline">
            {page.child.status === "active" ? t("children.disable") : t("children.reactivate")}
          </Button>
        </Form>
      </div>
    </AppPage>
  );
}
