import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-withdrawal-new";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { parseMoneyToCents } from "~/domain/money/money";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { withdrawalSchema } from "~/schemas/wallet";
import { createWithdrawal, listActiveChildrenForMoney } from "~/services/wallet/wallet.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    familyId: params.familyId,
    selected: new URL(request.url).searchParams.get("childId"),
    children: await listActiveChildrenForMoney(session.auth.user.id, params.familyId),
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const parsed = withdrawalSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await createWithdrawal(
      session.auth.user.id,
      params.familyId,
      parsed.data.childId,
      parseMoneyToCents(parsed.data.amount),
      parsed.data.description,
    );
  } catch (error) {
    if (typeof error === "object" && error && "data" in error) return { error: String(error.data) };
    throw error;
  }
  throw redirect(`/app/${params.familyId}/children/${parsed.data.childId}/wallet`);
}
export default function Withdrawal() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const returnTo = page.selected
    ? `/app/${page.familyId}/children/${page.selected}/wallet`
    : `/app/${page.familyId}`;
  return (
    <AppPage name={page.name} title={t("wallet.withdrawal")} description={t("wallet.balance")}>
      <Button className="mb-6" variant="ghost" asChild>
        <Link to={returnTo}>
          <ArrowLeft className="size-4" />
          {page.selected ? t("wallet.backToWallet") : t("children.backToFamily")}
        </Link>
      </Button>
      <MoneyForm page={page} error={result?.error} kind="withdrawal" />
    </AppPage>
  );
}
export function MoneyForm({
  page,
  error,
  kind,
}: {
  page: { children: Array<{ id: string; alias: string }>; selected: string | null };
  error?: string;
  kind: "withdrawal" | "adjustment";
}) {
  return (
    <Form className="max-w-xl space-y-5 rounded-3xl border bg-card/80 p-7" method="post">
      <label className="block text-sm font-bold">
        Perfil
        <select
          className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
          name="childId"
          defaultValue={page.selected ?? page.children[0]?.id}
        >
          {page.children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.alias}
            </option>
          ))}
        </select>
      </label>
      {kind === "adjustment" ? (
        <label className="block text-sm font-bold">
          Tipo
          <select className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3" name="kind">
            <option value="credit">{t("wallet.credit")}</option>
            <option value="debit">{t("wallet.debit")}</option>
          </select>
        </label>
      ) : null}
      <TextField
        name="amount"
        label={t("wallet.amount")}
        inputMode="decimal"
        placeholder="10,00"
        required
      />
      <TextField name="description" label={t("wallet.description")} maxLength={200} required />
      <FormMessage message={error} />
      <Button type="submit">
        {kind === "withdrawal" ? t("wallet.submitWithdrawal") : t("wallet.submitAdjustment")}
      </Button>
    </Form>
  );
}
