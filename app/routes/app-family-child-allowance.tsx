import { ArrowLeft } from "lucide-react";
import { Form, Link, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-child-allowance";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { formatMoney, parseMoneyToCents } from "~/domain/money/money";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { allowanceSchema } from "~/schemas/allowances";
import {
  getAllowance,
  saveAllowance,
  setAllowancePaused,
} from "~/services/allowances/allowances.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await getAllowance(session.auth.user.id, params.familyId, params.childId)),
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const form = Object.fromEntries(await request.formData());
  if (form.intent === "pause" || form.intent === "resume") {
    await setAllowancePaused(
      session.auth.user.id,
      params.familyId,
      params.childId,
      form.intent === "pause",
    );
    return { success: "Estado de la paga actualizado." };
  }
  if (form.frequency === "weekly") delete form.monthDay;
  else delete form.weekday;
  const parsed = allowanceSchema.safeParse(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await saveAllowance({
    userId: session.auth.user.id,
    familyId: params.familyId,
    childId: params.childId,
    amountCents: parseMoneyToCents(parsed.data.amount),
    frequency: parsed.data.frequency,
    weekday: parsed.data.weekday,
    monthDay: parsed.data.monthDay,
    startDate: parsed.data.startDate,
  });
  return { success: "Paga guardada." };
}
export default function Allowance() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const schedule = page.schedule;
  return (
    <AppPage
      name={page.name}
      title={`${t("allowance.title")} · ${page.child.alias}`}
      description={t("allowance.description")}
    >
      <Button className="mb-6" variant="ghost" asChild>
        <Link to={`/app/${page.context.familyId}/children/${page.child.id}`}>
          <ArrowLeft className="size-4" />
          {t("children.backToProfile")}
        </Link>
      </Button>
      <Form className="max-w-xl space-y-5 rounded-3xl border bg-card/80 p-7" method="post">
        <TextField
          name="amount"
          label={t("wallet.amount")}
          inputMode="decimal"
          defaultValue={schedule ? String(schedule.amountCents / 100).replace(".", ",") : ""}
          required
        />
        <label className="block text-sm font-bold">
          {t("allowance.frequency")}
          <select
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
            name="frequency"
            defaultValue={schedule?.frequency ?? "weekly"}
          >
            <option value="weekly">{t("allowance.weekly")}</option>
            <option value="monthly">{t("allowance.monthly")}</option>
          </select>
        </label>
        <label className="block text-sm font-bold">
          {t("allowance.weekday")}
          <select
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
            name="weekday"
            defaultValue={schedule?.weekday ?? 1}
          >
            {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map(
              (label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <TextField
          name="monthDay"
          label={t("allowance.monthDay")}
          type="number"
          min={1}
          max={31}
          defaultValue={schedule?.monthDay ?? 1}
        />
        <TextField
          name="startDate"
          label={t("allowance.startDate")}
          type="date"
          defaultValue={schedule?.startDate ?? new Date().toISOString().slice(0, 10)}
          required
        />
        <FormMessage
          message={result?.error ?? result?.success}
          variant={result?.error ? "error" : "success"}
        />
        <Button type="submit">{t("allowance.save")}</Button>
      </Form>
      {schedule ? (
        <Form className="mt-4" method="post">
          <input
            type="hidden"
            name="intent"
            value={schedule.status === "active" ? "pause" : "resume"}
          />
          <Button type="submit" variant="outline">
            {schedule.status === "active" ? t("allowance.pause") : t("allowance.resume")}
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatMoney(schedule.amountCents)} ·{" "}
            {schedule.frequency === "weekly" ? t("allowance.weekly") : t("allowance.monthly")}
          </p>
        </Form>
      ) : null}
    </AppPage>
  );
}
