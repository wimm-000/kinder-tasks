import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-task-edit";
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
import { archiveTask, getFamilyTask, updateTask } from "~/services/tasks/tasks.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await getFamilyTask(session.auth.user.id, params.familyId, params.taskId)),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const form = await request.formData();
  if (form.get("intent") === "archive") {
    await archiveTask(session.auth.user.id, params.familyId, params.taskId);
    throw redirect(`/app/${params.familyId}/tasks`);
  }
  const raw = Object.fromEntries(form);
  if (raw.type !== "recurring") {
    delete raw.recurrenceUnit;
    delete raw.recurrenceInterval;
    delete raw.recurrenceWeekday;
    delete raw.recurrenceMonthDay;
  }
  if (raw.type !== "open") {
    delete raw.openLimitCount;
    delete raw.openLimitPeriod;
  }
  const parsed = taskSchema.safeParse({ ...raw, childIds: form.getAll("childIds") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await updateTask({
    userId: session.auth.user.id,
    familyId: params.familyId,
    taskId: params.taskId,
    ...parsed.data,
    rewardCents: parsed.data.reward === "0" ? 0 : parseMoneyToCents(parsed.data.reward),
  });
  throw redirect(`/app/${params.familyId}/tasks`);
}

export default function EditTask() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const task = page.task;
  return (
    <AppPage name={page.name} title={t("tasks.form.edit")} description={task.title}>
      <Button className="mb-6" variant="ghost" asChild>
        <Link to={`/app/${page.context.familyId}/tasks`}>
          <ArrowLeft className="size-4" />
          {t("tasks.form.cancel")}
        </Link>
      </Button>
      <Form className="max-w-2xl space-y-5 rounded-3xl border bg-card/80 p-7" method="post">
        <TextField name="title" label={t("tasks.form.title")} defaultValue={task.title} required />
        <TextField
          name="description"
          label={t("tasks.form.description")}
          defaultValue={task.description ?? ""}
        />
        <TaskScheduleFields
          defaults={{
            type: task.type as "one_off" | "recurring" | "open",
            recurrenceUnit: task.recurrenceUnit as "daily" | "weekly" | "monthly" | null,
            recurrenceInterval: task.recurrenceInterval,
            recurrenceWeekday: task.recurrenceWeekday,
            recurrenceMonthDay: task.recurrenceMonthDay,
            openLimitCount: task.openLimitCount,
            openLimitPeriod: task.openLimitPeriod as "day" | "week" | "month" | null,
          }}
        />
        <TextField
          name="reward"
          label={t("tasks.form.reward")}
          hint="Importe que se suma al saldo por cada realización aprobada. Usa 0 si no hay recompensa."
          inputMode="decimal"
          defaultValue={String(task.rewardCents / 100).replace(".", ",")}
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
                <input
                  type="checkbox"
                  name="childIds"
                  value={child.id}
                  defaultChecked={page.assignedChildIds.includes(child.id)}
                />
                {child.alias}
              </label>
            ))}
          </div>
        </fieldset>
        <FormMessage message={result?.error} />
        <Button type="submit">{t("tasks.form.save")}</Button>
      </Form>
      <section className="mt-6 max-w-2xl rounded-3xl border border-secondary/40 bg-secondary/5 p-7">
        <h2 className="font-display text-2xl font-semibold">{t("tasks.form.deleteTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("tasks.form.deleteDescription")}</p>
        <Form className="mt-5" method="post">
          <input type="hidden" name="intent" value="archive" />
          <Button type="submit" variant="outline">
            {t("tasks.form.delete")}
          </Button>
        </Form>
      </section>
    </AppPage>
  );
}
