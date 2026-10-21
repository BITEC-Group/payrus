import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, Plus, Repeat, ShieldCheck, FileSpreadsheet, CheckCircle2, Clock } from "lucide-react";
import PageHeader from "@/components/ui/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet.tsx";
import { cn } from "@/lib/utils.ts";
import { useProfile } from "@/contexts/profile-context.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import {
  useAmortization, useCreateInstRecord, useInstRecords, useMyModules, usePendingApprovals, useRecordKinds, useRunPayroll,
  useRunRecurring, useSetMySubProfile, useSetRecurrence, useSetTally, useSubProfiles, useTransitionInstRecord,
} from "@/hooks/use-institutional.ts";
import { journal, type InstRecord, type RecordKind } from "@/lib/institutional.ts";
import { catText, statusText } from "@/lib/catalog-i18n.ts";
import { useApprovalProgress } from "@/hooks/use-institutional-ops.ts";
import { AgeingPanel, BudgetsPanel, PolicyPanel, ReconcilePanel } from "./panels.tsx";
import { WebhooksPanel } from "./webhooks-panel.tsx";
import { TeamPanel, WorkspaceSwitcher } from "./team-panel.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";

const money = (v: number, cur?: string) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${cur ? " " + cur : ""}`;
const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const OPEN = (r: InstRecord) => !["cancelled", "rejected", "closed", "written_off", "left", "ended", "expired", "sold", "redeemed", "exited"].includes(r.status);

const STATUS_TONE: Record<string, string> = {
  paid: "bg-primary/10 text-primary", received: "bg-primary/10 text-primary", passed: "bg-primary/10 text-primary", closed: "bg-secondary text-muted-foreground",
  active: "bg-primary/10 text-primary", disbursed: "bg-primary/10 text-primary", refunded: "bg-primary/10 text-primary", completed: "bg-primary/10 text-primary",
  overdue: "bg-destructive/10 text-destructive", rejected: "bg-destructive/10 text-destructive", written_off: "bg-destructive/10 text-destructive", lapsed: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-muted-foreground",
};
const tone = (s: string) => STATUS_TONE[s] ?? "bg-amber-500/10 text-amber-600 dark:text-amber-400";

function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/** Module KPIs, computed from the owner's own records (the database stays the source of truth for money). */
function computeKpis(module: string, rs: InstRecord[]): { key: string; label: string; value: string }[] {
  const by = (k: string) => rs.filter((r) => r.kind === k);
  const sum = (a: InstRecord[]) => a.reduce((s, r) => s + r.amount, 0);
  const cur = rs[0]?.currency ?? "";
  const m = (v: number) => money(v, cur);
  const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");
  const today = new Date().toISOString().slice(0, 10);
  switch (module) {
    case "invoicing": {
      const inv = by("invoice"); const sent = inv.filter((r) => r.status === "sent");
      const late = sent.filter((r) => r.dueDate && r.dueDate < today);
      return [
        { key: "outstanding", label: "Outstanding receivables", value: m(sum(sent)) },
        { key: "late", label: "Past due", value: m(sum(late)) },
        { key: "collected", label: "Collected", value: m(sum(inv.filter((r) => r.status === "paid"))) },
        { key: "payables", label: "Bills to pay", value: m(sum(by("vendor_bill").filter((r) => ["draft", "approved"].includes(r.status)))) },
      ];
    }
    case "payroll": {
      const runs = by("payroll_run").filter((r) => r.status !== "cancelled");
      return [
        { key: "headcount", label: "Active employees", value: String(by("employee").filter((r) => r.status === "active").length) },
        { key: "lastnet", label: "Last run (net)", value: runs[0] ? m(runs[0].amount) : "—" },
        { key: "paid", label: "Paid YTD", value: m(sum(runs.filter((r) => r.status === "paid"))) },
        { key: "pending", label: "Awaiting approval", value: String(runs.filter((r) => r.status === "pending_approval").length) },
      ];
    }
    case "grants": {
      const gr = by("grant"); const spent = sum(by("grant_expense").filter((r) => r.status === "paid"));
      const budget = sum(gr);
      return [
        { key: "donations", label: "Donations received", value: m(sum(by("donation").filter((r) => r.status === "received"))) },
        { key: "budget", label: "Grant budget", value: m(budget) },
        { key: "spent", label: "Spent", value: m(spent) },
        { key: "util", label: "Utilisation", value: pct(spent, budget) },
      ];
    }
    case "pension": {
      const v = by("valuation").filter((r) => r.status === "final")[0] ?? by("valuation")[0];
      return [
        { key: "members", label: "Active contributors", value: String(by("pension_member").filter((r) => r.status === "active").length) },
        { key: "contrib", label: "Contributions received", value: m(sum(by("pension_contribution").filter((r) => r.status === "received"))) },
        { key: "paid", label: "Pensions paid", value: m(sum(by("annuity_payment").filter((r) => r.status === "paid"))) },
        { key: "funding", label: "Funding ratio", value: v ? `${Number(v.data.funding_ratio_pct).toFixed(1)}%` : "—" },
      ];
    }
    case "microfinance": case "sacco": {
      const loanKind = module === "sacco" ? "member_loan" : "microloan";
      const live = by(loanKind).filter((r) => ["disbursed", "overdue"].includes(r.status));
      const repaid = sum(rs.filter((r) => r.kind === "loan_repayment" && r.status === "received" && live.some((l) => l.id === r.parentId)));
      const outstanding = Math.max(sum(live) - repaid, 0);
      const par = sum(live.filter((r) => r.status === "overdue"));
      const base = [
        { key: "outstanding", label: "Loan portfolio outstanding", value: m(outstanding) },
        { key: "par", label: "Portfolio at risk", value: pct(par, sum(live)) },
      ];
      return module === "sacco"
        ? [...base, { key: "shares", label: "Share capital", value: m(sum(by("share_capital").filter((r) => r.status === "received"))) },
           { key: "savings", label: "Member savings", value: m(sum(by("member_savings").filter((r) => r.status === "received"))) }]
        : [...base, { key: "clients", label: "Active clients", value: String(by("mfi_client").filter((r) => r.status === "active").length) },
           { key: "groups", label: "Group savings", value: m(sum(by("group_deposit").filter((r) => r.status === "received"))) }];
    }
    case "insurance": {
      const prem = sum(by("premium").filter((r) => r.status === "received")); const claims = sum(by("claim").filter((r) => r.status === "paid"));
      const cession = by("reinsurance_treaty").filter((r) => r.status === "active").reduce((s, r) => s + Number(r.data.cession_pct ?? 0), 0);
      return [
        { key: "premium", label: "Premiums collected", value: m(prem) },
        { key: "claims", label: "Claims paid", value: m(claims) },
        { key: "loss", label: "Loss ratio", value: pct(claims, prem) },
        { key: "ceded", label: "Ceded to reinsurers", value: m(prem * Math.min(cession, 100) / 100) },
      ];
    }
    case "fund": {
      const nav = sum(by("holding").filter((r) => r.status === "held"));
      const units = by("investor").filter((r) => r.status === "active").reduce((s, r) => s + Number(r.data.units ?? 0), 0);
      return [
        { key: "nav", label: "Net asset value", value: m(nav) },
        { key: "units", label: "Units outstanding", value: units.toLocaleString() },
        { key: "navpu", label: "NAV per unit", value: units > 0 ? (nav / units).toFixed(4) : "—" },
        { key: "dist", label: "Yield distributed", value: m(sum(by("yield_distribution").filter((r) => r.status === "paid"))) },
      ];
    }
    case "devfinance": {
      const loans = sum(by("sovereign_loan").filter((r) => ["signed", "effective"].includes(r.status)));
      const disb = sum(by("disbursement").filter((r) => r.status === "paid"));
      return [
        { key: "committed", label: "Committed", value: m(loans) },
        { key: "disbursed", label: "Disbursed", value: m(disb) },
        { key: "undisb", label: "Undisbursed", value: m(Math.max(loans - disb, 0)) },
        { key: "projects", label: "Projects in implementation", value: String(by("dev_project").filter((r) => r.status === "implementation").length) },
      ];
    }
    case "revenue": {
      const a = by("tax_assessment");
      return [
        { key: "assessed", label: "Assessed", value: m(sum(a)) },
        { key: "collected", label: "Collected", value: m(sum(a.filter((r) => r.status === "paid"))) },
        { key: "rate", label: "Collection rate", value: pct(sum(a.filter((r) => r.status === "paid")), sum(a.filter((r) => r.status !== "waived"))) },
        { key: "overdue", label: "Overdue", value: m(sum(a.filter((r) => r.status === "overdue"))) },
      ];
    }
    default: {
      const po = by("purchase_order").filter(OPEN);
      return [
        { key: "committed", label: "Committed (open POs)", value: m(sum(po)) },
        { key: "paid", label: "Paid to suppliers", value: m(sum(by("supplier_payment").filter((r) => r.status === "paid"))) },
        { key: "pending", label: "Payments awaiting approval", value: String(by("supplier_payment").filter((r) => r.status === "draft").length) },
        { key: "orders", label: "Open purchase orders", value: String(po.length) },
      ];
    }
  }
}

/* ───────────────────────── Module launcher ───────────────────────── */
export function ModulesIndex() {
  const { t } = useTranslation("common");
  const { lng } = useParams<{ lng: string }>();
  const { profile } = useProfile();
  const user = useCurrentAppUser();
  const ws = useWorkspace();
  const ownerId = ws.ownerId;
  const mods = useMyModules(ownerId, ws.isSelf ? profile?.type : ws.current?.modulesRole ?? undefined);
  const subs = useSubProfiles().data ?? [];
  const setSub = useSetMySubProfile();
  const approvals = usePendingApprovals(user?.id).data ?? [];
  const allKindsIndexData = useRecordKinds().data;
  const allKindsIndex = useMemo(() => allKindsIndexData ?? [], [allKindsIndexData]);
  const transition = useTransitionInstRecord();
  const choices = ws.isSelf ? subs.filter((s) => s.parentRole === profile?.type) : [];
  const current = mods.data?.[0]?.subProfile ?? null;

  async function pick(slug: string) {
    if (!user || !profile) return;
    try { await setSub.mutateAsync({ userId: user.id, role: profile.type, subProfile: slug }); toast.success(t("modules.specialisationSaved", "Specialisation saved")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function approve(id: string, to: string) {
    if (!user) return;
    try { await transition.mutateAsync({ actorId: user.id, recordId: id, to }); toast.success(t("modules.approved", "Approved")); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title={t("modules.title", "Business modules")} subtitle={t("modules.subtitle", "Tools unlocked by your account specialisation")} showBack={false} />

      <WorkspaceSwitcher workspaces={ws.workspaces} current={ws.current} onSelect={ws.select} />

      {choices.length > 1 || (choices.length === 1 && !current) ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("modules.chooseSpecialisation", "Choose your specialisation")}</h2>
          <p className="text-xs text-muted-foreground">{t("modules.specialisationHint", "Your role stays the same; a specialisation adds the tools your type of organisation needs. You can change it any time.")}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {choices.map((s) => (
              <button key={s.slug} onClick={() => void pick(s.slug)} disabled={setSub.isPending}
                className={cn("text-left rounded-lg border p-3 transition-colors cursor-pointer", current === s.slug ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50")}>
                <div className="flex items-center justify-between"><span className="font-medium text-sm">{s.label}</span>{current === s.slug && <CheckCircle2 size={15} className="text-primary" />}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5">{s.features.join(" · ")}</p>
                {s.enhancedKyc && <p className="text-[11px] text-amber-600 mt-1">{t("modules.enhancedKyc", "Enhanced KYC/AML/FATF verification · dedicated relationship manager")}</p>}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {approvals.length > 0 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck size={15} />{t("modules.approvalsQueue", "Waiting for your approval")} ({approvals.length})</h2>
          {approvals.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 text-sm rounded-lg bg-card border border-border p-3">
              <div className="min-w-0"><div className="font-medium truncate">{a.kindLabel} · {a.title}</div>
                <div className="text-xs text-muted-foreground">{a.ref} · {a.ownerName} · {t("modules.preparedBy", "prepared by")} {a.createdByName}</div></div>
              <div className="flex items-center gap-3 shrink-0"><span className="font-semibold">{money(a.amount, a.currency)}</span>
                <Button size="sm" onClick={() => void approve(a.id, a.toStatus)}>{t("modules.approve", "Approve")}</Button></div>
            </div>
          ))}
        </section>
      )}

      {user && (mods.data ?? []).length > 0 && ws.can("manage_settings") && <PolicyPanel userId={ownerId} kinds={allKindsIndex} />}
      {user && (mods.data ?? []).length > 0 && ws.can("manage_webhooks") && <WebhooksPanel userId={ownerId} />}
      {user && (mods.data ?? []).length > 0 && ws.can("manage_team") && <TeamPanel ownerId={ownerId} />}

      <div className="grid sm:grid-cols-2 gap-3">
        {(mods.data ?? []).map((m) => (
          <Link key={m.moduleKey} to={`/${lng}/modules/${m.moduleKey}`} className="rounded-xl border border-border bg-card p-4 hover:bg-secondary/40 transition-colors">
            <div className="font-semibold text-sm">{m.label}</div>
            <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
          </Link>
        ))}
        {mods.isFetched && (mods.data ?? []).length === 0 && choices.length === 0 && (
          <p className="text-sm text-muted-foreground sm:col-span-2">{t("modules.none", "No business modules are enabled for this profile.")}</p>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Module workspace ───────────────────────── */
export default function ModulePage() {
  const { t } = useTranslation("common");
  const { module = "" } = useParams<{ module: string }>();
  const { profile } = useProfile();
  const user = useCurrentAppUser();
  const ws = useWorkspace();
  const ownerId = ws.ownerId;
  const mods = useMyModules(ownerId, ws.isSelf ? profile?.type : ws.current?.modulesRole ?? undefined);
  const kindsData = useRecordKinds().data;
  const allKinds = useMemo(() => kindsData ?? [], [kindsData]);
  const kinds = useMemo(() => allKinds.filter((k) => k.moduleKey === module).sort((a, b) => a.sortOrder - b.sortOrder), [allKinds, module]);
  const records = useInstRecords(ownerId, module);
  const rs = useMemo(() => records.data ?? [], [records.data]);
  const create = useCreateInstRecord(); const transition = useTransitionInstRecord(); const payroll = useRunPayroll(); const recur = useRunRecurring();
  const [kindSlug, setKindSlug] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<InstRecord | null>(null);
  const [view, setView] = useState<"records" | "reconcile" | "budgets">("records");
  const currency = profile?.currency ?? "XAF";
  const entitled = !mods.isFetched || (mods.data ?? []).some((m) => m.moduleKey === module);
  const kind = kinds.find((k) => k.slug === kindSlug) ?? kinds[0];
  const ranRecurring = useRef(false);

  // Opportunistic: materialise any recurring documents that came due.
  useEffect(() => {
    if (!user || !ownerId || !ws.can("edit") || ranRecurring.current) return;
    ranRecurring.current = true;
    recur.mutateAsync(ownerId).then((n) => { if (n > 0) toast.info(t("modules.recurringGenerated", "{{count}} recurring document(s) generated", { count: n })); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ownerId]);

  const meta = (mods.data ?? []).find((m) => m.moduleKey === module);
  const kpis = useMemo(() => computeKpis(module, rs), [module, rs]);

  async function move(r: InstRecord, to: string) {
    if (!user) return;
    try {
      const res = await transition.mutateAsync({ actorId: user.id, recordId: r.id, to });
      if (res.status !== to && res.data.approvals_need) toast.info(t("modules.approvalRecorded", "Approval recorded: {{have}} of {{need}}. More approvers are needed.", { have: String(res.data.approvals_have), need: String(res.data.approvals_need) }));
      else toast.success(`${r.ref} → ${statusText(t, res.status)}`);
    }
    catch (e) { toast.error((e as Error).message); }
  }
  async function runPayroll() {
    if (!user) return;
    const period = window.prompt(t("modules.payrollPeriod", "Pay period (e.g. 2026-10)"), new Date().toISOString().slice(0, 7));
    if (!period) return;
    try { await payroll.mutateAsync({ userId: ownerId, period, currency }); toast.success(t("modules.payrollCreated", "Payroll run created — submit it for approval")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function exportJournal() {
    if (!user) return;
    try {
      const lines = await journal(user.id);
      downloadCsv(`journal-${new Date().toISOString().slice(0, 10)}.csv`,
        [["Date", "Reference", "Type", "Account code", "Account", "Debit", "Credit", "Currency", "Memo"], ...lines.map((l) => [l.entryDate, l.ref, l.kind, l.accountCode, l.accountName, l.debit, l.credit, l.currency, l.memo])]);
    } catch (e) { toast.error((e as Error).message); }
  }
  function exportRecords() {
    downloadCsv(`${module}-${kind?.slug ?? "records"}.csv`,
      [["Reference", "Title", "Counterparty", "Amount", "Currency", "Status", "Due", "Created"],
        ...rs.filter((r) => !kind || r.kind === kind.slug).map((r) => [r.ref, r.title, r.counterparty, r.amount, r.currency, r.status, r.dueDate, r.createdAt.slice(0, 10)])]);
  }

  if (!entitled) {
    return <div className="p-6 max-w-xl mx-auto text-sm text-muted-foreground">{t("modules.notEnabled", "This module is not enabled for your profile.")} <Link className="text-primary underline" to="..">{t("modules.title", "Business modules")}</Link></div>;
  }

  const shown = rs.filter((r) => !kind || r.kind === kind.slug);
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <PageHeader title={meta?.label ?? catText(t, label(module))} subtitle={meta?.description} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.key} className="rounded-xl bg-card border border-border p-4">
            <div className="text-xs text-muted-foreground">{t(k.label)}</div>
            <div className="text-lg font-semibold mt-1 tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border">
        {([["records", t("modules.tabRecords", "Records")], ["reconcile", t("modules.tabReconcile", "Reconciliation")], ["budgets", t("modules.tabBudgets", "Budgets")]] as const).map(([v, text]) => (
          <button key={v} onClick={() => setView(v)} className={cn("px-3 py-2 text-sm cursor-pointer border-b-2 -mb-px", view === v ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>{text}</button>
        ))}
      </div>
      {view === "reconcile" && user && <ReconcilePanel userId={ownerId} currency={currency} />}
      {view === "budgets" && user && <BudgetsPanel userId={ownerId} currency={currency} moduleKey={module} modules={mods.data ?? []} kinds={allKinds} />}
      {view === "records" && (<>
      {module === "invoicing" && user && <AgeingPanel userId={ownerId} />}

      <div className="flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <button key={k.slug} onClick={() => setKindSlug(k.slug)}
            className={cn("px-3 py-1.5 rounded-full text-sm border cursor-pointer", kind?.slug === k.slug ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary/60")}>
            {k.pluralLabel} <span className="opacity-70">({rs.filter((r) => r.kind === k.slug).length})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {kind && <Button onClick={() => setCreating(true)}><Plus size={15} /> {t("modules.newKind", "New {{kind}}", { kind: kind.label.toLowerCase() })}</Button>}
        {module === "payroll" && <Button variant="outline" onClick={() => void runPayroll()}><Repeat size={15} /> {t("modules.runPayroll", "Run payroll from employee register")}</Button>}
        <Button variant="outline" onClick={exportRecords}><Download size={15} /> {t("modules.csv")}</Button>
        <Button variant="outline" onClick={() => void exportJournal()}><FileSpreadsheet size={15} /> {t("modules.journal", "Accounting journal (CSV)")}</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto w-0 min-w-full">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr><th className="text-left p-3">{t("modules.col.ref", "Reference")}</th><th className="text-left p-3">{t("modules.col.title", "Title")}</th>
              <th className="text-right p-3">{t("modules.col.amount", "Amount")}</th><th className="text-left p-3">{t("modules.col.status", "Status")}</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 cursor-pointer" onClick={() => setDetail(r)}>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{r.ref}{r.data.recurrence ? <Repeat size={11} className="inline ml-1" /> : null}</td>
                <td className="p-3"><div className="font-medium">{r.title}</div>{r.counterparty && <div className="text-xs text-muted-foreground">{r.counterparty}</div>}</td>
                <td className="p-3 text-right tabular-nums whitespace-nowrap">{r.amount > 0 ? money(r.amount, r.currency) : "—"}</td>
                <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-xs", tone(r.status))}>{statusText(t, r.status)}</span></td>
                <td className="p-3 text-right text-xs text-muted-foreground">{r.dueDate ? <span className="inline-flex items-center gap-1"><Clock size={11} />{r.dueDate}</span> : null}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{records.isLoading ? "…" : t("modules.empty", "Nothing here yet.")}</td></tr>}
          </tbody>
        </table>
      </div>
      </>)}

      {kind && creating && <CreateDialog kind={kind} kinds={allKinds} records={rs} currency={currency} onClose={() => setCreating(false)}
        onCreate={async (a) => { if (!user) return; try { await create.mutateAsync({ userId: ownerId, kind: kind.slug, ...a }); toast.success(t("modules.created", "Created")); setCreating(false); } catch (e) { toast.error((e as Error).message); } }} />}
      <DetailSheet record={detail ? rs.find((r) => r.id === detail.id) ?? detail : null} kinds={allKinds} records={rs} onClose={() => setDetail(null)} onMove={move} />
    </div>
  );
}

/* ───────────────────────── Create dialog ───────────────────────── */
type NewRecord = { title: string; counterparty?: string; amount: number; currency: string; dueDate?: string; data: Record<string, unknown>; parentId?: string };

function CreateDialog({ kind, kinds, records, currency, onClose, onCreate }: {
  kind: RecordKind; kinds: RecordKind[]; records: InstRecord[]; currency: string; onClose: () => void; onCreate: (a: NewRecord) => Promise<void>;
}) {
  const { t } = useTranslation("common");
  const [title, setTitle] = useState(""); const [counterparty, setCounterparty] = useState(""); const [amount, setAmount] = useState("");
  const [cur, setCur] = useState(currency); const [due, setDue] = useState(""); const [parentId, setParentId] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [lines, setLines] = useState([{ desc: "", qty: "1", unit_price: "", tax_rate: "0" }]);
  const [busy, setBusy] = useState(false);
  const parents = kind.parentKind ? records.filter((r) => r.kind === kind.parentKind) : [];
  const parentKind = kinds.find((k) => k.slug === kind.parentKind);
  const amountDerived = ["invoice", "valuation", "holding", "payroll_run"].includes(kind.calc ?? "");
  const holdsHolders = kind.calc === "distribution";

  async function submit() {
    setBusy(true);
    const data: Record<string, unknown> = {};
    kind.fields.forEach((f) => { const v = vals[f.key]; if (v !== undefined && v !== "") data[f.key] = f.type === "number" ? Number(v) : v; });
    if (kind.calc === "invoice") data.lines = lines.filter((l) => l.unit_price !== "").map((l) => ({ desc: l.desc, qty: Number(l.qty), unit_price: Number(l.unit_price), tax_rate: Number(l.tax_rate) }));
    await onCreate({ title, counterparty: counterparty || undefined, amount: Number(amount) || 0, currency: cur, dueDate: due || undefined, data, parentId: parentId || undefined });
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("modules.newKind", "New {{kind}}", { kind: kind.label.toLowerCase() })}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {kind.parentKind && (
            <Field label={`${parentKind?.label ?? t("modules.parent", "Parent")} *`}>
              <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">—</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.title}</option>)}
              </select>
            </Field>
          )}
          <Field label={`${t("modules.col.title", "Title")} *`}><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label={t("modules.counterparty", "Counterparty")}><Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} /></Field>
          {!amountDerived && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Field label={`${t("modules.col.amount", "Amount")} *`}><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field></div>
              <Field label={t("modules.currency", "Currency")}><Input value={cur} maxLength={3} onChange={(e) => setCur(e.target.value.toUpperCase())} /></Field>
            </div>
          )}
          {amountDerived && <Field label={t("modules.currency", "Currency")}><Input value={cur} maxLength={3} onChange={(e) => setCur(e.target.value.toUpperCase())} /></Field>}
          {kind.calc === "invoice" && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{t("modules.lines", "Invoice lines")}</div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5">
                  <Input className="col-span-12 sm:col-span-5" placeholder={t("txd.note")} value={l.desc} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
                  <Input className="col-span-4 sm:col-span-2" type="number" placeholder={t("modules.qty")} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                  <Input className="col-span-4 sm:col-span-3" type="number" placeholder={t("modules.unitPrice")} value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} />
                  <Input className="col-span-4 sm:col-span-2" type="number" placeholder={t("modules.vat")} value={l.tax_rate} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, tax_rate: e.target.value } : x))} />
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => setLines([...lines, { desc: "", qty: "1", unit_price: "", tax_rate: "0" }])}><Plus size={13} /> {t("modules.addLine", "Add line")}</Button>
              <div className="text-xs text-muted-foreground">
                {t("modules.total", "Total")}: {money(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0) * (1 + (Number(l.tax_rate) || 0) / 100), 0), cur)}
              </div>
            </div>
          )}
          {holdsHolders && <p className="text-xs text-muted-foreground">{t("modules.distributionHint", "The amount is split pro rata across active members/investors by shares or units held. The last holder absorbs rounding so the total is exact.")}</p>}
          {kind.fields.map((f) => (
            <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
              {f.type === "select" ? (
                <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}>
                  <option value="">—</option>{f.options?.map((o) => <option key={o} value={o}>{catText(t, o)}</option>)}
                </select>
              ) : f.type === "textarea" ? <Textarea value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
                : <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />}
            </Field>
          ))}
          {kind.settle !== "none" || kind.calc === "loan" ? <Field label={t("modules.due", "Due date")}><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field> : null}
          {kind.approvalStatus && <p className="text-xs text-amber-600 flex items-center gap-1.5"><ShieldCheck size={13} />{kind.approvalThreshold ? t("modules.fourEyesAbove", "Four-eyes: a second authorised person must approve amounts of {{n}} or more.", { n: kind.approvalThreshold.toLocaleString() }) : t("modules.fourEyesAlways", "Four-eyes: a second authorised person must approve this.")}</p>}
          <Button className="w-full" disabled={busy || !title.trim()} onClick={() => void submit()}>{t("modules.create", "Create")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label: l, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">{l}</label>{children}</div>;
}

/* ───────────────────────── Detail drawer ───────────────────────── */
function DetailSheet({ record, kinds, records, onClose, onMove }: {
  record: InstRecord | null; kinds: RecordKind[]; records: InstRecord[]; onClose: () => void; onMove: (r: InstRecord, to: string) => Promise<void>;
}) {
  const { t } = useTranslation("common");
  const user = useCurrentAppUser();
  const setTally = useSetTally(); const setRecurrence = useSetRecurrence();
  const kind = kinds.find((k) => k.slug === record?.kind);
  const isLoan = kind?.calc === "loan" && !!record;
  const amort = useAmortization(record?.amount ?? 0, Number(record?.data.rate ?? 0), Number(record?.data.term_months ?? 0), isLoan);
  const [tally, setTallyState] = useState({ f: "", a: "", ab: "" });
  const [every, setEvery] = useState("month");
  const children = record ? records.filter((r) => r.parentId === record.id) : [];
  const next = record && kind ? kind.transitions[record.status] ?? [] : [];
  const progress = useApprovalProgress(user?.id, record?.id, !!record && !!kind?.approvalStatus && next.includes(kind.approvalStatus) && record.amount >= (kind.approvalThreshold ?? 0)).data;
  const gated = (to: string) => kind?.approvalStatus === to && (record?.amount ?? 0) >= (kind.approvalThreshold ?? 0);
  const skip = new Set(["lines", "allocations", "recurrence", "holders", "for", "against", "abstain"]);
  const canRecur = !!record && ["invoice", "vendor_bill", "premium", "pension_contribution", "annuity_payment", "member_savings", "group_deposit", "loan_repayment", "supplier_payment", "grant_expense"].includes(record.kind);

  return (
    <Sheet open={!!record} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {record && kind && (
          <>
            <SheetHeader><SheetTitle>{kind.label} · {record.ref}</SheetTitle></SheetHeader>
            <div className="p-4 space-y-4 text-sm">
              <div><div className="text-lg font-semibold">{record.title}</div>
                <div className="text-muted-foreground">{record.counterparty}</div>
                <div className="mt-1 flex items-center gap-2"><span className="font-semibold">{record.amount > 0 ? money(record.amount, record.currency) : ""}</span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs", tone(record.status))}>{statusText(t, record.status)}</span></div></div>

              {next.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {next.map((to) => (
                    <Button key={to} size="sm" variant={["cancelled", "rejected", "written_off"].includes(to) ? "outline" : "default"} onClick={() => void onMove(record, to)}>
                      {statusText(t, to)}{gated(to) ? " 🔒" : ""}{kind.settleStatus === to && kind.settle !== "none" ? (kind.settle === "in" ? t("modules.moneyIn") : t("modules.moneyOut")) : ""}
                    </Button>
                  ))}
                </div>
              )}
              {progress && progress.required > 1 && next.some(gated) && <p className="text-xs font-medium">{t("modules.approvalProgress", "Approvals: {{have}} of {{need}}", { have: progress.approved, need: progress.required })}</p>}
              {next.some(gated) && <p className="text-xs text-amber-600">{t("modules.gateNote", "🔒 needs a second authorised approver — they will see it under “Waiting for your approval”.")}</p>}

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {record.dueDate && <><dt className="text-muted-foreground">{t("modules.due", "Due date")}</dt><dd>{record.dueDate}</dd></>}
                {Object.entries(record.data).filter(([k]) => !skip.has(k)).map(([k, v]) => {
                  const field = kind.fields.find((f) => f.key === k);
                  return (
                    <div key={k} className="contents"><dt className="text-muted-foreground">{field?.label ?? catText(t, label(k))}</dt>
                      <dd className="break-words">{typeof v === "number" ? v.toLocaleString() : field?.type === "select" ? catText(t, String(v)) : String(v)}</dd></div>
                  );
                })}
              </dl>

              {Array.isArray(record.data.lines) && (
                <Table2 head={[t("modules.th.item", "Item"), t("modules.th.qty", "Qty"), t("modules.th.unitPrice", "Unit price"), t("modules.th.vat", "VAT %"), t("modules.th.net", "Net")]} rows={(record.data.lines as Record<string, unknown>[]).map((l) =>
                  [String(l.desc ?? l.name ?? ""), String(l.qty ?? ""), money(Number(l.unit_price ?? l.gross ?? 0)), String(l.tax_rate ?? l.deduction_pct ?? ""), l.net !== undefined ? money(Number(l.net)) : money(Number(l.qty) * Number(l.unit_price))])} />
              )}
              {Array.isArray(record.data.allocations) && (
                <Table2 head={[t("modules.th.holder", "Holder"), t("modules.th.units", "Units"), t("modules.col.amount", "Amount")]} rows={(record.data.allocations as { name: string; units: number; amount: number }[]).map((a) => [a.name, a.units.toLocaleString(), money(a.amount, record.currency)])} />
              )}
              {isLoan && amort.data && (
                <div><div className="font-medium mb-1">{t("modules.schedule", "Repayment schedule")} · {money(Number(record.data.installment ?? 0), record.currency)} / {t("modules.month", "month")}</div>
                  <Table2 head={["#", t("modules.th.payment", "Payment"), t("modules.th.interest", "Interest"), t("modules.th.principal", "Principal"), t("modules.th.balance", "Balance")]} rows={amort.data.map((r) => [String(r.period), money(r.payment), money(r.interest), money(r.principal), money(r.balance)])} /></div>
              )}

              {kind.calc === "resolution" && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <div className="font-medium">{t("modules.voteTally", "Vote tally")} — {t("modules.for", "for")} {String(record.data.for ?? 0)} · {t("modules.against", "against")} {String(record.data.against ?? 0)} · {t("modules.abstain", "abstain")} {String(record.data.abstain ?? 0)} ({t("modules.quorum", "quorum")} {String(record.data.quorum ?? "—")})</div>
                  {record.status === "open" && (
                    <div className="flex gap-1.5">
                      <Input type="number" placeholder={t("admin.escalationspanel.for")} value={tally.f} onChange={(e) => setTallyState({ ...tally, f: e.target.value })} />
                      <Input type="number" placeholder={t("modules.against2")} value={tally.a} onChange={(e) => setTallyState({ ...tally, a: e.target.value })} />
                      <Input type="number" placeholder={t("modules.abstain2")} value={tally.ab} onChange={(e) => setTallyState({ ...tally, ab: e.target.value })} />
                      <Button size="sm" onClick={async () => { if (!user) return; try { await setTally.mutateAsync({ actorId: user.id, recordId: record.id, votesFor: Number(tally.f) || 0, votesAgainst: Number(tally.a) || 0, abstain: Number(tally.ab) || 0 }); toast.success(t("modules.tallySaved", "Tally saved")); } catch (e) { toast.error((e as Error).message); } }}>{t("modules.save", "Save")}</Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{t("modules.tallyHint", "Closing the vote decides the outcome from the tally and quorum — it cannot be chosen by hand.")}</p>
                </div>
              )}

              {canRecur && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="font-medium flex items-center gap-1.5"><Repeat size={14} />{t("modules.recurring", "Recurring")}{record.data.recurrence ? ` — ${JSON.stringify(record.data.recurrence)}` : ""}</div>
                  <div className="flex gap-2">
                    <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={every} onChange={(e) => setEvery(e.target.value)}>
                      {["week", "month", "quarter", "year"].map((e) => <option key={e} value={e}>{statusText(t, e)}</option>)}
                    </select>
                    <Button size="sm" onClick={async () => { if (!user) return; try { await setRecurrence.mutateAsync({ userId: record.ownerUserId, recordId: record.id, every, next: new Date(Date.now() + 864e5).toISOString().slice(0, 10) }); toast.success(t("modules.recurringSet", "Recurrence set — starts tomorrow")); } catch (e) { toast.error((e as Error).message); } }}>{t("modules.repeat", "Repeat")}</Button>
                    {record.data.recurrence ? <Button size="sm" variant="outline" onClick={async () => { if (!user) return; await setRecurrence.mutateAsync({ userId: record.ownerUserId, recordId: record.id, every: null }); }}>{t("modules.stop", "Stop")}</Button> : null}
                  </div>
                </div>
              )}

              {children.length > 0 && (
                <div><div className="font-medium mb-1">{t("modules.linked", "Linked records")}</div>
                  <Table2 head={[t("modules.col.ref", "Reference"), t("modules.th.type", "Type"), t("modules.col.amount", "Amount"), t("modules.col.status", "Status")]}
                    rows={children.map((c) => [c.ref, kinds.find((k) => k.slug === c.kind)?.label ?? c.kind.replace(/_/g, " "), money(c.amount, c.currency), statusText(t, c.status)])} /></div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Table2({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground"><tr>{head.map((h) => <th key={h} className="text-left p-2">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border/60">{r.map((c, j) => <td key={j} className="p-2 whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
