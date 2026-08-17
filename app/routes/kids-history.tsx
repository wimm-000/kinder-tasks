import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/kids-history";
import { KidsPage } from "~/components/layout/kids-page";
import { Button } from "~/components/ui/button";
import { TransactionHistory } from "~/routes/app-family-child-wallet";
import { t } from "~/lib/i18n";
import { getChildWallet } from "~/services/wallet/wallet.server";
export async function loader({ request }: Route.LoaderArgs) {
  return getChildWallet(request);
}
export default function KidsHistory() {
  const page = useLoaderData<typeof loader>();
  return (
    <KidsPage title={t("kids.history")} description={t("wallet.title")}>
      <Button variant="ghost" asChild>
        <Link to="/kids/home">Volver</Link>
      </Button>
      <TransactionHistory transactions={page.transactions} />
    </KidsPage>
  );
}
