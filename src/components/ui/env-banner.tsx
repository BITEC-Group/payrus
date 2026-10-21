// PRS-BR-012 / TC-BR-02: demo, sandbox and pilot environments carry a visible non-production banner,
// so a simulated balance is never mistaken for real money. Set VITE_APP_ENV=production to hide it.
import { useTranslation } from "react-i18next";

export default function EnvBanner() {
  const { t } = useTranslation("common");
  const env = (import.meta.env.VITE_APP_ENV as string | undefined) ?? (import.meta.env.DEV ? "development" : "sandbox");
  if (env === "production") return null;
  return (
    <div role="status" data-testid="env-banner" className="shrink-0 bg-amber-100 text-amber-900 text-[11px] font-semibold text-center px-3 py-1 border-b border-amber-300">
      {t("env.banner", { env: t(`env.name.${env}`, { defaultValue: env }).toUpperCase() })}
    </div>
  );
}
