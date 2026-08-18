import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-privacy";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { auth } from "~/lib/auth/auth.server";
import { requireAdultSession } from "~/lib/auth/session.server";
import { requireSameOrigin } from "~/lib/security/origin.server";
import {
  getFamilyDeletionState,
  recoverFamily,
  requestFamilyDeletion,
} from "~/services/privacy/privacy.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await requireAdultSession(request);
  return {
    name: context.auth.user.name,
    family: await getFamilyDeletionState(context.auth.user.id, params.familyId),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const context = await requireAdultSession(request);
  const form = await request.formData();
  const intent = form.get("intent");
  const password = form.get("password");
  if (typeof password !== "string") return { error: "Introduce tu contraseña." };
  try {
    const verified = await auth.api.verifyPassword({
      headers: request.headers,
      body: { password },
    });
    if (!verified.status) return { error: "La contraseña no es correcta." };
  } catch {
    return { error: "La contraseña no es correcta." };
  }

  if (intent === "delete") {
    if (form.get("confirmation") !== "ELIMINAR") return { error: "Escribe ELIMINAR." };
    await requestFamilyDeletion({
      userId: context.auth.user.id,
      familyId: params.familyId,
      request,
    });
    throw redirect(`/app/${params.familyId}/privacy`);
  }
  if (intent === "recover") {
    await recoverFamily({ userId: context.auth.user.id, familyId: params.familyId, request });
    throw redirect(`/app/${params.familyId}`);
  }
  return { error: "Acción no reconocida." };
}

export default function FamilyPrivacy() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = page.family.status === "pending_deletion";
  return (
    <AppPage
      name={page.name}
      title={`Privacidad de ${page.family.name}`}
      description="Controla la conservación y eliminación de los datos de esta familia."
    >
      <section className="max-w-2xl rounded-[1.75rem] border border-secondary/40 bg-card/80 p-7">
        <h2 className="font-display text-2xl font-semibold">
          {pending ? "Eliminación programada" : "Eliminar familia"}
        </h2>
        <p className="mt-3 leading-7 text-muted-foreground">
          {pending
            ? `Los datos se eliminarán después del ${new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(new Date(page.family.purgeAfter!))}. Puedes cancelar la solicitud hasta entonces.`
            : "La familia dejará de estar disponible de inmediato. Tendrás 30 días para recuperarla antes del purgado definitivo."}
        </p>
        <div className="mt-4">
          <FormMessage message={result?.error} />
        </div>
        <Form className="mt-6 space-y-5" method="post">
          <input type="hidden" name="intent" value={pending ? "recover" : "delete"} />
          <TextField
            autoComplete="current-password"
            label="Contraseña"
            name="password"
            required
            type="password"
          />
          {!pending ? (
            <TextField
              autoComplete="off"
              hint="Escribe ELIMINAR para confirmar"
              label="Confirmación"
              name="confirmation"
              pattern="ELIMINAR"
              required
            />
          ) : null}
          <Button type="submit" variant={pending ? "default" : "outline"}>
            {pending ? "Recuperar familia" : "Programar eliminación"}
          </Button>
        </Form>
        {!pending ? (
          <Button className="mt-4" variant="ghost" asChild>
            <Link to={`/app/${page.family.id}`}>Volver</Link>
          </Button>
        ) : null}
      </section>
    </AppPage>
  );
}
