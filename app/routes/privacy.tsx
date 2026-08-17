import { LegalPage } from "~/components/legal/legal-page";
import { t } from "~/lib/i18n";

export function meta() {
  return [{ title: `${t("legal.privacy.title")} | ${t("app.name")}` }];
}

export default function Privacy() {
  return (
    <LegalPage
      title={t("legal.privacy.title")}
      intro={t("legal.privacy.intro")}
      sections={[
        { title: t("legal.privacy.children.title"), body: t("legal.privacy.children.body") },
        { title: t("legal.privacy.control.title"), body: t("legal.privacy.control.body") },
      ]}
    />
  );
}
