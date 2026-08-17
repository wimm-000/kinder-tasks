import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-children";
import { ProfileAvatar } from "~/components/children/profile-avatar";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { auth } from "~/lib/auth/auth.server";
import { childDeviceCookie } from "~/lib/auth/child-session.server";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { authorizeDeviceSchema } from "~/schemas/children";
import {
  authorizeChildDevice,
  listChildren,
  revokeChildDevice,
} from "~/services/children/children.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await listChildren(session.auth.user.id, params.familyId)),
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const form = Object.fromEntries(await request.formData());
  if (form.intent === "revoke" && typeof form.deviceId === "string") {
    await revokeChildDevice(session.auth.user.id, params.familyId, form.deviceId);
    return { success: "Dispositivo revocado." };
  }
  const parsed = authorizeDeviceSchema.safeParse(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const token = await authorizeChildDevice(session.auth.user.id, params.familyId, parsed.data.name);
  const signOut = await auth.api.signOut({ headers: request.headers, asResponse: true });
  const headers = new Headers();
  for (const value of signOut.headers.getSetCookie()) headers.append("set-cookie", value);
  headers.append("set-cookie", await childDeviceCookie.serialize(token));
  throw redirect("/kids", { headers });
}
export default function Children() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppPage name={page.name} title={t("children.title")} description={t("children.description")}>
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" asChild>
          <Link to={`/app/${page.context.familyId}`}>
            <ArrowLeft className="size-4" />
            {t("children.backToFamily")}
          </Link>
        </Button>
        <Button asChild>
          <Link to={`/app/${page.context.familyId}/children/new`}>{t("children.create")}</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {page.children.map((child) => (
          <Link
            className="flex items-center gap-4 rounded-3xl border bg-card/80 p-5 transition hover:-translate-y-0.5"
            key={child.id}
            to={`/app/${page.context.familyId}/children/${child.id}`}
          >
            <ProfileAvatar avatar={child.avatarKey} color={child.profileColor} />
            <div>
              <h2 className="font-display text-xl font-semibold">{child.alias}</h2>
              <p className="text-sm text-muted-foreground">
                {child.status === "active" ? t("children.active") : t("children.disabled")}
              </p>
            </div>
          </Link>
        ))}
      </div>
      {!page.children.length ? (
        <p className="mt-6 rounded-3xl border bg-card p-6">{t("children.empty")}</p>
      ) : null}
      <section className="mt-10 rounded-[1.75rem] border bg-card/80 p-7">
        <h2 className="font-display text-2xl font-semibold">{t("children.devices")}</h2>
        <p className="mt-2 text-muted-foreground">{t("children.authorizeWarning")}</p>
        <Form className="mt-6 max-w-lg" method="post">
          <TextField
            name="name"
            label={t("children.deviceName")}
            hint={t("children.deviceHint")}
            required
          />
          <div className="mt-4">
            <FormMessage
              message={result?.error ?? result?.success}
              variant={result?.error ? "error" : "success"}
            />
          </div>
          <Button className="mt-5" type="submit">
            {t("children.authorizeDevice")}
          </Button>
        </Form>
        <div className="mt-6 space-y-2">
          {page.devices.map((device) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl bg-muted p-4"
              key={device.id}
            >
              <span className="font-bold">
                {device.name ?? "Dispositivo"}
                {device.offlineEnabled ? (
                  <span className="mt-1 block text-xs text-primary">
                    {t("offline.deviceEnabled")}
                  </span>
                ) : null}
              </span>
              {!device.revokedAt ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="deviceId" value={device.id} />
                  <Button type="submit" variant="ghost">
                    {t("children.revokeDevice")}
                  </Button>
                </Form>
              ) : (
                <span className="text-sm text-muted-foreground">Revocado</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </AppPage>
  );
}
