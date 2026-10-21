import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Bot, ShieldAlert, Lock } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useMyPermissions } from "@/hooks/use-backend.ts";
import * as org from "@/lib/org-backend.ts";

const errText = (e: unknown) => (e instanceof Error ? e.message.replace(/^[A-Za-z_]+: /, "") : "Action failed");
const MIN_REASON = 5;
const KIND_LABEL: Record<string, string> = { group: "Group", country_entity: "Country entity", corporate: "Corporate", site: "Site", branch: "Branch", agent: "Agent" };
const CHILD_KINDS: Record<string, string[]> = {
  group: ["country_entity"], country_entity: ["corporate", "branch", "agent"], corporate: ["site", "branch", "agent"],
  site: ["site", "branch", "agent"], branch: ["branch", "agent"], agent: [],
};
const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-destructive text-white", high: "bg-destructive/15 text-destructive", normal: "bg-amber-100 text-amber-700", low: "bg-secondary text-muted-foreground",
};
const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700", in_progress: "bg-accent/15 text-accent", awaiting_approval: "bg-violet-100 text-violet-700",
  escalated: "bg-destructive/10 text-destructive", resolved: "bg-primary/10 text-primary", closed: "bg-secondary text-muted-foreground",
};
const ACTION_LABEL: Record<string, string> = { complete: "Complete the transaction", refund: "Refund the customer", close_dispute: "Close the dispute as resolved" };
const RESOURCES = ["orgs", "profiles", "users", "transactions", "cases", "kyc_sensitive", "reports"];

const btn = "text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary cursor-pointer disabled:opacity-50";
const btnPrimary = "text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground cursor-pointer disabled:opacity-50";
const field = "w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs";

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground bg-card border border-border rounded-2xl p-4">{children}</div>;
}

/* ─── Members + sub-organisations ─────────────────────────────── */

