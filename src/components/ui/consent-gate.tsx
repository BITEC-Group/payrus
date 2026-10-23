import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";

// PRS-IAM-004 / TCX-NEW-02: when a terms/privacy version the customer has not accepted is published, a blocking prompt
// shows on EVERY route (it is mounted at the app root, not inside a layout that can return early) until they accept.
// It fails closed: if the pending-consent check itself fails, the prompt stays up with a retry instead of hiding.
// Service consent is required; marketing is a separate, unticked choice.
type Pending = { kind: string; version: string };
const NOT_APPLIED = "PGRST202"; // migration 0068 absent on this project: nothing to ask

export default function ConsentGate() {
  const { t } = useTranslation("common");
  const user = useCurrentAppUser();
  const queryClient = useQueryClient();
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useQuery({
    queryKey: ["pendingConsents", user?.id],
    enabled: !!user?.id,
    retry: 1,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async (): Promise<Pending[]> => {
      const res = await supabase.rpc("my_pending_consents", { p_user_id: user!.id });
      if (res.error) {
        if (res.error.code === NOT_APPLIED) return [];
        throw new Error(res.error.message);
      }
      return (res.data ?? []) as Pending[];
    },
  });

  if (!user?.id || check.isLoading) return null;
  const pending = check.data ?? [];
  const failedClosed = check.isError;
  if (!failedClosed && pending.length === 0) return null;

  const accept = async () => {
    setBusy(true);
    setError(null);
    for (const p of pending) {
      const r = await supabase.rpc("record_consent", { p_user_id: user.id, p_kind: p.kind, p_version: p.version, p_granted: true, p_channel: "app" });
      if (r.error) { setError(r.error.message); setBusy(false); return; }
    }
    await supabase.rpc("record_consent", { p_user_id: user.id, p_kind: "marketing", p_version: "v1", p_granted: marketing, p_channel: "app" });
    await queryClient.invalidateQueries({ queryKey: ["pendingConsents", user.id] });
    setBusy(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <h2 id="consent-title" className="font-bold text-base">{t("consent.title")}</h2>
        {failedClosed ? (
          <>
            <p className="text-sm text-muted-foreground">{t("consent.checkFailed")}</p>
            <button type="button" onClick={() => void check.refetch()} className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-3 cursor-pointer">
              {t("consent.retry")}
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
