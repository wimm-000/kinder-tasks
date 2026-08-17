import { Form, Link, redirect, useLoaderData } from "react-router";

import type { Route } from "./+types/invite";
import { AuthPage } from "~/components/auth/auth-page";
import { FormMessage } from "~/components/feedback/form-message";
import { Button } from "~/components/ui/button";
import { getAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { acceptInvitation, getInvitation } from "~/services/families/families.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const invitation = await getInvitation(params.token);
  const session = await getAdultSession(request);
  return {
    invitation,
    token: params.token,
    authenticated: Boolean(session),
    matches: Boolean(
      session && invitation && session.auth.user.email.toLowerCase() === invitation.email,
    ),
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await getAdultSession(request);
  if (!session)
    throw redirect(`/login?redirectTo=${encodeURIComponent(`/invite/${params.token}`)}`);
  const familyId = await acceptInvitation(
    params.token,
    session.auth.user.id,
    session.auth.user.email,
  );
  throw redirect(`/app/${familyId}`);
}
export default function Invite() {
  const page = useLoaderData<typeof loader>();
  if (!page.invitation)
    return (
      <AuthPage
        eyebrow={t("invite.eyebrow")}
        title={t("invite.invalidTitle")}
        description={t("invite.invalidDescription")}
      >
        <Button asChild>
          <Link to="/">{t("error.backHome")}</Link>
        </Button>
      </AuthPage>
    );
  return (
    <AuthPage
      eyebrow={t("invite.eyebrow")}
      title={t("invite.title")}
      description={`Te han invitado a ${page.invitation.familyName}.`}
    >
      {!page.authenticated ? (
        <Button asChild>
          <Link to={`/login?redirectTo=${encodeURIComponent(`/invite/${page.token}`)}`}>
            {t("invite.login")}
          </Link>
        </Button>
      ) : page.matches ? (
        <Form method="post">
          <Button type="submit">{t("invite.accept")}</Button>
        </Form>
      ) : (
        <FormMessage message="Esta invitación corresponde a otra cuenta." />
      )}
    </AuthPage>
  );
}
