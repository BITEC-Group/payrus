import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase-client.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";

// PRS-IAM-004: when a new terms/privacy version is published, the customer is asked to accept it at next login.
// Service consent is required (cannot be declined and keep using the service); marketing is a separate, unticked choice.
type Pending = { kind: string; version: string };

export default function ConsentGate() {
  const { t } = useTranslation("common");
  const user = useCurrentAppUser();
  const [pending, setPending] = useState<Pending[]>([]);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void supabase.rpc("my_pending_consents", { p_user_id: user.id }).then((res) => {
      // PGRST202 = migration 0068 not applied on this project: nothing to ask.
      if (!cancelled && !res.error && Array.isArray(res.data)) setPending(res.data as Pending[]);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!user?.id || pending.length === 0) return null;

  const accept = async () => {
    setBusy(true);
    setError(null);
    for (const p of pending) {
      const r = await supabase.rpc("record_consent", { p_user_id: user.id, p_kind: p.kind, p_version: p.version, p_granted: true, p_channel: "app" });
      if (r.error) { setError(r.error.message); setBusy(false); return; }
    }
    await supabase.rpc("record_consent", { p_user_id: user.id, p_kind: "marketing", p_version: "v1", p_granted: marketing, p_channel: "app" });
    setPending([]);
    setBusy(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <h2 id="consent-title" className="font-bold text-base">{t("consent.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("consent.body", { docs: pending.map((p) => `${t(`consent.doc.${p.kind}`, { defaultValue: p.kind })} (${p.version})`).join(` ${t("consent.and")} `) })}
        </p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5" />
          <span>{t("consent.marketing")}</span>
        </label>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <button type="button" disabled={busy} onClick={() => void accept()} className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-3 disabled:opacity-60 cursor-pointer">
          {busy ? t("consent.saving") : t("consent.accept")}
        </button>
      </div>
    </div>
  );
}
