import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-task-edit";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
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
        <label className="block text-sm font-bold">
          {t("tasks.form.type")}
          <select
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
            name="type"
            defaultValue={task.type}
          >
            <option value="one_off">{t("tasks.form.oneOff")}</option>
            <option value="recurring">{t("tasks.form.recurring")}</option>
            <option value="open">{t("tasks.form.open")}</option>
          </select>
        </label>
        <TextField
          name="reward"
          label={t("tasks.form.reward")}
          inputMode="decimal"
          defaultValue={String(task.rewardCents / 100).replace(".", ",")}
          required
        />
        <fieldset>
          <legend className="text-sm font-bold">{t("tasks.form.assign")}</legend>
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
        <label className="block text-sm font-bold">
          {t("tasks.form.recurrence")}
          <select
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
            name="recurrenceUnit"
            defaultValue={task.recurrenceUnit ?? "daily"}
          >
            <option value="daily">Diaria</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </label>
        <TextField
          name="recurrenceInterval"
          label={t("tasks.form.interval")}
          type="number"
          min={1}
          defaultValue={task.recurrenceInterval ?? 1}
        />
        <TextField
          name="recurrenceWeekday"
          label={t("allowance.weekday")}
          type="number"
          min={1}
          max={7}
          defaultValue={task.recurrenceWeekday ?? undefined}
        />
        <TextField
          name="recurrenceMonthDay"
          label={t("allowance.monthDay")}
          type="number"
          min={1}
          max={31}
          defaultValue={task.recurrenceMonthDay ?? undefined}
        />
        <TextField
          name="openLimitCount"
          label={t("tasks.form.limit")}
          type="number"
          min={1}
          defaultValue={task.openLimitCount ?? 1}
        />
        <label className="block text-sm font-bold">
          {t("tasks.form.limitPeriod")}
          <select
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
            name="openLimitPeriod"
            defaultValue={task.openLimitPeriod ?? "day"}
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </label>
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
