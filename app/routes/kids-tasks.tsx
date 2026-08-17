import { Link, useActionData, useLoaderData } from "react-router";
import { v7 as uuidv7 } from "uuid";

import type { Route } from "./+types/kids-tasks";
import { FormMessage } from "~/components/feedback/form-message";
import { KidsPage } from "~/components/layout/kids-page";
import { OfflineCompletionForm } from "~/components/offline/offline-completion-form";
import { OfflineController } from "~/components/offline/offline-controller";
import { Button } from "~/components/ui/button";
import { formatMoney } from "~/domain/money/money";
import { childCsrfCookie, readCookie } from "~/lib/auth/child-session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { requireChildCsrf } from "~/services/children/child-auth.server";
import { listChildTasks, requestTaskCompletion } from "~/services/tasks/tasks.server";

export async function loader({ request }: Route.LoaderArgs) {
  const result = await listChildTasks(request);
  return {
    ...result,
    csrf: await readCookie(childCsrfCookie, request),
    tasks: result.tasks.map((task) => ({ ...task, clientRequestId: uuidv7() })),
  };
}
export async function action({ request }: Route.ActionArgs) {
  requireSameOrigin(request);
  const form = Object.fromEntries(await request.formData());
  await requireChildCsrf(request, form._csrf);
  if (typeof form.assignmentId !== "string" || typeof form.clientRequestId !== "string")
    return { error: "Solicitud no válida." };
  await requestTaskCompletion(request, form.assignmentId, form.clientRequestId);
  return { success: t("tasks.pending.sent") };
}
export default function KidsTasks() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <KidsPage title={t("tasks.available.title")} description={t("tasks.available.description")}>
      <div className="mb-5 flex gap-3">
        <Button variant="ghost" asChild>
          <Link to="/kids/home">Volver</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/kids/tasks/pending">{t("tasks.pending.title")}</Link>
        </Button>
      </div>
      <FormMessage
        message={result?.error ?? result?.success}
        variant={result?.error ? "error" : "success"}
      />
      <OfflineController
        familyId={page.context.familyId}
        childId={page.context.childId}
        csrf={page.csrf ?? ""}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {page.tasks.map((task) => (
          <article className="rounded-3xl border bg-card/90 p-6" key={task.assignmentId}>
            <h2 className="font-display text-2xl font-semibold">{task.title}</h2>
            {task.description ? (
              <p className="mt-2 text-muted-foreground">{task.description}</p>
            ) : null}
            <p className="mt-4 font-bold">{formatMoney(task.rewardCents)}</p>
            <OfflineCompletionForm
              familyId={page.context.familyId}
              childId={page.context.childId}
              assignmentId={task.assignmentId}
              clientRequestId={task.clientRequestId}
              csrf={page.csrf ?? ""}
              label={t("tasks.available.complete")}
            />
          </article>
        ))}
      </div>
      {!page.tasks.length ? (
        <p className="rounded-3xl border bg-card p-6">{t("tasks.available.empty")}</p>
      ) : null}
    </KidsPage>
  );
}
