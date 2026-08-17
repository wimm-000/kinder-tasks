import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/kids-unlock";
import { ProfileAvatar } from "~/components/children/profile-avatar";
import { FormMessage } from "~/components/feedback/form-message";
import { KidsPage } from "~/components/layout/kids-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { unlockChildSchema } from "~/schemas/children";
import { getAuthorizedProfile, unlockChild } from "~/services/children/child-auth.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const profile = await getAuthorizedProfile(request, params.profileRef);
  if (!profile) throw redirect("/kids");
  return { profile };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const parsed = unlockChildSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: t("kids.unlock.error") };
  try {
    const cookies = await unlockChild(request, params.profileRef, parsed.data.pin);
    const headers = new Headers();
    headers.append("set-cookie", cookies.sessionCookie);
    headers.append("set-cookie", cookies.csrfCookie);
    throw redirect("/kids/home", { headers });
  } catch (error) {
    if (error instanceof Response) throw error;
    if (typeof error === "object" && error && "data" in error)
      return { error: t("kids.unlock.error") };
    throw error;
  }
}
export default function KidsUnlock() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <KidsPage title={t("kids.unlock.title")} description={t("kids.unlock.description")}>
      <div className="max-w-md rounded-[2rem] border bg-card/90 p-7 shadow-sm">
        <div className="flex items-center gap-4">
          <ProfileAvatar avatar={page.profile.avatarKey} color={page.profile.profileColor} />
          <span className="font-display text-2xl font-semibold">{page.profile.alias}</span>
        </div>
        <Form className="mt-7 space-y-5" method="post">
          <TextField
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            label={t("children.pin")}
            required
          />
          <FormMessage message={result?.error} />
          <Button className="w-full" type="submit">
            {t("kids.unlock.submit")}
          </Button>
        </Form>
        <Button className="mt-3 w-full" variant="ghost" asChild>
          <Link to="/kids">Volver</Link>
        </Button>
      </div>
    </KidsPage>
  );
}
