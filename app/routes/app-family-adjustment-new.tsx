import { ArrowLeft } from "lucide-react";
import { Link, redirect, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/app-family-adjustment-new";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { parseMoneyToCents } from "~/domain/money/money";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { adjustmentSchema } from "~/schemas/wallet";
import { createAdjustment, listActiveChildrenForMoney } from "~/services/wallet/wallet.server";
import { MoneyForm } from "~/routes/app-family-withdrawal-new";
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
  const parsed = adjustmentSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await createAdjustment(
      session.auth.user.id,
      params.familyId,
      parsed.data.childId,
      parsed.data.kind,
      parseMoneyToCents(parsed.data.amount),
      parsed.data.description,
    );
  } catch (error) {
    if (typeof error === "object" && error && "data" in error) return { error: String(error.data) };
    throw error;
  }
  throw redirect(`/app/${params.familyId}/children/${parsed.data.childId}/wallet`);
}
export default function Adjustment() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const returnTo = page.selected
    ? `/app/${page.familyId}/children/${page.selected}/wallet`
    : `/app/${page.familyId}`;
  return (
    <AppPage name={page.name} title={t("wallet.adjustment")} description={t("wallet.description")}>
      <Button className="mb-6" variant="ghost" asChild>
        <Link to={returnTo}>
          <ArrowLeft className="size-4" />
          {page.selected ? t("wallet.backToWallet") : t("children.backToFamily")}
        </Link>
      </Button>
      <MoneyForm page={page} error={result?.error} kind="adjustment" />
    </AppPage>
  );
}
