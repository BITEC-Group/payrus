import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { Save, RefreshCw, History, AlertTriangle, UserCheck } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import {
  useCurrentFxMarginConfig, useUpdateFxMarginConfigMutation,
  useAdminBlockedTransfers, useAdminResolveTransferMutation,
  useAdminPendingProfiles, useAdminUpdateUserRoleMutation,
} from "@/hooks/use-backend.ts";
import { getLastFxRateUpdate, type FxRateUpdate } from "@/lib/backend.ts";
import { useQuery as useReactQuery } from "@tanstack/react-query";

// A transfer's own resolution target is deliberately narrow — 'pending'
// (retry, from 'failed') or 'resolved'/'refunded' (from 'disputed' or
// 'refund_pending') — matching exactly the recovery paths
// transfer_state_transitions (0005/0013) actually allows; the RPC's own
// trigger-backed guard is still the real enforcement, this is just so the
// dropdown doesn't offer states that would always be rejected.
const RESOLUTION_OPTIONS: Record<string, string[]> = {
  failed: ["pending"],
  disputed: ["resolved", "refunded"],
  refund_pending: ["refunded"],
};

function BlockedTransfersSection() {
  const { t } = useTranslation("common");
  const transfers = useAdminBlockedTransfers();
  const resolveTransfer = useAdminResolveTransferMutation();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [targetState, setTargetState] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleResolve = async (transferId: string) => {
    if (!targetState || !password) return;
    setSaving(true);
    try {
      await resolveTransfer({ transferId, newState: targetState, password });
      toast.success(t("admin.configpanel.transferUpdated"));
      setResolvingId(null);
      setPassword("");
    } catch {
      toast.error(t("admin.configpanel.couldnTResolveThis"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={14} className="text-destructive" />
        <div className="text-sm font-bold text-foreground">{t("admin.configpanel.blockedTransfers")}</div>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        {t("admin.configpanel.transfersStuckInFailed")}
      </div>
      {!transfers && <div className="text-xs text-muted-foreground py-2">{t("common.loading")}</div>}
      {transfers && transfers.length === 0 && <div className="text-xs text-muted-foreground py-2">{t("admin.configpanel.nothingBlockedRightNow")}</div>}
      <div className="space-y-2">
        {transfers?.map((tItem) => (
          <div key={tItem.transferId} className="rounded-xl bg-secondary/40 p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{tItem.reference} · {tItem.userName ?? tItem.userEmail ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground">{t("admin.blockedTransferLine", { currency: tItem.currency, amount: tItem.amount.toLocaleString(), state: tItem.state, date: new Date(tItem.createdAt).toLocaleDateString() })}</div>
              </div>
              <button
                onClick={() => setResolvingId(resolvingId === tItem.transferId ? null : tItem.transferId)}
                className="text-[10px] font-semibold text-primary cursor-pointer shrink-0"
              >
                {resolvingId === tItem.transferId ? t("disputes.cancel") : t("organisation.organisationpanel.resolve")}
              </button>
            </div>
            {resolvingId === tItem.transferId && (
              <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-2 flex-wrap">
                <select
                  value={targetState}
                  onChange={(e) => setTargetState(e.target.value)}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <option value="">{t("admin.configpanel.moveTo")}</option>
                  {(RESOLUTION_OPTIONS[tItem.state] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("admin.accesspanel.adminPassword")}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs flex-1 min-w-[120px]"
                />
                <button
                  onClick={() => void handleResolve(tItem.transferId)}
                  disabled={saving || !targetState || !password}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? t("admin.accesspanel.saving") : t("common.confirm")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingProfilesSection() {
  const { t } = useTranslation("common");
  const profiles = useAdminPendingProfiles();
  const updateRole = useAdminUpdateUserRoleMutation();
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleActivate = async (roleId: string) => {
    setActivatingId(roleId);
    try {
      await updateRole({ roleId, status: "verified" });
      toast.success(t("admin.configpanel.profileActivated"));
    } catch {
      toast.error(t("admin.configpanel.couldnTActivateThis"));
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <UserCheck size={14} className="text-primary" />
        <div className="text-sm font-bold text-foreground">{t("admin.configpanel.profilesAwaitingActivation")}</div>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        {t("admin.configpanel.incompleteOrPendingVerification")}
      </div>
      {!profiles && <div className="text-xs text-muted-foreground py-2">{t("common.loading")}</div>}
      {profiles && profiles.length === 0 && <div className="text-xs text-muted-foreground py-2">{t("admin.configpanel.nothingPendingRightNow")}</div>}
      <div className="space-y-2">
        {profiles?.map((p) => (
          <div key={p.roleId} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 p-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{p.userName ?? p.userEmail ?? "—"} · {p.role}</div>
              <div className="text-[10px] text-muted-foreground">{p.kind} {t("admin.configpanel.status")} {p.status}</div>
            </div>
            <button
              onClick={() => void handleActivate(p.roleId)}
              disabled={activatingId === p.roleId}
              className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 cursor-pointer disabled:opacity-60 shrink-0"
            >
              {activatingId === p.roleId ? t("admin.configpanel.activating") : t("admin.configpanel.activate")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Super-admin configuration screen: the FX margin/commission PayRus adds on
// top of the mid-market rate (supabase/migrations/
// 0013_fx_margin_config_and_live_rates.sql's fx_margin_config, starting at
// 30% margin per product decision — see supabase/scripts/
// fx-margin-benchmark.mjs), plus a manual trigger for the same live-rate
// refresh the 6-hourly cron (App/convex/crons.ts) runs automatically.
// Gated by the same "Admin" password this codebase already uses for every
// other privilege-escalation point (admin_create_user/admin_grant_admin_role,
// 0007/0008) — see 0013's own comment on why this reuses that gate rather
// than introducing a separate "super admin" role/table for one screen.
export default function ConfigPanel() {
  const { t } = useTranslation("common");
  const current = useCurrentFxMarginConfig();
  const updateConfig = useUpdateFxMarginConfigMutation();
  const refreshRates = useAction(api.fxRates.refreshLiveFxRates);
  const { data: lastRateUpdate, refetch: refetchLastUpdate } = useReactQuery<FxRateUpdate | null>({
    queryKey: ["lastFxRateUpdate"],
    queryFn: getLastFxRateUpdate,
  });

  const [marginPct, setMarginPct] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const marginValue = marginPct.trim() ? Number(marginPct) / 100 : current?.marginRate;
  const commissionValue = commissionPct.trim() ? Number(commissionPct) / 100 : current?.commissionRate;

  const handleSave = async () => {
    if (marginValue == null || commissionValue == null) return;
    if (!password) {
      toast.error(t("admin.configpanel.theAdminPasswordIs"));
      return;
    }
    setSaving(true);
    try {
      await updateConfig({
        marginRate: marginValue, commissionRate: commissionValue,
        decider: "super_admin", note: note.trim() || undefined, password,
      });
      toast.success(t("admin.configpanel.configurationUpdated"));
      setMarginPct("");
      setCommissionPct("");
      setNote("");
      setPassword("");
    } catch {
      toast.error(t("admin.accesspanel.incorrectAdminPassword"));
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshRates = async () => {
    setRefreshing(true);
    try {
      const result = await refreshRates({});
      if (result.error) {
        toast.error(`Refresh failed: ${result.error}`);
      } else {
        toast.success(`Updated ${result.updated} currencies from ${result.source}`);
        void refetchLastUpdate();
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="text-sm font-bold text-foreground mb-1">{t("admin.configpanel.fxMarginCommission")}</div>
        <div className="text-xs text-muted-foreground mb-4">
          {t("admin.configpanel.appliedToEveryQuote")}
        </div>

        {current && (
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-secondary/40">
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("admin.configpanel.currentMargin")}</div>
              <div className="text-lg font-bold text-foreground">{(current.marginRate * 100).toFixed(1)}%</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("admin.configpanel.currentCommission")}</div>
              <div className="text-lg font-bold text-foreground">{(current.commissionRate * 100).toFixed(1)}%</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("admin.configpanel.setBy")}</div>
              <div className="text-xs font-semibold text-foreground truncate">{current.decider}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold uppercase text-muted-foreground">{t("admin.configpanel.newMargin")}</label>
            <input
              type="number" step="0.1" min="0" max="99"
              value={marginPct}
              onChange={(e) => setMarginPct(e.target.value)}
              placeholder={current ? (current.marginRate * 100).toFixed(1) : "30"}
              className="mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase text-muted-foreground">{t("admin.configpanel.newCommission")}</label>
            <input
              type="number" step="0.1" min="0" max="99"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              placeholder={current ? (current.commissionRate * 100).toFixed(1) : "3.5"}
              className="mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">{t("p2p.new.note")}</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("admin.configpanel.whyIsThisChanging")}
            className="mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">{t("admin.accesspanel.adminPassword")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm"
          />
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer disabled:opacity-60"
        >
          <Save size={13} /> {saving ? t("admin.accesspanel.saving") : t("admin.configpanel.saveConfiguration")}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="text-sm font-bold text-foreground mb-1">{t("fx.pill.titleNoTime")}</div>
        <div className="text-xs text-muted-foreground mb-4">
          {t("admin.configpanel.automaticallyRefreshedEvery6")}
        </div>
        {lastRateUpdate && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
            <History size={12} />
            {t("admin.configpanel.lastRatesUpdate", { date: new Date(lastRateUpdate.fetchedAt).toLocaleString(), n: lastRateUpdate.currenciesUpdated, source: lastRateUpdate.source })}
          </div>
        )}
        <button
          onClick={() => void handleRefreshRates()}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-semibold cursor-pointer hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> {refreshing ? t("admin.configpanel.refreshing") : t("admin.configpanel.refreshRatesNow")}
        </button>
        <div className="mt-3 text-[10px] text-muted-foreground">{t("settings.about.fxTickerAttribution")}</div>
      </div>

      <BlockedTransfersSection />
      <PendingProfilesSection />
    </div>
  );
}
