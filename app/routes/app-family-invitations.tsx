import { Form, Link, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-invitations";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { invitationSchema } from "~/schemas/families";
import {
  inviteParent,
  listInvitations,
  revokeInvitation,
} from "~/services/families/families.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await listInvitations(session.auth.user.id, params.familyId)),
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const form = Object.fromEntries(await request.formData());
  try {
    if (form.intent === "revoke" && typeof form.invitationId === "string") {
      await revokeInvitation(session.auth.user.id, params.familyId, form.invitationId);
      return { success: "Invitación revocada." };
    }
    const parsed = invitationSchema.safeParse(form);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
    await inviteParent({
      userId: session.auth.user.id,
      inviterName: session.auth.user.name,
      familyId: params.familyId,
      email: parsed.data.email,
    });
    return { success: t("family.invite.sent") };
  } catch (error) {
    if (error instanceof Response) return { error: await error.text() };
    if (
      typeof error === "object" &&
      error !== null &&
      "data" in error &&
      typeof error.data === "string"
    ) {
      return { error: error.data };
    }
    throw error;
  }
}
export default function Invitations() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppPage
      name={page.name}
      title={t("family.invitations")}
      description={t("family.invitations.description")}
    >
      <Form className="rounded-[1.75rem] border bg-card/80 p-7" method="post">
        <TextField label={t("family.invite.email")} name="email" type="email" required />
        <div className="mt-4">
          <FormMessage
            message={result?.error ?? result?.success}
            variant={result?.error ? "error" : "success"}
          />
        </div>
        <Button className="mt-5" type="submit">
          {t("family.invite.submit")}
        </Button>
      </Form>
      <div className="mt-6 space-y-3">
        {page.invitations.map((invite) => (
          <article
            className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card/80 p-5"
            key={invite.id}
          >
            <div>
              <p className="font-bold">{invite.email}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`family.invite.${invite.status}` as "family.invite.pending")}
              </p>
            </div>
            {invite.status === "pending" ? (
              <Form method="post">
                <input name="intent" type="hidden" value="revoke" />
                <input name="invitationId" type="hidden" value={invite.id} />
                <Button type="submit" variant="ghost">
                  {t("family.invite.revoke")}
                </Button>
              </Form>
            ) : null}
          </article>
        ))}
      </div>
      <Button className="mt-6" variant="ghost" asChild>
        <Link to={`/app/${page.context.familyId}`}>{t("family.back")}</Link>
      </Button>
    </AppPage>
  );
}
