import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/kids-wallet";
import { KidsPage } from "~/components/layout/kids-page";
import { Button } from "~/components/ui/button";
import { formatMoney } from "~/domain/money/money";
import { t } from "~/lib/i18n";
import { getChildWallet } from "~/services/wallet/wallet.server";
export async function loader({ request }: Route.LoaderArgs) {
  return getChildWallet(request);
}
export default function KidsWallet() {
  const page = useLoaderData<typeof loader>();
  return (
    <KidsPage title={t("kids.wallet")} description={t("wallet.balance")}>
      <section className="rounded-[2rem] bg-primary p-8 text-primary-foreground">
        <p className="font-display text-5xl font-semibold">{formatMoney(page.balanceCents)}</p>
      </section>
      <div className="mt-5 flex gap-3">
        <Button asChild>
          <Link to="/kids/history">{t("kids.history")}</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/kids/home">Volver</Link>
        </Button>
      </div>
    </KidsPage>
  );
}
