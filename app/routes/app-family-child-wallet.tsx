import { ArrowLeft } from "lucide-react";
import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-child-wallet";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { formatMoney } from "~/domain/money/money";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { getParentWallet } from "~/services/wallet/wallet.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await getParentWallet(session.auth.user.id, params.familyId, params.childId)),
  };
}
export default function Wallet() {
  const page = useLoaderData<typeof loader>();
  return (
    <AppPage
      name={page.name}
      title={`${t("wallet.title")} · ${page.child.alias}`}
      description={t("wallet.balance")}
    >
      <Button variant="ghost" asChild>
        <Link to={`/app/${page.context.familyId}/children/${page.child.id}`}>
          <ArrowLeft className="size-4" />
          {t("children.backToProfile")}
        </Link>
      </Button>
      <section className="mt-6 rounded-[2rem] bg-primary p-7 text-primary-foreground">
        <p className="font-bold">{t("wallet.balance")}</p>
        <p className="mt-2 font-display text-5xl font-semibold">{formatMoney(page.balanceCents)}</p>
      </section>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link to={`/app/${page.context.familyId}/withdrawals/new?childId=${page.child.id}`}>
            {t("wallet.withdrawal")}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={`/app/${page.context.familyId}/adjustments/new?childId=${page.child.id}`}>
            {t("wallet.adjustment")}
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to={`/app/${page.context.familyId}/children/${page.child.id}/allowance`}>
            {t("wallet.allowance")}
          </Link>
        </Button>
      </div>
      <TransactionHistory transactions={page.transactions} />
    </AppPage>
  );
}

export function TransactionHistory({
  transactions,
}: {
  transactions: Array<{ id: string; amountCents: number; description: string; effectiveAt: Date }>;
}) {
  if (!transactions.length)
    return <p className="mt-8 rounded-3xl border bg-card p-6">{t("wallet.empty")}</p>;
  return (
    <div className="mt-8 space-y-3">
      {transactions.map((item) => (
        <article
          className="flex items-center justify-between gap-4 rounded-3xl border bg-card/80 p-5"
          key={item.id}
        >
          <div>
            <h2 className="font-bold">{item.description}</h2>
            <time
              className="text-sm text-muted-foreground"
              dateTime={item.effectiveAt.toISOString()}
            >
              {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(item.effectiveAt)}
            </time>
          </div>
          <p className="font-display text-xl font-semibold">
            {formatMoney(item.amountCents, true)}
          </p>
        </article>
      ))}
    </div>
  );
}
