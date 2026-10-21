import { useTranslation } from "react-i18next";
import { useEffect, type ReactNode } from "react";

// PRS-OPS-001 / TCX-OPS-01: the admin cockpit is a separate surface (the Console, with its own SSO/MFA).
// The App no longer renders admin data: /admin hands over to the Console. Set VITE_ADMIN_IN_APP=true to keep
// the legacy in-App panel (still behind the staff MFA gate) while the Console reaches parity.
function cockpitUrl(): string | null {
  if (import.meta.env.VITE_ADMIN_IN_APP === "true") return null;
  const configured = import.meta.env.VITE_CONSOLE_URL as string | undefined;
  if (configured) return configured;
  return import.meta.env.DEV ? "http://localhost:5174" : null;
}

export function AdminCockpitGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const url = cockpitUrl();
  useEffect(() => {
    if (url) window.location.replace(url);
  }, [url]);
  if (!url) return <>{children}</>;
  return (
    <div className="max-w-md mx-auto p-6 text-sm text-muted-foreground" role="status">
      {t("admin.cockpitgate.openingThePayrusAdmin")}
    </div>
  );
}
