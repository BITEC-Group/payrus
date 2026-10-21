import { Trans, useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  channelTypeReadiness, clearChannelTypeCountry, listChannelTypeCountries, listChannelTypes, setChannelType, setChannelTypeCountry, simulateChannelType,
  type ChannelTypeCountryRow, type ChannelTypeRow, type ChannelTypeSim, type ReadinessRow,
} from "@/lib/partners.ts";

// Payout types — PayRus agent, partner distributor, mobile money, bank remittance: pricing parameters, per-country overrides and onboarding readiness.
const CATEGORIES = ["agent_network", "distribution_partner", "wallet", "bank"];
const METHODS = ["mobile_money", "bank", "cash_pickup"];
const DELIVERY = ["near_real_time", "same_day", "t_plus_1", "t_plus_2"];
const SEV: Record<string, string> = { blocker: "bg-destructive text-white", warning: "bg-amber-100 text-amber-700", ok: "bg-primary/10 text-primary" };
const errText = (e: unknown) => (e instanceof Error ? e.message.replace(/^[A-Za-z_]+: /, "") : "Action failed");
const n2 = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 }));
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const btn = "text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary cursor-pointer disabled:opacity-50";
const btnPrimary = "text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground cursor-pointer disabled:opacity-50";
const inputCls = "w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs mt-1 font-normal normal-case text-foreground disabled:opacity-60";
const labelCls = "text-[10px] font-semibold uppercase text-muted-foreground";

const blankOverride = (code: string): ChannelTypeCountryRow => ({ code, country: "", active: true, ownCostFlatEur: null, ownCostPercent: null, marginFlatEur: null, marginPercent: null, premiumEur: null, minFeeEur: null, maxFeeEur: null, deliveryTime: null });
const blankType = (): ChannelTypeRow => ({
  code: "", label: "", category: "distribution_partner", method: "cash_pickup", agentKind: null, costSource: "partner", active: true, sortOrder: 100, ownCostFlatEur: 0, ownCostPercent: 0,
  marginFlatEur: 0, marginPercent: 0, premiumEur: 0, minFeeEur: null, maxFeeEur: null, deliveryTime: null, onboardingRequirements: [], notes: null, countryOverrides: 0,
});