function MembersTab({ org: o, orgs, caps, isSuper }: { org: org.Org; orgs: org.Org[]; caps: Record<string, org.OrgCapability>; isSuper: boolean }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ["org", "members", o.id], queryFn: () => org.orgMembers(o.id), enabled: !!caps.profiles?.canRead, retry: false });
  const tpl = useQuery({ queryKey: ["org", "templates"], queryFn: org.orgTemplates });
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [subName, setSubName] = useState("");
  const [subKind, setSubKind] = useState("");
  const [subCountry, setSubCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const usable = (tpl.data?.templates ?? []).filter((tItem) => tItem.appliesTo.includes(o.kind) && (isSuper || !tItem.groupOnly));
  const kinds = CHILD_KINDS[o.kind] ?? [];
  const kind = subKind || kinds[0] || "";
  const children = orgs.filter((x) => x.parentId === o.id);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["org"] }); };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="text-xs font-bold">{t("organisation.organisationpanel.internalProfilesIn")} {o.name}</div>
        {!caps.profiles?.canRead ? <div className="text-xs text-muted-foreground">{t("organisation.organisationpanel.yourRoleDoesNot")}</div> : (
          <div className="divide-y divide-border">
            {(members.data ?? []).map((m) => (
              <div key={m.memberId} className="py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{m.userName ?? m.userEmail}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{m.userEmail} · {m.templateLabel}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", m.status === "active" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{m.status}</span>
                  {caps.profiles?.canUpdate && (
                    <button className={btn} disabled={busy} onClick={() => void run(() => org.setMemberStatus(m.memberId, m.status === "active" ? "suspended" : "active"), t("Profile updated"))}>
                      {m.status === "active" ? t("team.suspend") : t("team.reactivate")}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {members.data?.length === 0 && <div className="py-2 text-xs text-muted-foreground">{t("organisation.organisationpanel.noInternalProfilesYet")}</div>}
          </div>
        )}
        {caps.profiles?.canCreate && (
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 pt-2 border-t border-border">
            <input className={field} placeholder={t("organisation.organisationpanel.colleagueSPayrusEmail")} value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className={field} value={slug || usable[0]?.slug || ""} onChange={(e) => setSlug(e.target.value)}>
              {usable.map((tItem) => <option key={tItem.slug} value={tItem.slug}>{t(tItem.label)}</option>)}
            </select>
            <button className={btnPrimary} disabled={busy || !email.trim() || !(slug || usable[0])} onClick={() => void run(async () => { await org.grantMemberByEmail({ email, orgId: o.id, templateSlug: slug || usable[0].slug }); setEmail(""); }, t("Profile granted"))}>{t("groups.addMember")}</button>
            <div className="sm:col-span-3 text-[10px] text-muted-foreground">
              {t("organisation.organisationpanel.rolesComeFromGroup")}
              {usable.find((tItem) => tItem.slug === (slug || usable[0]?.slug))?.description && <> {usable.find((tItem) => tItem.slug === (slug || usable[0]?.slug))?.description}</>}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="text-xs font-bold">{t("organisation.organisationpanel.unitsDirectlyBelow")} {o.name}</div>
        <div className="divide-y divide-border">
          {children.map((c) => (
            <div key={c.id} className="py-2 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0"><span className="font-semibold">{c.name}</span> <span className="text-[10px] text-muted-foreground">{t("organisation.organisationpanel.memberS", { kind: KIND_LABEL[c.kind], country: c.country ? ` · ${c.country}` : "", level: c.operatingLevel, count: c.memberCount })}</span></div>
              {(caps.orgs?.canUpdate || isSuper) && (
                <button className={btn} disabled={busy} onClick={() => void run(() => org.setOrgStatus(c.id, c.status === "active" ? "suspended" : "active"), t("Unit updated"))}>{c.status === "active" ? t("team.suspend") : t("team.reactivate")}</button>
              )}
            </div>
          ))}
          {children.length === 0 && <div className="py-2 text-xs text-muted-foreground">{t("organisation.organisationpanel.noSubOrganisations")}</div>}
        </div>
        {caps.orgs?.canCreate && kinds.length > 0 && (
          <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 pt-2 border-t border-border">
            <input className={field} placeholder={t("organisation.organisationpanel.nameOfTheNew")} value={subName} onChange={(e) => setSubName(e.target.value)} />
            <select className={field} value={kind} onChange={(e) => setSubKind(e.target.value)}>{kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
            <input className={cn(field, "sm:w-20")} placeholder={t("p2p.new.country")} maxLength={2} value={subCountry} onChange={(e) => setSubCountry(e.target.value.toUpperCase())} />
            <button className={btnPrimary} disabled={busy || subName.trim().length < 2} onClick={() => void run(async () => { await org.createOrg({ parentId: o.id, kind, name: subName.trim(), country: subCountry || undefined }); setSubName(""); }, t("Unit created"))}>{t("savings.create")}</button>
            <div className="sm:col-span-4 text-[10px] text-muted-foreground">{t("organisation.organisationpanel.theNewUnitInherits")}</div>
          </div>
        )}
        {isSuper && (
          <div className="flex items-center gap-2 pt-2 border-t border-border text-[11px]">
            <span className="text-muted-foreground">{t("organisation.organisationpanel.operatingLevelOf", { name: o.name })}</span>
            <select className="rounded-lg border border-border bg-card px-2 py-1 text-xs" value={o.operatingLevel} onChange={(e) => void run(() => org.setOrgLevel(o.id, e.target.value), t("Operating level updated"))}>
              {(tpl.data?.levels ?? []).map((l) => <option key={l.slug} value={l.slug}>{t("organisation.organisationpanel.depth2", { label: l.label, maxDepth: l.maxDepth })}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Customers (masked) + break-glass ────────────────────────── */

function CustomerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["org", "customer", id], queryFn: () => org.orgCustomerDetail(id), retry: false });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const d = q.data;
  const open = async () => {
    setBusy(true);
    try { await org.requestBreakGlass(id, reason.trim()); toast.success(t("organisation.organisationpanel.sensitiveDataOpenedFor")); setReason(""); void qc.invalidateQueries({ queryKey: ["org"] }); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between"><div className="text-xs font-bold">{t("organisation.organisationpanel.customerRecord")}</div><button className={btn} onClick={onClose}>{t("common.close")}</button></div>
      {q.error && <div className="text-xs text-destructive">{errText(q.error)}</div>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">{t("admin.users.name")}</span><span>{d.name}</span>
            <span className="text-muted-foreground">{t("settings.profile.email")}</span><span>{d.email ?? "—"}</span>
            <span className="text-muted-foreground">{t("settings.profile.phone")}</span><span>{d.phone ?? "—"}</span>
            <span className="text-muted-foreground">{t("organisation.organisationpanel.homeCountry")}</span><span>{d.homeCountry ?? "—"}</span>
            <span className="text-muted-foreground">{t("organisation.organisationpanel.kyc")}</span><span>{d.kycStatus}</span>
            {!d.masked && (<><span className="text-muted-foreground">{t("profile.kyc.dobLabel")}</span><span>{d.dateOfBirth ?? "—"}</span><span className="text-muted-foreground">{t("admin.userspanel.address")}</span><span>{d.address ?? "—"}</span><span className="text-muted-foreground">{t("organisation.organisationpanel.idType")}</span><span>{d.idType ?? "—"}</span></>)}
          </div>
          {d.masked ? (
            <div className="rounded-xl bg-secondary/40 border border-border p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold"><Lock size={12} /> {t("organisation.sensitiveKycStays", { country: d.homeCountry ?? "—" })}</div>
              <div className="text-[11px] text-muted-foreground">{t("organisation.organisationpanel.ifYouMustSee")}</div>
              <textarea className={field} rows={2} placeholder={t("organisation.organisationpanel.whyDoYouNeed")} value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className={btnPrimary} disabled={busy || reason.trim().length < 20} onClick={() => void open()}><ShieldAlert size={11} className="inline mr-1" />{t("organisation.organisationpanel.openSensitiveDataBreak")}</button>
            </div>
          ) : <div className="text-[10px] text-muted-foreground">{t("organisation.organisationpanel.youHaveAccessTo")}</div>}
        </>
      )}
    </div>
  );
}

function CustomersTab({ o }: { o: org.Org }) {
  const { t } = useTranslation("common");
  const q = useQuery({ queryKey: ["org", "customers", o.id], queryFn: () => org.orgCustomers(o.id), retry: false });
  const [sel, setSel] = useState<string | null>(null);
  if (q.error) return <Empty>{errText(q.error)}</Empty>;
  return (
    <div className="space-y-3">
      {sel && <CustomerDetail id={sel} onClose={() => setSel(null)} />}
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {(q.data ?? []).map((c) => (
          <button key={c.id} onClick={() => setSel(c.id)} className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-secondary/30 cursor-pointer">
            <span><span className="font-semibold">{c.maskedName}</span> <span className="text-[10px] text-muted-foreground">{c.maskedEmail}</span></span>
            <span className="text-[10px] text-muted-foreground">{c.homeCountry ?? "—"} {t("organisation.organisationpanel.kyc2")} {c.kycStatus}{c.sensitiveVisible ? t("organisation.organisationpanel.fullAccess") : ""}</span>
          </button>
        ))}
        {q.data?.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">{t("organisation.organisationpanel.noCustomersInThis")}</div>}
      </div>
    </div>
  );
}

/* ─── Transactions initiated in scope ─────────────────────────── */

function TransactionsTab({ o, canCase, onOpenCase }: { o: org.Org; canCase: boolean; onOpenCase: (t: org.OrgTransfer) => void }) {
  const { t } = useTranslation("common");
  const q = useQuery({ queryKey: ["org", "transfers", o.id], queryFn: () => org.orgTransfers(o.id), retry: false });
  if (q.error) return <Empty>{errText(q.error)}</Empty>;
  return (
    <div className="bg-card border border-border rounded-2xl divide-y divide-border">
      <div className="px-4 py-2 text-[10px] text-muted-foreground">{t("organisation.organisationpanel.transactionsInitiatedInThis")}</div>
      {(q.data ?? []).map((tItem) => (
        <div key={tItem.transferId} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0">
            <div className="font-mono font-semibold truncate">{tItem.reference}</div>
            <div className="text-[10px] text-muted-foreground truncate">{t("organisation.homeInitiated", { name: tItem.customerMaskedName, home: tItem.homeCountry ?? "—", origin: tItem.originCountry ?? "—", org: tItem.originOrgName ? `(${tItem.originOrgName})` : "" })}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono">{tItem.amount.toLocaleString()} {tItem.currency}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-secondary">{tItem.state.replace(/_/g, " ")}</span>
            {canCase && <button className={btn} onClick={() => onOpenCase(tItem)}>{t("organisation.organisationpanel.openCase")}</button>}
          </div>
        </div>
      ))}
      {q.data?.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">{t("organisation.organisationpanel.noTransactionsInitiatedHere")}</div>}
    </div>
  );
}

/* ─── Cases ───────────────────────────────────────────────────── */

function AiBox({ caseId, canUse, onUseReply }: { caseId: string; canUse: boolean; onUseReply: (t: string) => void }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["org", "caseAi", caseId], queryFn: () => org.listCaseAi(caseId), retry: false });
  const [busy, setBusy] = useState(false);
  const s = q.data?.[0];
  const p = s?.payload;
  const analyse = async () => {
    setBusy(true);
    try {
      const r = await org.runCaseTriage(caseId);
      toast.success(r.via === "ai" ? "AI analysis ready" : `${r.fallbackReason ?? "AI unavailable"} — showing the built-in rules triage`);
      void qc.invalidateQueries({ queryKey: ["org", "caseAi", caseId] });
      void qc.invalidateQueries({ queryKey: ["org", "case", caseId] });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const mark = async (status: "accepted" | "dismissed") => {
    if (!s) return;
    try { await org.markCaseAi(s.id, status); void qc.invalidateQueries({ queryKey: ["org", "caseAi", caseId] }); } catch (e) { toast.error(errText(e)); }
  };
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          {s?.source === "ai" ? <Sparkles size={12} className="text-primary" /> : <Bot size={12} className="text-muted-foreground" />}
          {s ? (s.source === "ai" ? t("admin.escalationspanel.aiAssistant") : t("admin.escalationspanel.rulesBasedTriage")) : t("organisation.organisationpanel.caseAssistant")}
          {s && <span className="text-[10px] font-normal text-muted-foreground">· {new Date(s.createdAt).toLocaleString()} · {s.status}</span>}
        </div>
        <button className={btn} disabled={busy} onClick={() => void analyse()}>{busy ? t("admin.escalationspanel.analysing") : s ? "Re-analyse" : t("organisation.organisationpanel.analyse")}</button>
      </div>
      {!s && <div className="text-[11px] text-muted-foreground">{t("organisation.organisationpanel.theAssistantSeesOnly")}</div>}
      {p && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            {p.priority && <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", PRIORITY_STYLE[p.priority])}>{p.priority}</span>}
            {p.route && <span className="px-2 py-0.5 rounded-full text-[10px] bg-secondary text-muted-foreground">{t("organisation.organisationpanel.route")} {p.route.replace(/_/g, " ")}</span>}
            {p.suggested_action && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{t("organisation.organisationpanel.suggests")} {ACTION_LABEL[p.suggested_action]}{p.needs_second_approver ? t("organisation.organisationpanel.secondApproverNeeded") : ""}</span>}
            {p.risk_flags.map((f) => <span key={f} className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700">{f.replace(/_/g, " ")}</span>)}
          </div>
          <div className="text-xs font-semibold">{p.summary}</div>
          {p.rationale && <div className="text-[11px] text-muted-foreground">{p.rationale}</div>}
          <div className="text-[11px]"><span className="font-semibold">{t("organisation.organisationpanel.nextStep")}</span> {p.next_step}</div>
          {p.draft_reply && (
            <div className="text-[11px] rounded-lg bg-card border border-border px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">{t("admin.escalationspanel.draftReplyToThe")}</div>{p.draft_reply}
            </div>
          )}
          {canUse && s && s.status === "new" && (
            <div className="flex gap-1.5">
              {p.draft_reply && <button className={btn} onClick={() => onUseReply(p.draft_reply ?? "")}>{t("organisation.organisationpanel.useReplyAsA")}</button>}
              <button className={btn} onClick={() => void mark("accepted")}>{t("organisation.organisationpanel.markAsUsed")}</button>
              <button className={btn} onClick={() => void mark("dismissed")}>{t("organisation.organisationpanel.dismiss")}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CaseDetail({ id, canUpdate, canApprove, onClose }: { id: string; canUpdate: boolean; canApprove: boolean; onClose: () => void }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["org", "case", id], queryFn: () => org.getCase(id), retry: false });
  const [text, setText] = useState("");
  const [action, setAction] = useState("refund");
  const [busy, setBusy] = useState(false);
  const c = q.data;
  const reasonOk = text.trim().length >= MIN_REASON;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["org"] }); };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setText(""); refresh(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  if (q.error) return <Empty>{errText(q.error)}</Empty>;
  if (!c) return <Empty>{t("organisation.organisationpanel.loadingCase")}</Empty>;
  const pending = c.approvals.find((a) => a.status === "pending");
  const finished = c.status === "resolved" || c.status === "closed";
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold">{c.subject}</div>
          <div className="text-[10px] text-muted-foreground font-mono">{t("organisation.organisationpanel.ownedByRaisedBy", { reference: c.reference, kind: c.kind, orgName: c.orgName, raisedOrgName: c.raisedOrgName })}</div>
          <div className={cn("text-[10px]", c.slaBreached ? "text-destructive font-semibold" : "text-muted-foreground")}>{t("organisation.organisationpanel.slaDue")} {new Date(c.slaDueAt).toLocaleString()}{c.slaBreached ? t("organisation.organisationpanel.breached") : ""}{c.escalationLevel > 0 ? ` · escalated ${c.escalationLevel}×` : ""}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", PRIORITY_STYLE[c.priority])}>{c.priority}</span>
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS_STYLE[c.status])}>{c.status.replace(/_/g, " ")}</span>
          <button className={btn} onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
      {c.description && <p className="text-xs">{c.description}</p>}
      <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
        {c.customer && <div className="rounded-lg bg-secondary/40 px-3 py-2">{t("organisation.organisationpanel.customerHomeKyc", { name: c.customer.masked_name, country: c.customer.home_country ?? "—", kyc: c.customer.kyc_status })}</div>}
        {c.transaction && <div className="rounded-lg bg-secondary/40 px-3 py-2"><span className="font-mono">{c.transaction.reference}</span> · {c.transaction.amount} {c.transaction.currency} · {c.transaction.state.replace(/_/g, " ")} · {t("organisation.initiatedIn", { country: c.transaction.origin_country ?? "—" })}</div>}
      </div>

      <AiBox caseId={id} canUse={canUpdate && !finished} onUseReply={(tItem) => setText(tItem)} />

      {c.approvals.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("organisation.organisationpanel.approvalsFourEyes")}</div>
          {c.approvals.map((a) => (
            <div key={a.id} className="rounded-lg border border-border px-3 py-2 text-[11px] space-y-1">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{ACTION_LABEL[a.action]}</span><span className="text-[10px] text-muted-foreground">{a.status}</span></div>
              <div className="text-muted-foreground">{t("organisation.organisationpanel.requested")} {a.request_reason}</div>
              {a.decision_reason && <div className="text-muted-foreground">{t("organisation.organisationpanel.decision")} {a.decision_reason}</div>}
              {a.status === "pending" && canApprove && (
                a.requested_by_me
                  ? <div className="text-[10px] text-amber-700">{t("organisation.organisationpanel.youRequestedThisA")}</div>
                  : <div className="flex gap-1.5">
                      <button className={btnPrimary} disabled={busy || !reasonOk} onClick={() => void run(() => org.decideCaseAction(a.id, true, text.trim()), t("Approved and executed"))}>{t("modules.approve")}</button>
                      <button className={cn(btn, "text-destructive")} disabled={busy || !reasonOk} onClick={() => void run(() => org.decideCaseAction(a.id, false, text.trim()), t("Request rejected"))}>{t("admin.escalationspanel.reject")}</button>
                    </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("invest.timeline")}</div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {c.events.map((e, i) => (
            <div key={i} className="text-[11px] flex gap-2"><span className="text-muted-foreground shrink-0">{new Date(e.at).toLocaleString()}</span><span><span className="font-semibold">{e.event.replace(/_/g, " ")}</span>{e.body ? ` — ${e.body}` : ""}</span></div>
          ))}
        </div>
      </div>

      {!finished && (
        <div className="space-y-2 border-t border-border pt-3">
          <textarea className={field} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("organisation.organisationpanel.commentOrWrittenReason")} />
          <div className="flex gap-1.5 flex-wrap items-center">
            <button className={btn} disabled={busy || !reasonOk} onClick={() => void run(() => org.commentCase(id, text.trim()), t("Comment added"))}>{t("organisation.organisationpanel.addComment")}</button>
            {canUpdate && <button className={btn} disabled={busy || !reasonOk} onClick={() => void run(() => org.escalateCase(id, text.trim()), t("Escalated to the parent organisation"))}>{t("organisation.organisationpanel.escalate")}</button>}
            {canUpdate && !pending && <button className={btn} disabled={busy || !reasonOk} onClick={() => void run(() => org.closeCase(id, "resolved", text.trim()), t("Case resolved"))}>{t("organisation.organisationpanel.resolve")}</button>}
            {canUpdate && !pending && <button className={btn} disabled={busy || !reasonOk} onClick={() => void run(() => org.closeCase(id, "closed", text.trim()), t("Case closed"))}>{t("organisation.organisationpanel.closeWithoutAction")}</button>}
            {c.transaction && !pending && canApprove && (
              <>
                <select className="rounded-lg border border-border bg-card px-2 py-1 text-[11px]" value={action} onChange={(e) => setAction(e.target.value)}>
                  {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className={btnPrimary} disabled={busy || !reasonOk} onClick={() => void run(() => org.requestCaseAction(id, action, text.trim()), t("Sent to a second approver"))}>{t("organisation.organisationpanel.requestApproval")}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CasesTab({ o, caps, seed, clearSeed }: { o: org.Org; caps: Record<string, org.OrgCapability>; seed: org.OrgTransfer | null; clearSeed: () => void }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["org", "cases", o.id, status], queryFn: () => org.listCases(o.id, status || undefined), retry: false, refetchInterval: 60_000 });
  const [form, setForm] = useState({ kind: "complaint", subject: "", description: "", priority: "normal" });
  const [busy, setBusy] = useState(false);
  const kind = seed ? "transaction" : form.kind;
  const create = async () => {
    setBusy(true);
    try {
      await org.createCase({ orgId: o.id, kind, subject: form.subject.trim(), description: form.description.trim() || undefined, priority: form.priority, transferId: seed?.transferId });
      toast.success(t("organisation.organisationpanel.caseOpenedAndRouted")); setForm({ ...form, subject: "", description: "" }); clearSeed(); void qc.invalidateQueries({ queryKey: ["org", "cases"] });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  if (q.error) return <Empty>{errText(q.error)}</Empty>;
  return (
    <div className="space-y-3">
      {caps.cases?.canCreate && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold">{t("organisation.organisationpanel.openACase")}{seed ? ` for ${seed.reference}` : ""}</div>
          <div className="grid sm:grid-cols-[auto_1fr_auto] gap-2">
            <select className={field} value={kind} disabled={!!seed} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {["complaint", "account", "other"].map((k) => <option key={k} value={k}>{k}</option>)}{seed && <option value="transaction">{t("organisation.organisationpanel.transaction")}</option>}
            </select>
            <input className={field} placeholder={t("organisation.organisationpanel.subject")} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <select className={field} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["low", "normal", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </div>
          <textarea className={field} rows={2} placeholder={t("organisation.organisationpanel.whatHappened")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex items-center gap-2">
            <button className={btnPrimary} disabled={busy || form.subject.trim().length < 3} onClick={() => void create()}>{t("organisation.organisationpanel.openCase")}</button>
            {seed && <button className={btn} onClick={clearSeed}>{t("disputes.cancel")}</button>}
            <span className="text-[10px] text-muted-foreground">{t("organisation.organisationpanel.transactionCasesGoTo")}</span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">{t("receipt.status")}</span>
        <select className="rounded-lg border border-border bg-card px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("filter.all")}</option>{org.CASE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      {sel && <CaseDetail id={sel} canUpdate={!!caps.cases?.canUpdate} canApprove={!!caps.transactions?.canUpdate} onClose={() => setSel(null)} />}
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {(q.data ?? []).map((c) => (
          <button key={c.id} onClick={() => setSel(c.id)} className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-secondary/30 cursor-pointer">
            <div className="min-w-0">
              <div className="font-semibold truncate">{c.subject}</div>
              <div className="text-[10px] text-muted-foreground truncate"><span className="font-mono">{c.reference}</span> · {c.kind} · {c.orgName}{c.customerMaskedName ? ` · ${c.customerMaskedName}` : ""}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {c.slaBreached && <span className="text-[10px] font-semibold text-destructive">{t("organisation.organisationpanel.slaBreached")}</span>}
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", PRIORITY_STYLE[c.priority])}>{c.priority}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS_STYLE[c.status])}>{c.status.replace(/_/g, " ")}</span>
            </div>
          </button>
        ))}
        {q.data?.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">{t("organisation.organisationpanel.noCases")}</div>}
      </div>
    </div>
  );
}

/* ─── Sensitive-data access log (home country) ────────────────── */

function AccessLogTab() {
  const { t } = useTranslation("common");
  const q = useQuery({ queryKey: ["org", "breakGlass"], queryFn: org.breakGlassLog, retry: false });
  if (q.error) return <Empty>{errText(q.error)}</Empty>;
  return (
    <div className="bg-card border border-border rounded-2xl divide-y divide-border">
      <div className="px-4 py-2 text-[10px] text-muted-foreground">{t("organisation.organisationpanel.everyTimeStaffOpened")}</div>
      {(q.data ?? []).map((g) => (
        <div key={g.id} className="px-4 py-2.5 text-xs space-y-0.5">
          <div className="flex items-center justify-between gap-2"><span className="font-semibold">{g.requesterName} → {g.targetMaskedName} ({g.homeCountry})</span><span className={cn("text-[10px]", g.active ? "text-amber-700 font-semibold" : "text-muted-foreground")}>{g.active ? t("organisation.organisationpanel.windowOpen") : "closed"}</span></div>
          <div className="text-[11px] text-muted-foreground">{new Date(g.createdAt).toLocaleString()} — {g.reason}</div>
        </div>
      ))}
      {q.data?.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">{t("organisation.organisationpanel.noSensitiveDataAccess")}</div>}
    </div>
  );
}

/* ─── Group-level governance: templates and operating levels ──── */

function GovernanceTab() {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["org", "templates"], queryFn: org.orgTemplates });
  const [busy, setBusy] = useState(false);
  if (!q.data) return <Empty>{t("admin.partnerspanel.loading")}</Empty>;
  const { templates, perms, levels } = q.data;
  const cell = (slug: string, resource: string) => perms.find((p) => p.templateSlug === slug && p.resource === resource);
  const toggle = async (slug: string, resource: string, key: "create" | "read" | "update") => {
    const cur = cell(slug, resource);
    const next = { create: !!cur?.canCreate, read: !!cur?.canRead, update: !!cur?.canUpdate };
    next[key] = !next[key];
    setBusy(true);
    try { await org.setTemplatePermission({ slug, resource, ...next }); void qc.invalidateQueries({ queryKey: ["org", "templates"] }); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 overflow-x-auto">
        <div className="text-xs font-bold">{t("organisation.organisationpanel.roleTemplatesGroupDefined")}</div>
        <div className="text-[10px] text-muted-foreground">{t("organisation.organisationpanel.customersBranchesAndAgents")}</div>
        <table className="w-full text-[11px]">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">{t("organisation.organisationpanel.template")}</th>{RESOURCES.map((r) => <th key={r} className="px-1 font-semibold">{r}</th>)}</tr></thead>
          <tbody>
            {templates.map((tItem) => (
              <tr key={tItem.slug} className="border-t border-border">
                <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{t(tItem.label)}</td>
                {RESOURCES.map((r) => (
                  <td key={r} className="px-1"><div className="flex gap-0.5">
                    {(["create", "read", "update"] as const).map((k) => {
                      const c = cell(tItem.slug, r);
                      const on = k === "create" ? c?.canCreate : k === "read" ? c?.canRead : c?.canUpdate;
                      return <button key={k} disabled={busy} title={`${k} ${r}`} onClick={() => void toggle(tItem.slug, r, k)} className={cn("w-4 h-4 rounded text-[8px] font-bold cursor-pointer", on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{k[0].toUpperCase()}</button>;
                    })}
                  </div></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <div className="text-xs font-bold">{t("organisation.organisationpanel.operatingLevels")}</div>
        {levels.map((l) => (
          <div key={l.slug} className="flex items-center justify-between gap-2 text-xs border-t border-border pt-2 first:border-0 first:pt-0">
            <div><div className="font-semibold">{t(l.label)}</div><div className="text-[10px] text-muted-foreground">{l.description}</div></div>
            <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
              {t("organisation.organisationpanel.depth")}
              <input type="number" min={0} max={8} defaultValue={l.maxDepth} className="w-12 rounded-lg border border-border bg-card px-1.5 py-1" onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== l.maxDepth) void org.setLevelRules({ level: l.slug, maxDepth: v, canCreateSuborgs: v > 0, canManageProfiles: l.canManageProfiles }).then(() => { toast.success(t("organisation.organisationpanel.levelUpdated")); void qc.invalidateQueries({ queryKey: ["org", "templates"] }); }).catch((er) => toast.error(errText(er)));
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Shell ───────────────────────────────────────────────────── */

type Tab = "members" | "customers" | "transactions" | "cases" | "access" | "governance";

export default function OrganisationPanel() {
  const { t } = useTranslation("common");
  const perms = useMyPermissions();
  const isSuper = !!perms?.isSuperadmin;
  const orgsQ = useQuery({ queryKey: ["org", "list"], queryFn: org.listOrgs, retry: false });
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("cases");
  const [seed, setSeed] = useState<org.OrgTransfer | null>(null);
  const orgs = orgsQ.data ?? [];
  const current = orgs.find((x) => x.id === orgId) ?? orgs.find((x) => x.depth === Math.min(...orgs.map((y) => y.depth))) ?? orgs[0];
  const capsQ = useQuery({ queryKey: ["org", "caps", current?.id], queryFn: () => org.orgCapabilities(current!.id), enabled: !!current, retry: false });
  const caps = Object.fromEntries((capsQ.data ?? []).map((c) => [c.resource, c])) as Record<string, org.OrgCapability>;

  if (orgsQ.error) return <Empty>{errText(orgsQ.error)}</Empty>;
  if (orgsQ.isLoading) return <Empty>{t("organisation.organisationpanel.loadingOrganisations")}</Empty>;
  if (!current) return <Empty>{t("organisation.organisationpanel.youAreNotA")}</Empty>;

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "cases", label: "Cases", show: !!caps.cases?.canRead },
    { id: "transactions", label: "Transactions", show: !!caps.transactions?.canRead },
    { id: "customers", label: "Customers", show: !!caps.users?.canRead },
    { id: "members", label: "Profiles & units", show: !!caps.profiles?.canRead || !!caps.orgs?.canRead },
    { id: "access", label: "Sensitive-data access", show: !!caps.kyc_sensitive?.canRead || isSuper },
    { id: "governance", label: "Templates & levels", show: isSuper },
  ];
  const visible = tabs.filter((tItem) => tItem.show);
  const active = visible.find((tItem) => tItem.id === tab) ?? visible[0];

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <label className="text-[10px] font-semibold uppercase text-muted-foreground">{t("registerCustomer.kindOrganisation")}
          <select className="mt-1 block rounded-lg border border-border bg-card px-2 py-1.5 text-xs normal-case font-semibold min-w-56" value={current.id} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((x) => <option key={x.id} value={x.id}>{"— ".repeat(Math.max(0, x.depth - orgs[0].depth))}{x.name}{x.status === "suspended" ? " (suspended)" : ""}</option>)}
          </select>
        </label>
        <div className="text-[11px] text-muted-foreground">
          {KIND_LABEL[current.kind]}{current.country ? ` · ${current.country}` : ""} {t("organisation.organisationpanel.operatingLevel")} <span className="font-semibold text-foreground">{current.operatingLevel}</span>
        </div>
      </div>
      <div className="flex gap-1 p-1 bg-secondary rounded-xl overflow-x-auto">
        {visible.map((tItem) => (
          <button key={tItem.id} onClick={() => setTab(tItem.id)} className={cn("flex-1 whitespace-nowrap py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer", active?.id === tItem.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t(tItem.label)}</button>
        ))}
      </div>
      {!active && <Empty>{t("organisation.organisationpanel.yourRoleInThis")}</Empty>}
      {active?.id === "cases" && <CasesTab o={current} caps={caps} seed={seed} clearSeed={() => setSeed(null)} />}
      {active?.id === "transactions" && <TransactionsTab o={current} canCase={!!caps.cases?.canCreate} onOpenCase={(tItem) => { setSeed(tItem); setTab("cases"); }} />}
      {active?.id === "customers" && <CustomersTab o={current} />}
      {active?.id === "members" && <MembersTab org={current} orgs={orgs} caps={caps} isSuper={isSuper} />}
      {active?.id === "access" && <AccessLogTab />}
      {active?.id === "governance" && <GovernanceTab />}
    </div>
  );
}
