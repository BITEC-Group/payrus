import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Bell, CheckCircle2, Landmark, Trash2, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { cn } from "@/lib/utils.ts";
import { resolveUserByIdentifier } from "@/lib/backend.ts";
import { parseStatementCsv } from "@/lib/institutional-ops.ts";
import type { RecordKind, InstModule } from "@/lib/institutional.ts";
import { catText } from "@/lib/catalog-i18n.ts";
import {
  useAgeing, useApproverLimits, useBankLines, useBudgets, useDeleteBudget, useDeletePolicy, useFollowups, useIgnoreLine, useImportStatement,
  usePolicies, useReconcileLine, useSendFollowup, useSetApproverLimit, useSetBudget, useSetPolicy, useSuggestions,
} from "@/hooks/use-institutional-ops.ts";

const money = (v: number, cur?: string) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${cur ? " " + cur : ""}`;
const select = "w-full h-9 rounded-md border border-input bg-background px-2 text-sm";
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div><h2 className="text-sm font-semibold">{title}</h2>{hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}</div>
      {children}
    </section>
  );
}

/* ───────── Bank statement reconciliation ───────── */
export function ReconcilePanel({ userId, currency }: { userId: string; currency: string }) {
  const { t } = useTranslation("common");
  const lines = useBankLines(userId).data ?? [];
  const suggestionsData = useSuggestions(userId).data;
  const suggestions = useMemo(() => suggestionsData ?? [], [suggestionsData]);
  const importStatement = useImportStatement(); const reconcile = useReconcileLine(); const ignore = useIgnoreLine();
  const [csv, setCsv] = useState("");
  const [cur, setCur] = useState(currency);
  const [busy, setBusy] = useState(false);
  const byLine = useMemo(() => new Map(suggestions.map((s) => [s.lineId, s])), [suggestions]);
  const open = lines.filter((l) => l.status === "unmatched");
  const strong = suggestions.filter((s) => s.score >= 90);

  async function doImport() {
    const parsed = parseStatementCsv(csv);
    if (parsed.length === 0) { toast.error(t("recon.noRows", "No valid rows. Use: date (YYYY-MM-DD), amount, description, reference — money in is positive.")); return; }
    try {
      const r = await importStatement.mutateAsync({ userId, lines: parsed, currency: cur });
      toast.success(t("recon.imported", "{{n}} line(s) imported, {{s}} skipped (duplicates or invalid)", { n: r.imported, s: r.skipped }));
      setCsv("");
    } catch (e) { toast.error(msg(e)); }
  }
  async function match(lineId: string, recordId: string) {
    try { await reconcile.mutateAsync({ actorId: userId, lineId, recordId }); toast.success(t("recon.matched", "Reconciled — the record is settled (no wallet movement)")); }
    catch (e) { toast.error(msg(e)); }
  }
  async function matchAll() {
    setBusy(true);
    let ok = 0;
    for (const s of strong) { try { await reconcile.mutateAsync({ actorId: userId, lineId: s.lineId, recordId: s.recordId }); ok++; } catch { /* skip, shown as still open */ } }
    setBusy(false);
    toast.success(t("recon.matchedMany", "{{n}} line(s) reconciled", { n: ok }));
  }

  return (
    <div className="space-y-4">
      <Card title={t("recon.import", "Import a bank statement")} hint={t("recon.importHint", "Paste CSV rows or load a file: date (YYYY-MM-DD), amount, description, reference. Money in is positive, money out negative. Re-importing the same line is ignored.")}>
        <Textarea rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"2026-10-01,118000,Virement ACME INV-2026-000001,REF1"} />
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-24" value={cur} maxLength={3} onChange={(e) => setCur(e.target.value.toUpperCase())} />
          <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer px-3 h-9 rounded-md border border-input hover:bg-secondary/60">
            <Upload size={14} /> {t("recon.file", "Load file")}
            <input type="file" accept=".csv,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); e.target.value = ""; }} />
          </label>
          <Button disabled={!csv.trim() || importStatement.isPending} onClick={() => void doImport()}><Landmark size={15} /> {t("recon.importBtn", "Import lines")}</Button>
        </div>
      </Card>

      <Card title={`${t("recon.open", "Unreconciled lines")} (${open.length})`} hint={t("recon.openHint", "A suggestion needs the exact amount, currency and direction; a reference or counterparty in the description raises the score.")}>
        {strong.length > 0 && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void matchAll()}><Wand2 size={14} /> {t("recon.matchAll", "Match all strong suggestions")} ({strong.length})</Button>
        )}
        {open.length === 0 && <p className="text-sm text-muted-foreground">{t("recon.none", "Nothing to reconcile.")}</p>}
        <div className="space-y-2">
          {open.map((l) => {
            const s = byLine.get(l.id);
            return (
              <div key={l.id} className="rounded-lg border border-border p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{l.lineDate} · <span className={l.amount > 0 ? "text-primary" : "text-destructive"}>{l.amount > 0 ? "+" : ""}{money(l.amount, l.currency)}</span></div>
                  <div className="text-xs text-muted-foreground truncate">{l.description || "—"}{l.reference ? ` · ${l.reference}` : ""}</div>
                  {s && <div className="text-xs mt-1 inline-flex items-center gap-1 text-primary"><CheckCircle2 size={12} />{s.recordRef} · {s.recordTitle} — {s.reason} ({s.score}%)</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {s && <Button size="sm" onClick={() => void match(l.id, s.recordId)}>{t("recon.match", "Match")}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => void ignore.mutateAsync({ userId, lineId: l.id, ignore: true })}>{t("recon.ignore", "Ignore")}</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {lines.some((l) => l.status !== "unmatched") && (
        <Card title={t("recon.done", "Reconciled and ignored")}>
          <div className="space-y-1 text-xs text-muted-foreground">
            {lines.filter((l) => l.status !== "unmatched").slice(0, 25).map((l) => (
              <div key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.lineDate} · {l.description || "—"}</span><span className="whitespace-nowrap">{money(l.amount, l.currency)} · {l.status}</span></div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ───────── Budgets ───────── */
export function BudgetsPanel({ userId, currency, moduleKey, modules, kinds }: { userId: string; currency: string; moduleKey: string; modules: InstModule[]; kinds: RecordKind[] }) {
  const { t } = useTranslation("common");
  const budgets = useBudgets(userId).data ?? [];
  const setBudget = useSetBudget(); const del = useDeleteBudget();
  const year = new Date().getFullYear();
  const [f, setF] = useState({ name: "", module: moduleKey, kind: "", start: `${year}-01-01`, end: `${year}-12-31`, amount: "", cur: currency, alert: "80" });
  const outKinds = kinds.filter((k) => k.settle === "out" && (!f.module || k.moduleKey === f.module));

  async function add() {
    try {
      await setBudget.mutateAsync({ userId, name: f.name, module: f.module || undefined, kind: f.kind || undefined, start: f.start, end: f.end, amount: Number(f.amount), currency: f.cur, alertPct: Number(f.alert) });
      toast.success(t("budget.saved", "Budget saved")); setF({ ...f, name: "", amount: "" });
    } catch (e) { toast.error(msg(e)); }
  }
  const tone = (s: string) => (s === "over" ? "bg-destructive" : s === "warning" ? "bg-amber-500" : "bg-primary");

  return (
    <div className="space-y-4">
      <Card title={t("budget.title", "Budget vs actual")} hint={t("budget.hint", "Spend is counted from settled outgoing records (payments, payroll, claims, disbursements…) in the period and currency.")}>
        {budgets.length === 0 && <p className="text-sm text-muted-foreground">{t("budget.none", "No budgets yet.")}</p>}
        <div className="space-y-3">
          {budgets.map((b) => (
            <div key={b.budgetId} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0"><span className="font-medium">{b.name}</span> <span className="text-xs text-muted-foreground">{b.moduleKey ?? "all"}{b.kind ? ` · ${b.kind.replace(/_/g, " ")}` : ""} · {b.periodStart} → {b.periodEnd}</span></div>
                <div className="flex items-center gap-2 shrink-0">
                  {b.status !== "ok" && <AlertTriangle size={14} className={b.status === "over" ? "text-destructive" : "text-amber-500"} />}
                  <span className="tabular-nums">{money(b.spent, b.currency)} / {money(b.amount)}</span>
                  <button className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label={t("webhooks.delete")} onClick={() => void del.mutateAsync({ userId, id: b.budgetId })}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className={cn("h-full", tone(b.status))} style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
              <div className="text-xs text-muted-foreground">{b.pct}% · {b.status === "over" ? t("budget.over", "over budget") : b.status === "warning" ? t("budget.warn", "above the {{p}}% alert", { p: b.alertPct }) : t("budget.ok", "on track")}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t("budget.new", "New budget")}>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><Input placeholder={t("budget.name", "Name (e.g. Programme costs 2026)")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <select className={select} value={f.module} onChange={(e) => setF({ ...f, module: e.target.value, kind: "" })}>
            <option value="">{t("budget.allModules", "All modules")}</option>{modules.map((m) => <option key={m.moduleKey} value={m.moduleKey}>{m.label}</option>)}
          </select>
          <select className={select} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="">{t("budget.allKinds", "All outgoing types")}</option>{outKinds.map((k) => <option key={k.slug} value={k.slug}>{k.label}</option>)}
          </select>
          <Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
          <Input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
          <Input type="number" min="0" placeholder={t("budget.amount", "Amount")} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <div className="flex gap-2"><Input value={f.cur} maxLength={3} onChange={(e) => setF({ ...f, cur: e.target.value.toUpperCase() })} /><Input type="number" min="1" max="100" title={t("budget.alert", "Alert at %")} value={f.alert} onChange={(e) => setF({ ...f, alert: e.target.value })} /></div>
        </div>
        <Button disabled={!f.name.trim() || !Number(f.amount)} onClick={() => void add()}>{t("budget.add", "Add budget")}</Button>
      </Card>
    </div>
  );
}

/* ───────── Receivable ageing and follow-ups ───────── */
export function AgeingPanel({ userId }: { userId: string }) {
  const { t } = useTranslation("common");
  const ageing = useAgeing(userId).data ?? [];
  const follow = useFollowups(userId).data ?? [];
  const send = useSendFollowup();
  async function remind(recordId: string) {
    try { await send.mutateAsync({ actorId: userId, recordId }); toast.success(t("ageing.sent", "Follow-up recorded")); } catch (e) { toast.error(msg(e)); }
  }
  if (ageing.length === 0 && follow.length === 0) return null;
  return (
    <Card title={t("ageing.title", "Receivables ageing and follow-ups")} hint={t("ageing.hint", "Follow-up ladder: reminder from 1 day late, second notice from 15 days, final notice from 45 days.")}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ageing.map((b) => (
          <div key={`${b.bucket}${b.currency}`} className="rounded-lg border border-border p-2">
            <div className="text-[11px] text-muted-foreground">{b.bucket}</div>
            <div className="text-sm font-semibold tabular-nums">{money(b.total, b.currency)}</div>
            <div className="text-[11px] text-muted-foreground">{b.invoices} {t("ageing.invoices", "invoice(s)")}</div>
          </div>
        ))}
      </div>
      {follow.length > 0 && (
        <div className="space-y-2">
          {follow.map((f) => (
            <div key={f.recordId} className="rounded-lg border border-border p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-sm">
                <div className="font-medium truncate">{f.ref} · {f.counterparty ?? f.title} — {money(f.amount, f.currency)}</div>
                <div className="text-xs text-muted-foreground">{f.daysOverdue} {t("ageing.days", "days overdue")} · {f.levelLabel}{f.followups > 0 ? ` · ${f.followups} ${t("ageing.done", "sent")}` : ""}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => void remind(f.recordId)}><Bell size={14} /> {t("ageing.send", "Record follow-up")}</Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ───────── Approval policy and per-approver limits ───────── */
export function PolicyPanel({ userId, kinds }: { userId: string; kinds: RecordKind[] }) {
  const { t } = useTranslation("common");
  const policies = usePolicies(userId).data ?? [];
  const limits = useApproverLimits(userId).data ?? [];
  const setPolicy = useSetPolicy(); const delPolicy = useDeletePolicy(); const setLimit = useSetApproverLimit();
  const [p, setP] = useState({ kind: "", min: "0", req: "2" });
  const [lim, setLim] = useState({ who: "", max: "" });
  const gated = kinds.filter((k) => k.approvalStatus);

  async function addPolicy() {
    try { await setPolicy.mutateAsync({ userId, kind: p.kind || undefined, minAmount: Number(p.min) || 0, required: Number(p.req) }); toast.success(t("policy.saved", "Policy saved")); }
    catch (e) { toast.error(msg(e)); }
  }
  async function addLimit() {
    try {
      const u = await resolveUserByIdentifier(lim.who.trim());
      if (!u) { toast.error(t("policy.noUser", "No PayRus member found for that identifier")); return; }
      await setLimit.mutateAsync({ userId, approverId: u.id, max: Number(lim.max) });
      toast.success(t("policy.limitSaved", "Limit saved for {{name}}", { name: u.name })); setLim({ who: "", max: "" });
    } catch (e) { toast.error(msg(e)); }
  }

  return (
    <Card title={t("policy.title", "Approval chains and limits")} hint={t("policy.hint", "Require several different approvers above an amount, and cap what each approver may approve. The person who prepared a record can never approve it.")}>
      <div className="space-y-1.5">
        {policies.length === 0 && <p className="text-sm text-muted-foreground">{t("policy.none", "Default: one second approver above each type's threshold.")}</p>}
        {policies.map((x) => (
          <div key={x.id} className="flex items-center justify-between text-sm rounded-lg border border-border px-3 py-2">
            <span>{x.requiredApprovers} {t("policy.approvers", "approver(s)")} · {x.kindLabel ? catText(t, x.kindLabel) : t("policy.every", "every approval type")} · ≥ {money(x.minAmount)}</span>
            <button className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label={t("webhooks.delete")} onClick={() => void delPolicy.mutateAsync({ userId, id: x.id })}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select className={select} value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value })}>
          <option value="">{t("policy.every", "Every approval type")}</option>{gated.map((k) => <option key={k.slug} value={k.slug}>{k.label}</option>)}
        </select>
        <Input type="number" min="0" title={t("policy.min", "From amount")} value={p.min} onChange={(e) => setP({ ...p, min: e.target.value })} />
        <select className={select} value={p.req} onChange={(e) => setP({ ...p, req: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </div>
      <Button size="sm" variant="outline" onClick={() => void addPolicy()}>{t("policy.add", "Save policy")}</Button>

      <div className="pt-2 border-t border-border space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">{t("policy.limits", "Approver limits")}</div>
        {limits.map((l) => (
          <div key={l.approverUserId} className="flex items-center justify-between text-sm rounded-lg border border-border px-3 py-2">
            <span>{l.approverName} — {t("policy.upTo", "up to")} {money(l.maxAmount)}</span>
            <button className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label={t("team.remove")} onClick={() => void setLimit.mutateAsync({ userId, approverId: l.approverUserId, max: null })}><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2"><Input placeholder={t("policy.who", "Approver email or @username")} value={lim.who} onChange={(e) => setLim({ ...lim, who: e.target.value })} /></div>
          <Input type="number" min="1" placeholder={t("policy.max", "Max amount")} value={lim.max} onChange={(e) => setLim({ ...lim, max: e.target.value })} />
        </div>
        <Button size="sm" variant="outline" disabled={!lim.who.trim() || !Number(lim.max)} onClick={() => void addLimit()}>{t("policy.addLimit", "Set limit")}</Button>
      </div>
    </Card>
  );
}
