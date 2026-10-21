import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { useMyPermissions } from "@/hooks/use-backend.ts";
import PayoutTypesPanel from "./payout-types-panel.tsx";
import {
  contractReadiness, contractTerms, listPriorities, setPriority, draftOfferWithAi, importOffer, integrationTasks, listContracts, listPolicies, recordPrefund, setAdapter,
  setContractStatus, setIntegrationStep, setPolicy, setTermActivation, simulatePricing,
  type ContractRow, type IntegrationTask, type PolicyRow, type ReadinessRow, type SimRow, type TermRow,
} from "@/lib/partners.ts";

type Tab = "contracts" | "pricing" | "types" | "import";
const NEXT: Record<string, string[]> = { draft: ["due_diligence"], due_diligence: ["signed", "draft"], signed: ["active"], active: ["suspended"], suspended: ["active"], terminated: [] };
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground", due_diligence: "bg-amber-100 text-amber-700", signed: "bg-accent/15 text-accent",
  active: "bg-primary/10 text-primary", suspended: "bg-destructive/10 text-destructive", terminated: "bg-secondary text-muted-foreground",
};
const SEV_STYLE: Record<string, string> = { blocker: "bg-destructive text-white", warning: "bg-amber-100 text-amber-700", ok: "bg-primary/10 text-primary" };
const ADAPTERS = ["manual", "simulated", "onafriq_hub", "cinetpay_api", "belmoney_api", "generic_api"];
const METHODS = ["mobile_money", "bank", "cash_pickup"];
const errText = (e: unknown) => (e instanceof Error ? e.message.replace(/^[A-Za-z_]+: /, "") : "Action failed");
const n2 = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 }));
const pct = (n: number | null | undefined) => (n == null ? "—" : `${(Number(n) * 100).toLocaleString(undefined, { maximumFractionDigits: 3 })}%`);
const btn = "text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary cursor-pointer disabled:opacity-50";
const btnPrimary = "text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground cursor-pointer disabled:opacity-50";
const field = "w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs";

