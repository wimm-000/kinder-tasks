import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-task-new";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { TaskScheduleFields } from "~/components/tasks/task-schedule-fields";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { parseMoneyToCents } from "~/domain/money/money";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { taskSchema } from "~/schemas/tasks";
import { createTask } from "~/services/tasks/tasks.server";
import { listActiveChildrenForMoney } from "~/services/wallet/wallet.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    familyId: params.familyId,
    children: await listActiveChildrenForMoney(session.auth.user.id, params.familyId),
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const form = await request.formData();
  const raw = Object.fromEntries(form);
  const type = raw.type;
  if (type !== "recurring") {
    delete raw.recurrenceUnit;
    delete raw.recurrenceInterval;
    delete raw.recurrenceWeekday;
    delete raw.recurrenceMonthDay;
  }
  if (type !== "open") {
    delete raw.openLimitCount;
    delete raw.openLimitPeriod;
  }
  const parsed = taskSchema.safeParse({ ...raw, childIds: form.getAll("childIds") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await createTask({
    userId: session.auth.user.id,
    familyId: params.familyId,
    ...parsed.data,
    rewardCents: parsed.data.reward === "0" ? 0 : parseMoneyToCents(parsed.data.reward),
  });
  throw redirect(`/app/${params.familyId}/tasks`);
}
export default function NewTask() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppPage name={page.name} title={t("tasks.create")} description={t("tasks.description")}>
      <Button className="mb-6" variant="ghost" asChild>
        <Link to={`/app/${page.familyId}/tasks`}>
          <ArrowLeft className="size-4" />
          {t("tasks.form.cancel")}
        </Link>
      </Button>
      <Form className="max-w-2xl space-y-5 rounded-3xl border bg-card/80 p-7" method="post">
        <TextField name="title" label={t("tasks.form.title")} required />
        <TextField name="description" label={t("tasks.form.description")} />
        <TaskScheduleFields />
        <TextField
          name="reward"
          label={t("tasks.form.reward")}
          hint="Importe que se suma al saldo por cada realización aprobada. Usa 0 si no hay recompensa."
          inputMode="decimal"
          defaultValue="0"
          required
        />
        <fieldset>
          <legend className="text-sm font-bold">{t("tasks.form.assign")}</legend>
          <p className="mt-2 text-sm text-muted-foreground">
            La tarea aparecerá únicamente en los perfiles seleccionados.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {page.children.map((child) => (
              <label
                className="flex min-h-11 items-center gap-3 rounded-2xl border p-3"
                key={child.id}
              >
                <input type="checkbox" name="childIds" value={child.id} />
                {child.alias}
              </label>
            ))}
          </div>
        </fieldset>
        <FormMessage message={result?.error} />
        <Button type="submit">{t("tasks.form.save")}</Button>
      </Form>
    </AppPage>
  );
}