export default function PayoutTypesPanel({ isSuper }: { isSuper: boolean }) {
  const { t } = useTranslation("common");
  const [types, setTypes] = useState<ChannelTypeRow[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<ChannelTypeRow | null>(null);
  const [ready, setReady] = useState<ReadinessRow[]>([]);
  const [overrides, setOverrides] = useState<ChannelTypeCountryRow[]>([]);
  const [ov, setOv] = useState<ChannelTypeCountryRow | null>(null);
  const [sim, setSim] = useState<{ country: string; amount: string; rows: ChannelTypeSim[] | null }>({ country: "CD", amount: "100", rows: null });
  const load = useCallback(() => { listChannelTypes().then(setTypes).catch((e) => toast.error(errText(e))); }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!sel) return;
    void channelTypeReadiness(sel).then(setReady).catch(() => setReady([]));
    void listChannelTypeCountries(sel).then(setOverrides).catch(() => setOverrides([]));
  }, [sel, types]);
  const pick = (tItem: ChannelTypeRow) => { setSel(tItem.code); setForm({ ...tItem }); setOv(null); setSim((s) => ({ ...s, rows: null })); };
  const ask = () => window.prompt(t("Written reason (5+ characters):"));
  const save = () => {
    if (!form) return; const reason = ask(); if (reason === null) return;
    setChannelType(form, reason).then(() => { toast.success(t("travel.tabSaved")); setSel(form.code); load(); }).catch((e) => toast.error(errText(e)));
  };
  const saveOv = () => {
    if (!ov) return; const reason = ask(); if (reason === null) return;
    setChannelTypeCountry({ ...ov, country: ov.country.toUpperCase() }, reason).then(() => { toast.success(t("travel.tabSaved")); setOv(null); load(); if (sel) void listChannelTypeCountries(sel).then(setOverrides); }).catch((e) => toast.error(errText(e)));
  };
  const numField = (label: string, get: number | null, set: (v: number | null) => void) => (
    <label className={labelCls}>{label}<input className={inputCls} type="number" step="0.01" disabled={!isSuper} value={get == null ? "" : String(get)} onChange={(e) => set(numOrNull(e.target.value))} /></label>
  );
  const ovNum = (label: string, k: "ownCostFlatEur" | "ownCostPercent" | "marginFlatEur" | "marginPercent" | "premiumEur" | "minFeeEur" | "maxFeeEur") => (
    <label className={labelCls}>{label}<input className={inputCls} type="number" step="0.01" disabled={!isSuper} placeholder={t("admin.payouttypespanel.typeDefault")} value={ov?.[k] == null ? "" : String(ov[k])} onChange={(e) => ov && setOv({ ...ov, [k]: numOrNull(e.target.value) })} /></label>
  );
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        {t("admin.payouttypespanel.theTransferPriceVaries")}
      </div>
      {!isSuper && <div className="text-[11px] text-amber-700">{t("admin.payouttypespanel.onlyTheSuperadminCan")}</div>}
      {(types ?? []).map((tItem) => (
        <button key={tItem.code} onClick={() => pick(tItem)} className={cn("w-full text-left bg-card border rounded-2xl p-3 space-y-1 cursor-pointer", sel === tItem.code ? "border-primary" : "border-border")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold">{tItem.label} <span className="font-normal text-muted-foreground">· {tItem.code}</span></span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", tItem.active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>{tItem.active ? "on" : "off"}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {t("admin.payouttypespanel.typeLine", { category: tItem.category.replace("_", " "), method: tItem.method, cost: tItem.costSource === "own" ? t("admin.payouttypespanel.ownCost", { flat: n2(tItem.ownCostFlatEur), pct: n2(tItem.ownCostPercent * 100) }) : t("admin.payouttypespanel.partnerTerms"), marginFlat: n2(tItem.marginFlatEur), marginPct: n2(tItem.marginPercent * 100), delivery: tItem.deliveryTime?.replace(/_/g, " ") ?? t("admin.payouttypespanel.deliveryFromTerms"), overrides: tItem.countryOverrides > 0 ? t("admin.payouttypespanel.overrides", { n: tItem.countryOverrides }) : "" })}
          </div>
        </button>
      ))}
      <button className={btn} disabled={!isSuper} onClick={() => { setSel(null); setForm(blankType()); setOv(null); }}>{t("admin.payouttypespanel.addAPayoutType")}</button>

      {form && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="text-sm font-bold">{form.code && sel ? `Set up: ${form.label}` : t("admin.payouttypespanel.newPayoutType")}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className={labelCls}>{t("admin.payouttypespanel.code")}<input className={inputCls} disabled={!isSuper || !!sel} maxLength={30} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} /></label>
            <label className={labelCls}>{t("admin.payouttypespanel.label")}<input className={inputCls} disabled={!isSuper} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
            <label className={labelCls}>{t("admin.payouttypespanel.category")}<select className={inputCls} disabled={!isSuper} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select></label>
            <label className={labelCls}>{t("p2p.new.methodLabel")}<select className={inputCls} disabled={!isSuper} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
            <label className={labelCls}>{t("profile.feat.agent_network")}<select className={inputCls} disabled={!isSuper} value={form.agentKind ?? ""} onChange={(e) => setForm({ ...form, agentKind: e.target.value || null })}><option value="">—</option><option value="payrus_direct">{t("admin.payouttypespanel.payrusDirectAgents")}</option><option value="correspondent">{t("admin.payouttypespanel.partnerAgents")}</option></select></label>
            <label className={labelCls}>{t("admin.payouttypespanel.costComesFrom")}<select className={inputCls} disabled={!isSuper} value={form.costSource} onChange={(e) => setForm({ ...form, costSource: e.target.value })}><option value="partner">{t("admin.payouttypespanel.partnerContractTerms")}</option><option value="own">{t("admin.payouttypespanel.payrusOwnCost")}</option></select></label>
            <label className={labelCls}>{t("admin.payouttypespanel.defaultDelivery")}<select className={inputCls} disabled={!isSuper} value={form.deliveryTime ?? ""} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value || null })}><option value="">{t("admin.payouttypespanel.fromTerms")}</option>{DELIVERY.map((d) => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}</select></label>
            {numField(t("Sort order"), form.sortOrder, (v) => setForm({ ...form, sortOrder: v ?? 100 }))}
            {numField(t("Own cost flat EUR"), form.ownCostFlatEur, (v) => setForm({ ...form, ownCostFlatEur: v ?? 0 }))}
            {numField(t("Own cost % (0.008)"), form.ownCostPercent, (v) => setForm({ ...form, ownCostPercent: v ?? 0 }))}
            {numField(t("Type margin flat EUR"), form.marginFlatEur, (v) => setForm({ ...form, marginFlatEur: v ?? 0 }))}
            {numField(t("Type margin % (0.005)"), form.marginPercent, (v) => setForm({ ...form, marginPercent: v ?? 0 }))}
            {numField(t("Premium EUR"), form.premiumEur, (v) => setForm({ ...form, premiumEur: v ?? 0 }))}
            {numField(t("Min fee EUR"), form.minFeeEur, (v) => setForm({ ...form, minFeeEur: v }))}
            {numField(t("Max fee EUR"), form.maxFeeEur, (v) => setForm({ ...form, maxFeeEur: v }))}
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={!isSuper} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />{t("admin.payouttypespanel.offeredToSenders")}</label>
          <label className={cn(labelCls, "block")}>{t("admin.payouttypespanel.onboardingRequirementsOnePer")}
            <textarea className={inputCls} rows={5} disabled={!isSuper} value={form.onboardingRequirements.join("\n")} onChange={(e) => setForm({ ...form, onboardingRequirements: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) })} /></label>
          <label className={cn(labelCls, "block")}>{t("admin.payouttypespanel.notes")}<input className={inputCls} disabled={!isSuper} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} /></label>
          <button className={btnPrimary} disabled={!isSuper || !form.code || !form.label} onClick={save}>{t("admin.payouttypespanel.savePayoutType")}</button>

          {sel && (
            <>
              <div className="border-t border-border pt-3 space-y-1.5">
                <div className="text-xs font-bold">{t("admin.payouttypespanel.onboardingReadiness")}</div>
                {ready.map((r, i) => <div key={i} className="flex items-start gap-2 text-[11px]"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", SEV[r.severity])}>{r.severity}</span><span>{r.message}</span></div>)}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="text-xs font-bold">{t("admin.payouttypespanel.countryOverrides")}</div>
                {overrides.length === 0 && <div className="text-[11px] text-muted-foreground">{t("admin.payouttypespanel.noneEveryCountryFollows")}</div>}
                {overrides.map((o) => (
                  <div key={o.country} className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="font-bold">{o.country}</span><span>{o.active ? "on" : "off"}</span>
                    <span className="text-muted-foreground">{t("admin.payouttypespanel.marginOwnPremiumFee", { marginFlat: n2(o.marginFlatEur), marginPercent: n2(o.marginPercent), ownFlat: n2(o.ownCostFlatEur), ownPercent: n2(o.ownCostPercent), premium: n2(o.premiumEur), minFee: n2(o.minFeeEur), maxFee: n2(o.maxFeeEur) })}</span>
                    <button className={btn} onClick={() => setOv({ ...o })}>{t("savings.edit")}</button>
                    <button className={btn} disabled={!isSuper} onClick={() => { const r = ask(); if (r === null) return; clearChannelTypeCountry(o.code, o.country, r).then(() => { toast.success(t("admin.payouttypespanel.removed")); load(); }).catch((e) => toast.error(errText(e))); }}>{t("team.remove")}</button>
                  </div>
                ))}
                <button className={btn} disabled={!isSuper} onClick={() => setOv(blankOverride(sel))}>{t("admin.payouttypespanel.addACountryOverride")}</button>
                {ov && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className={labelCls}>{t("p2p.new.country")}<input className={inputCls} maxLength={2} disabled={!isSuper} value={ov.country} onChange={(e) => setOv({ ...ov, country: e.target.value.toUpperCase() })} /></label>
                    {ovNum(t("Own cost flat EUR"), "ownCostFlatEur")}{ovNum(t("Own cost %"), "ownCostPercent")}{ovNum(t("Margin flat EUR"), "marginFlatEur")}{ovNum(t("Margin %"), "marginPercent")}{ovNum(t("Premium EUR"), "premiumEur")}{ovNum(t("Min fee EUR"), "minFeeEur")}{ovNum(t("Max fee EUR"), "maxFeeEur")}
                    <label className={labelCls}>{t("remittance.delivery")}<select className={inputCls} disabled={!isSuper} value={ov.deliveryTime ?? ""} onChange={(e) => setOv({ ...ov, deliveryTime: e.target.value || null })}><option value="">{t("admin.payouttypespanel.typeDefault")}</option>{DELIVERY.map((d) => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}</select></label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={!isSuper} checked={ov.active} onChange={(e) => setOv({ ...ov, active: e.target.checked })} />{t("admin.payouttypespanel.offeredHere")}</label>
                    <div><button className={btnPrimary} disabled={!isSuper || ov.country.length !== 2} onClick={saveOv}>{t("admin.payouttypespanel.saveOverride")}</button></div>
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="text-xs font-bold">{t("admin.payouttypespanel.priceCheck")}</div>
                <div className="flex items-end gap-2 flex-wrap">
                  <label className={labelCls}>{t("p2p.new.country")}<input className={cn(inputCls, "w-16")} maxLength={2} value={sim.country} onChange={(e) => setSim({ ...sim, country: e.target.value.toUpperCase() })} /></label>
                  <label className={labelCls}>{t("admin.payouttypespanel.amountUsd")}<input className={cn(inputCls, "w-24")} inputMode="decimal" value={sim.amount} onChange={(e) => setSim({ ...sim, amount: e.target.value })} /></label>
                  <button className={btnPrimary} onClick={() => simulateChannelType(sim.country, sel, Number(sim.amount) || 100).then((rows) => setSim((s) => ({ ...s, rows }))).catch((e) => toast.error(errText(e)))}>{t("admin.partnerspanel.simulate")}</button>
                </div>
                {sim.rows?.map((r, i) => <div key={i} className="text-[11px]"><Trans i18nKey="admin.payouttypespanel.simRow" values={{ fee: n2(r.feeEur), cost: n2(r.costEur), partner: r.partnerName ?? t("savings.payrusNetwork"), delivery: r.deliveryTime?.replace(/_/g, " ") ?? "—", source: r.source }} components={{ b: <span className="font-bold" /> }} /></div>)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
