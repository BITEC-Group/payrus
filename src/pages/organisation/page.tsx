import { useTranslation } from "react-i18next";
import PageHeader from "@/components/ui/page-header.tsx";
import OrganisationPanel from "./_components/organisation-panel.tsx";

export default function OrganisationPage() {
  const { t } = useTranslation("common");
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader title={t("registerCustomer.kindOrganisation")} className="mb-4 md:mb-6" />
      <div className="text-xs text-muted-foreground max-w-2xl">
        {t("organisation.runYourOrganisationS")}
      </div>
      <OrganisationPanel />
    </div>
  );
}
