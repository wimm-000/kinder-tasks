import { LegalPage } from "~/components/legal/legal-page";
import { t } from "~/lib/i18n";

export function meta() {
  return [{ title: `${t("legal.terms.title")} | ${t("app.name")}` }];
}

export default function Terms() {
  return (
    <LegalPage
      title={t("legal.terms.title")}
      intro={t("legal.terms.intro")}
      sections={[
        { title: t("legal.terms.ledger.title"), body: t("legal.terms.ledger.body") },
        { title: t("legal.terms.availability.title"), body: t("legal.terms.availability.body") },
      ]}
    />
  );
}
