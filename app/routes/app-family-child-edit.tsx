import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-child-edit";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { CHILD_AVATARS, CHILD_COLORS } from "~/features/children/profile-options";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { childProfileSchema } from "~/schemas/children";
import { getChild, updateChild } from "~/services/children/children.server";

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
  const parsed = childProfileSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await updateChild({
    userId: session.auth.user.id,
    familyId: params.familyId,
    childId: params.childId,
    ...parsed.data,
  });
  throw redirect(`/app/${params.familyId}/children/${params.childId}`);
}
export default function EditChild() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppPage name={page.name} title={t("children.edit")} description={page.child.alias}>
      <Button className="mb-6" variant="ghost" asChild>
        <Link to={`/app/${page.context.familyId}/children/${page.child.id}`}>
          <ArrowLeft className="size-4" />
          {t("children.backToProfile")}
        </Link>
      </Button>
      <Form className="max-w-xl space-y-5 rounded-3xl border bg-card/80 p-7" method="post">
        <TextField
          name="alias"
          label={t("children.alias")}
          defaultValue={page.child.alias}
          required
        />
        <label className="block text-sm font-bold">
          {t("children.avatar")}
          <select
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
            name="avatarKey"
            defaultValue={page.child.avatarKey}
          >
            {CHILD_AVATARS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          {t("children.color")}
          <select
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
            name="profileColor"
            defaultValue={page.child.profileColor}
          >
            {CHILD_COLORS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <FormMessage message={result?.error} />
        <Button type="submit">{t("children.save")}</Button>
      </Form>
    </AppPage>
  );
}
