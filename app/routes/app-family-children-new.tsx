import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-children-new";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { CHILD_AVATARS, CHILD_COLORS } from "~/features/children/profile-options";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { createChildSchema } from "~/schemas/children";
import { createChild } from "~/services/children/children.server";
import { requireFamilyParent } from "~/services/families/families.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  await requireFamilyParent(session.auth.user.id, params.familyId);
  return { name: session.auth.user.name, familyId: params.familyId };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const parsed = createChildSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const id = await createChild({
    userId: session.auth.user.id,
    familyId: params.familyId,
    ...parsed.data,
  });
  throw redirect(`/app/${params.familyId}/children/${id}`);
}
export default function NewChild() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppPage name={page.name} title={t("children.create")} description={t("children.description")}>
      <Button className="mb-6" variant="ghost" asChild>
        <Link to={`/app/${page.familyId}/children`}>
          <ArrowLeft className="size-4" />
          {t("children.backToList")}
        </Link>
      </Button>
      <ChildForm error={result?.error} />
    </AppPage>
  );
}

function ChildForm({ error }: { error?: string }) {
  return (
    <Form className="max-w-xl space-y-5 rounded-[1.75rem] border bg-card/80 p-7" method="post">
      <TextField name="alias" label={t("children.alias")} required maxLength={40} />
      <label className="block text-sm font-bold">
        {t("children.avatar")}
        <select
          className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
          name="avatarKey"
          defaultValue="fox"
        >
          {CHILD_AVATARS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-bold">
        {t("children.color")}
        <select
          className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
          name="profileColor"
          defaultValue="teal"
        >
          {CHILD_COLORS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <TextField
        name="pin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        label={t("children.pin")}
        hint={t("children.pinHint")}
        required
      />
      <TextField
        name="confirmPin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        label={t("children.confirmPin")}
        required
      />
      <FormMessage message={error} />
      <Button type="submit">{t("children.save")}</Button>
    </Form>
  );
}
