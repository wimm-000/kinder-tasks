import { Form, Link, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/admin";
import { FormMessage } from "~/components/feedback/form-message";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { requireSuperadmin } from "~/lib/auth/session.server";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { getAdminOverview, setFamilyDisabled, setUserBlocked } from "~/services/admin/admin.server";

export function meta() {
  return [{ title: "Administración | Kinder Tasks" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireSuperadmin(request);
  const search = new URL(request.url).searchParams.get("q") ?? "";
  return {
    name: context.auth.user.name,
    search,
    ...(await getAdminOverview(search)),
  };
}

export async function action({ request }: Route.ActionArgs) {
  requireSameOrigin(request);
  const context = await requireSuperadmin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  const targetId = form.get("targetId");
  const reason = form.get("reason");
  const confirmation = form.get("confirmation");
  if (typeof targetId !== "string" || (reason !== null && typeof reason !== "string")) {
    return { error: "Solicitud inválida." };
  }

  if (intent === "block-user" || intent === "unblock-user") {
    if (intent === "block-user" && confirmation !== "BLOQUEAR") {
      return { error: "Escribe BLOQUEAR para confirmar." };
    }
    await setUserBlocked({
      actorUserId: context.auth.user.id,
      targetUserId: targetId,
      blocked: intent === "block-user",
      reason: reason || undefined,
      request,
    });
    return { success: intent === "block-user" ? "Usuario bloqueado." : "Usuario reactivado." };
  }
  if (intent === "disable-family" || intent === "enable-family") {
    if (intent === "disable-family" && confirmation !== "DESACTIVAR") {
      return { error: "Escribe DESACTIVAR para confirmar." };
    }
    await setFamilyDisabled({
      actorUserId: context.auth.user.id,
      familyId: targetId,
      disabled: intent === "disable-family",
      reason: reason || undefined,
      request,
    });
    return {
      success: intent === "disable-family" ? "Familia desactivada." : "Familia reactivada.",
    };
  }
  return { error: "Acción no reconocida." };
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default function Admin() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();

  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b pb-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-secondary">
            Superadministración
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">Control operativo</h1>
          <p className="mt-2 text-muted-foreground">Sesión de {page.name}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/app">Volver a la aplicación</Link>
        </Button>
      </div>

      <Form className="mt-8 flex max-w-xl items-end gap-3" method="get">
        <TextField
          className="min-w-0"
          defaultValue={page.search}
          label="Buscar usuarios o familias"
          name="q"
          type="search"
        />
        <Button type="submit">Buscar</Button>
      </Form>
      <div className="mt-4">
        <FormMessage
          message={result?.error ?? result?.success}
          variant={result?.error ? "error" : "success"}
        />
      </div>

      <section className="mt-10" aria-labelledby="users-title">
        <h2 className="font-display text-2xl font-semibold" id="users-title">
          Usuarios
        </h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {page.users.map((account) => (
            <article className="rounded-3xl border bg-card/80 p-5" key={account.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-bold">{account.name}</h3>
                  <p className="text-sm text-muted-foreground">{account.email}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-primary">
                    {account.role} · {account.status} · {account.familyCount} familias
                  </p>
                </div>
                {account.status === "active" || account.status === "blocked" ? (
                  <Form className="flex items-end gap-2" method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value={account.status === "active" ? "block-user" : "unblock-user"}
                    />
                    <input type="hidden" name="targetId" value={account.id} />
                    {account.status === "active" ? (
                      <div className="grid gap-2">
                        <input
                          aria-label="Motivo del bloqueo"
                          className="min-h-10 min-w-0 rounded-xl border bg-background px-3 text-sm"
                          name="reason"
                          placeholder="Motivo"
                          required
                        />
                        <input
                          aria-label="Confirmar bloqueo"
                          className="min-h-10 min-w-0 rounded-xl border bg-background px-3 text-sm"
                          name="confirmation"
                          pattern="BLOQUEAR"
                          placeholder="BLOQUEAR"
                          required
                        />
                      </div>
                    ) : null}
                    <Button size="sm" type="submit" variant="outline">
                      {account.status === "active" ? "Bloquear" : "Reactivar"}
                    </Button>
                  </Form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="families-title">
        <h2 className="font-display text-2xl font-semibold" id="families-title">
          Familias
        </h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {page.families.map((family) => (
            <article className="rounded-3xl border bg-card/80 p-5" key={family.id}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-bold">{family.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {family.status} · {family.memberCount} miembros · {family.timezone}
                  </p>
                </div>
                {family.status === "active" || family.status === "disabled" ? (
                  <Form className="flex items-end gap-2" method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value={family.status === "active" ? "disable-family" : "enable-family"}
                    />
                    <input type="hidden" name="targetId" value={family.id} />
                    {family.status === "active" ? (
                      <div className="grid gap-2">
                        <input
                          aria-label="Motivo de la desactivación"
                          className="min-h-10 min-w-0 rounded-xl border bg-background px-3 text-sm"
                          name="reason"
                          placeholder="Motivo"
                          required
                        />
                        <input
                          aria-label="Confirmar desactivación"
                          className="min-h-10 min-w-0 rounded-xl border bg-background px-3 text-sm"
                          name="confirmation"
                          pattern="DESACTIVAR"
                          placeholder="DESACTIVAR"
                          required
                        />
                      </div>
                    ) : null}
                    <Button size="sm" type="submit" variant="outline">
                      {family.status === "active" ? "Desactivar" : "Reactivar"}
                    </Button>
                  </Form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="audit-title">
        <h2 className="font-display text-2xl font-semibold" id="audit-title">
          Auditoría reciente
        </h2>
        <div className="mt-4 overflow-x-auto rounded-3xl border bg-card/80">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b bg-muted/60">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Actor</th>
                <th className="p-4">Acción</th>
                <th className="p-4">Objetivo</th>
                <th className="p-4">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {page.events.map((event) => (
                <tr className="border-b last:border-0" key={event.id}>
                  <td className="p-4">{formatDate(event.createdAt)}</td>
                  <td className="p-4">{event.actorType}</td>
                  <td className="p-4 font-medium">{event.action}</td>
                  <td className="p-4">
                    {event.targetType} {event.targetId ?? ""}
                  </td>
                  <td className="p-4">{event.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