function Detail({ c, reload }: { c: ContractRow; reload: () => void }) {
  const { t } = useTranslation("common");
  const [ready, setReady] = useState<ReadinessRow[] | null>(null);
  const [tasks, setTasks] = useState<IntegrationTask[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [amount, setAmount] = useState("");
  const perms = useMyPermissions();
  const [prio, setPrio] = useState<string>("");
  const refresh = useCallback(() => {
    void contractReadiness(c.contractId).then(setReady).catch((e) => toast.error(errText(e)));
    void integrationTasks(c.contractId).then(setTasks).catch(() => undefined);
    void contractTerms(c.contractId).then(setTerms).catch(() => undefined);
    void listPriorities().then((m) => setPrio(String(m[c.contractId] ?? ""))).catch(() => undefined);
  }, [c.contractId]);
  useEffect(refresh, [refresh]);
  const run = (fn: () => Promise<unknown>) => { fn().then(() => { toast.success(t("travel.tabSaved")); refresh(); reload(); }).catch((e) => toast.error(errText(e))); };
  const move = (to: string) => {
    let reason: string | undefined;
    if (["suspended", "draft", "terminated"].includes(to)) { const r = window.prompt(t("Written reason (5+ characters):")); if (r === null) return; reason = r; }
    run(() => setContractStatus(c.contractId, to, reason));
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-bold">{c.partnerName} · {c.reference}</div>
        <div className="flex gap-1.5 flex-wrap">
          {(NEXT[c.status] ?? []).map((s) => <button key={s} className={btn} onClick={() => move(s)}>{t("admin.partnerspanel.moveTo")} {s.replace("_", " ")}</button>)}
          {c.status !== "terminated" && <button className={btn} onClick={() => move("terminated")}>{t("admin.partnerspanel.moveToTerminated")}</button>}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-bold">{t("admin.partnerspanel.readiness")}</div>
        {(ready ?? []).map((r, i) => <div key={i} className="flex items-start gap-2 text-[11px]"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", SEV_STYLE[r.severity])}>{r.severity}</span><span>{r.message}</span></div>)}
      </div>
      <div className="border-t border-border pt-3 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold">{t("admin.partnerspanel.goLiveChecklist")}</span>
          <select className="rounded-lg border border-border bg-card px-2 py-1 text-xs" value={c.integrationAdapter} onChange={(e) => run(() => setAdapter(c.contractId, e.target.value))}>{ADAPTERS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <span className="text-muted-foreground">{c.integrationStatus.replace("_", " ")}</span>
        </div>
        {tasks.map((tItem) => (
          <label key={tItem.step} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={tItem.done} onChange={(e) => run(() => setIntegrationStep(c.contractId, tItem.step, e.target.checked))} />{t(tItem.label)}</label>
        ))}
      </div>
      <div className="border-t border-border pt-3 flex items-center gap-2 flex-wrap text-xs">
        <span className="font-bold">{t("admin.partnerspanel.routingPriority1First")}</span>
        <input className={cn(field, "w-20")} type="number" min={1} max={1000} disabled={!perms?.isSuperadmin} aria-label={t("admin.partnerspanel.routingPriority")} value={prio} onChange={(e) => setPrio(e.target.value)} />
        <button className={btn} disabled={!perms?.isSuperadmin || !Number(prio)} onClick={() => { const r = window.prompt(t("Written reason (5+ characters):")); if (r === null) return; run(() => setPriority(c.contractId, Number(prio), r)); }}>{t("admin.partnerspanel.savePriority")}</button>
        <span className="text-muted-foreground">{t("admin.partnerspanel.lowerNumbersAreUsed")}</span>
      </div>
      <div className="border-t border-border pt-3 flex items-center gap-2 flex-wrap text-xs">
        <span className="font-bold">{t("admin.partnerspanel.prefund")} {n2(c.prefundBalance)} {c.settlementCurrency}</span>
        <input className="rounded-lg border border-border bg-card px-2 py-1 w-28" inputMode="decimal" placeholder={t("payments.amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className={btn} disabled={!Number(amount)} onClick={() => run(async () => { await recordPrefund(c.contractId, Number(amount), "admin"); setAmount(""); })}>{t("admin.partnerspanel.record")}</button>
      </div>
      <div className="border-t border-border pt-3 overflow-x-auto">
        <div className="text-xs font-bold mb-1">{t("admin.partnerspanel.routeTerms", { count: terms.length })}</div>
        <table className="w-full text-[11px]">
          <thead><tr className="text-left text-muted-foreground">{["", "country", "method", "provider", "flat", "%", "basis", "payout ccy", "delivery", "status", ""].map((h, i) => <th key={i} className="py-1 pr-2 font-semibold">{h ? t(h) : h}</th>)}</tr></thead>
          <tbody>
            {terms.map((tItem, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-1 pr-2">{tItem.direction === "payin" ? "in" : "out"}</td><td className="pr-2">{tItem.country}</td><td className="pr-2">{tItem.method}</td><td className="pr-2">{tItem.provider ?? "—"}</td>
                <td className="pr-2">{n2(tItem.flatFee)} {tItem.feeCurrency}</td><td className="pr-2">{pct(tItem.commissionPercent)}</td><td className="pr-2">{tItem.commissionBasis === "gross_margin" ? "margin" : "principal"}</td>
                <td className="pr-2">{tItem.payoutCurrency ?? "—"}</td><td className="pr-2">{tItem.deliveryTime?.replace(/_/g, " ") ?? "—"}</td><td className="pr-2">{tItem.direction === "payout" ? tItem.activation : "—"}</td>
                <td>{tItem.direction === "payout" && (tItem.activation === "approved"
                  ? <button className={btn} onClick={() => run(() => setTermActivation(c.contractId, tItem, "suspended"))}>{t("team.suspend")}</button>
                  : <button className={btn} onClick={() => run(() => setTermActivation(c.contractId, tItem, "approved"))}>{t("modules.approve")}</button>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContractsTab() {
  const { t } = useTranslation("common");
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const load = useCallback(() => { listContracts().then(setRows).catch((e) => toast.error(errText(e))); }, []);
  useEffect(load, [load]);
  const current = rows?.find((r) => r.contractId === sel) ?? null;
  return (
    <div className="space-y-3">
      {rows === null && <div className="text-xs text-muted-foreground">{t("admin.partnerspanel.loading")}</div>}
      {rows?.length === 0 && <div className="text-xs text-muted-foreground">{t("admin.partnerspanel.noPartnerContractsYet")}</div>}
      {(rows ?? []).map((c) => (
        <button key={c.contractId} onClick={() => setSel(c.contractId)} className={cn("w-full text-left bg-card border rounded-2xl p-3 space-y-1 cursor-pointer", sel === c.contractId ? "border-primary" : "border-border")}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold">{c.partnerName} <span className="font-normal text-muted-foreground">· {c.reference}</span></span>
            <span className="flex gap-1.5"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS_STYLE[c.status])}>{c.status.replace("_", " ")}</span><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", c.live ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{c.live ? "live" : t("admin.partnerspanel.notLive")}</span></span>
          </div>
          <div className="text-[10px] text-muted-foreground">{t("admin.partnerspanel.termsAgentsIntegrationPrefund", { terms: c.terms, agents: c.agents, countries: c.countries.join(", "), adapter: c.integrationAdapter, status: c.integrationStatus.replace("_", " "), balance: n2(c.prefundBalance), currency: c.settlementCurrency })}{c.queuedRequests > 0 ? ` ${t("admin.partnerspanel.queuedPayouts", { count: c.queuedRequests })}` : ""}</div>
        </button>
      ))}
      {current && <Detail c={current} reload={load} />}
    </div>
  );
}

const emptyPolicy = (): Omit<PolicyRow, "id" | "active"> => ({
  scope: "global", country: null, method: null, objective: "balanced", marginFlatEur: 0.5, marginPercent: 0.005, minFeeEur: 0.99, maxFeeEur: null,
  premiumFastEur: 0.2, premiumSameDayEur: 0.1, slaWeightEurPerDay: 0.3, fallbackCostEur: 1.5, roundingStep: 0.05,
});

function PricingTab({ isSuper }: { isSuper: boolean }) {
  const { t } = useTranslation("common");
  const [policies, setPolicies] = useState<PolicyRow[] | null>(null);
  const [form, setForm] = useState(emptyPolicy());
  const [sim, setSim] = useState<{ country: string; method: string; amount: string; rows: SimRow[] | null }>({ country: "CD", method: "mobile_money", amount: "100", rows: null });
  const load = useCallback(() => { listPolicies().then(setPolicies).catch((e) => toast.error(errText(e))); }, []);
  useEffect(load, [load]);
  const num = (k: keyof typeof form, label: string, step = "0.01") => (
    <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}
      <input className={cn(field, "mt-1 normal-case font-normal")} type="number" step={step} disabled={!isSuper} value={form[k] == null ? "" : String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value === "" ? null : Number(e.target.value) })} />
    </label>
  );
  const save = () => {
    const reason = window.prompt(t("Written reason (5+ characters):")); if (reason === null) return;
    setPolicy({ ...form, country: form.scope.includes("country") ? form.country : null, method: form.scope.includes("method") ? form.method : null }, reason)
      .then(() => { toast.success(t("policy.saved")); load(); }).catch((e) => toast.error(errText(e)));
  };
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="text-sm font-bold">{t("admin.partnerspanel.pricingPolicy")}</div>
        <div className="text-[11px] text-muted-foreground">{t("admin.partnerspanel.senderFeePartnerCost")}</div>
        {!isSuper && <div className="text-[11px] text-amber-700">{t("admin.partnerspanel.onlyTheSuperadminCan")}</div>}
        {(policies ?? []).map((p) => (
          <button key={p.id} onClick={() => setForm({ ...p })} className="block w-full text-left text-[11px] border-t border-border pt-1.5 cursor-pointer">
            <span className="font-semibold">{p.scope}{p.country ? ` ${p.country}` : ""}{p.method ? ` ${p.method}` : ""}</span> · {t("admin.partnerspanel.policyLine", { objective: p.objective, marginFlat: n2(p.marginFlatEur), marginPct: pct(p.marginPercent), minFee: n2(p.minFeeEur), max: p.maxFeeEur ? t("admin.partnerspanel.maxFee", { value: n2(p.maxFeeEur) }) : "", fast: n2(p.premiumFastEur), sameDay: n2(p.premiumSameDayEur), sla: n2(p.slaWeightEurPerDay), fallback: n2(p.fallbackCostEur) })}
          </button>
        ))}
        <div className="border-t border-border pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">{t("admin.partnerspanel.scope")}
            <select className={cn(field, "mt-1")} disabled={!isSuper} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>{["global", "country", "method", "country_method"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">{t("admin.partnerspanel.country")}
            <input className={cn(field, "mt-1 normal-case font-normal")} maxLength={2} disabled={!isSuper || !form.scope.includes("country")} value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} /></label>
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">{t("admin.partnerspanel.method")}
            <select className={cn(field, "mt-1")} disabled={!isSuper || !form.scope.includes("method")} value={form.method ?? ""} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="">—</option>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">{t("admin.partnerspanel.objective")}
            <select className={cn(field, "mt-1")} disabled={!isSuper} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}>{["balanced", "cheapest", "fastest"].map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          {num("marginFlatEur", "margin flat EUR")}{num("marginPercent", "margin % (0.005)", "0.001")}{num("minFeeEur", "min fee EUR")}{num("maxFeeEur", "max fee EUR")}
          {num("premiumFastEur", "fast premium EUR")}{num("premiumSameDayEur", "same-day premium")}{num("slaWeightEurPerDay", "SLA weight/day")}{num("fallbackCostEur", "fallback cost EUR")}{num("roundingStep", "rounding step")}
        </div>
        <button className={btnPrimary} disabled={!isSuper} onClick={save}>{t("policy.add")}</button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 overflow-x-auto">
        <div className="text-sm font-bold">{t("admin.partnerspanel.priceSimulator")}</div>
        <div className="flex gap-2 flex-wrap items-end">
          <input className={cn(field, "w-16")} maxLength={2} aria-label={t("p2p.new.country")} value={sim.country} onChange={(e) => setSim({ ...sim, country: e.target.value.toUpperCase() })} />
          <select className={cn(field, "w-40")} aria-label={t("payments.method")} value={sim.method} onChange={(e) => setSim({ ...sim, method: e.target.value })}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          <input className={cn(field, "w-24")} inputMode="decimal" aria-label={t("admin.partnerspanel.amountInUsd")} value={sim.amount} onChange={(e) => setSim({ ...sim, amount: e.target.value })} />
          <button className={btnPrimary} onClick={() => simulatePricing(sim.country, sim.method, Number(sim.amount) || 100).then((rows) => setSim((s) => ({ ...s, rows }))).catch((e) => toast.error(errText(e)))}>{t("admin.partnerspanel.simulate")}</button>
        </div>
        {sim.rows && (
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-muted-foreground">{["partner", "contract", "source", "delivery", "partner cost EUR", "sender fee EUR", "score", ""].map((h, i) => <th key={i} className="py-1 pr-2 font-semibold">{h ? t(h) : h}</th>)}</tr></thead>
            <tbody>{sim.rows.map((r, i) => (
              <tr key={i} className={cn("border-t border-border", r.chosen && "bg-primary/5")}>
                <td className="py-1 pr-2">{r.partnerName}{r.provider ? ` · ${r.provider}` : ""}</td><td className="pr-2">{r.contractReference ?? "—"} {r.contractStatus ? `(${r.contractStatus})` : ""}</td><td className="pr-2">{r.source}{r.overridden ? t("admin.partnerspanel.fixed") : ""}</td>
                <td className="pr-2">{r.deliveryTime?.replace(/_/g, " ") ?? "—"}</td><td className="pr-2">{n2(r.costEur)}</td><td className="pr-2 font-bold">{n2(r.feeEur)}</td><td className="pr-2">{n2(r.score)}</td>
                <td>{r.chosen ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{t("admin.partnerspanel.chosen")}</span> : ""}</td>
              </tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ImportTab({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("common");
  const [text, setText] = useState("");
  const [json, setJson] = useState("");
  const [amb, setAmb] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = async () => {
    setBusy(true); setAmb([]);
    const r = await draftOfferWithAi(text);
    setBusy(false);
    if ("error" in r) { toast.error(r.error === "not_configured" ? "AI is not configured — paste the structured JSON below instead." : r.error === "forbidden" ? "Only admin accounts can draft contracts." : "AI is unavailable right now — you can paste structured JSON below."); return; }
    setJson(JSON.stringify(r.draft, null, 2)); setAmb(r.ambiguities);
  };
  const doImport = () => {
    let offer: unknown;
    try { offer = JSON.parse(json); } catch { toast.error(t("admin.partnerspanel.theDraftIsNot")); return; }
    setBusy(true);
    importOffer(offer).then((r) => { toast.success(`Imported as a draft: ${r.termsCreated} terms`); setWarnings(r.warnings); if (r.warnings.length === 0) onDone(); }).catch((e) => toast.error(errText(e))).finally(() => setBusy(false));
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="text-[11px] text-muted-foreground">{t("admin.partnerspanel.pasteAPartnerS")}</div>
      <textarea className={field} rows={7} placeholder={t("admin.partnerspanel.offerText")} value={text} onChange={(e) => setText(e.target.value)} />
      <button className={btnPrimary} disabled={busy || text.trim().length < 20} onClick={() => void draft()}>{busy ? t("admin.partnerspanel.drafting") : t("admin.partnerspanel.draftWithAi")}</button>
      {amb.length > 0 && <div className="space-y-1"><div className="text-xs font-bold">{t("admin.partnerspanel.toConfirmWithThe")}</div>{amb.map((a, i) => <div key={i} className="text-[11px]">• {a}</div>)}</div>}
      <textarea className={cn(field, "font-mono")} rows={12} placeholder={t("admin.partnerspanel.draftJsonEditable")} value={json} onChange={(e) => setJson(e.target.value)} />
      <button className={btnPrimary} disabled={busy || json.trim().length < 10} onClick={doImport}>{t("admin.partnerspanel.importAsDraftContract")}</button>
      {warnings.length > 0 && <div className="space-y-1"><div className="text-xs font-bold">{t("admin.partnerspanel.importWarnings")}</div>{warnings.map((w, i) => <div key={i} className="text-[11px]">• {w}</div>)}</div>}
    </div>
  );
}

// Partner contracts, readiness, integration checklist and the pricing policy (superadmin) — the same workspace as the ops-console "Partners & pricing" screen.
export default function PartnersPanel() {
  const { t } = useTranslation("common");
  const perms = useMyPermissions();
  const [tab, setTab] = useState<Tab>("contracts");
  const tabs: { id: Tab; label: string }[] = [{ id: "contracts", label: "Contracts" }, { id: "pricing", label: "Pricing policy" }, { id: "types", label: "Payout types" }, { id: "import", label: "New from an offer" }];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        {tabs.map((tItem) => <button key={tItem.id} onClick={() => setTab(tItem.id)} className={cn("flex-1 py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer", tab === tItem.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t(tItem.label)}</button>)}
      </div>
      {tab === "contracts" && <ContractsTab />}
      {tab === "pricing" && <PricingTab isSuper={!!perms?.isSuperadmin} />}
      {tab === "types" && <PayoutTypesPanel isSuper={!!perms?.isSuperadmin} />}
      {tab === "import" && <ImportTab onDone={() => setTab("contracts")} />}
    </div>
  );
}
