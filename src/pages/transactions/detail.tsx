import { useState } from "react";
import { localizeTransferNote } from "@/lib/db-notifications.ts";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowDownLeft, ArrowLeft, Banknote, Copy, CreditCard, FileDown, Flag, Globe, MapPin, Plus, Receipt, Repeat, Send, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import PageHeader from "@/components/ui/page-header.tsx";
import TransactionReceipt from "@/components/ui/transaction-receipt.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useFeatureAccess } from "@/hooks/use-feature-access.ts";
import { useRecentTransfersForUser, useTransactionDetail } from "@/hooks/use-backend.ts";
import type { AppTransfer, TransactionDetail } from "@/lib/backend.ts";

const CREDIT_TX_TYPES = new Set(["deposit", "convert_in"]);
const TYPE_ICONS: Record<AppTransfer["type"], typeof Send> = { transfer: Send, payment: CreditCard, remittance: Globe, deposit: Plus, convert_out: Repeat, convert_in: Repeat };
const STATE_TONE: Record<string, string> = {
  paid: "bg-primary/10 text-primary", resolved: "bg-primary/10 text-primary", refunded: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive", reversed: "bg-destructive/10 text-destructive", cancelled: "bg-destructive/10 text-destructive", expired: "bg-destructive/10 text-destructive",
};
const PAYOUT_TONE: Record<string, string> = {
  paid_out: "bg-primary/10 text-primary", ready_for_pickup: "bg-accent/15 text-accent", processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blocked: "bg-destructive/10 text-destructive", cancelled: "bg-destructive/10 text-destructive",
};
const RECEIPT_TYPE = { transfer: "transfer", payment: "payment", remittance: "remittance", deposit: "deposit", convert_out: "convert", convert_in: "convert" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card border border-border px-4 pt-3 pb-1 mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</h2>
      {children}
    </section>
  );
}

export default function TransactionDetailPage() {
  const { t } = useTranslation("common");
  const { lng, reference } = useParams<{ lng: string; reference: string }>();
  const base = `/${lng}`;
  const currentUser = useCurrentAppUser();
  const access = useFeatureAccess();
  const list = useRecentTransfersForUser(currentUser?.id, 200);
  const detailQuery = useTransactionDetail(reference);
  const navigate = useNavigate();
  const [showReceipt, setShowReceipt] = useState<false | "view" | "pdf">(false);

  // The list is already cached, so the basics show instantly; the full detail (fee, FX, payout) fills in when it arrives.
  const fromList = list?.find((x) => x.reference === reference);
  const detail: TransactionDetail | null | undefined = detailQuery.data;
  const tr = detail?.transfer ?? (fromList ? { id: fromList.id, reference: fromList.reference, type: fromList.type, state: fromList.state, amount: fromList.amount, currency: fromList.currency, note: fromList.note, createdAt: fromList.createdAt, partnerTxId: fromList.partnerTxId } : null);
  const fee = detail?.fee ?? fromList?.fee ?? null;

  const humanise = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const typeLabel = (ty: AppTransfer["type"]) => ({
    transfer: t("filter.transfer"), payment: t("filter.payment"), remittance: t("filter.remittance"),
    deposit: t("transactions.deposit"), convert_out: t("transactions.convertOut"), convert_in: t("transactions.convertIn"),
  })[ty];
  const stateLabel = (s: string) => t(`txd.state.${s}`, { defaultValue: humanise(s) });
  const copy = (value: string) => { void navigator.clipboard?.writeText(value).then(() => toast.success(t("txd.copied")), () => toast.error(t("txd.copyFailed"))); };

  if (!tr) {
    const loading = list === undefined || detailQuery.isLoading;
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Link to={`${base}/transactions`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"><ArrowLeft size={14} />{t("txd.back")}</Link>
        <div className="text-center py-16 text-sm text-muted-foreground">{loading ? t("txd.loading") : (<><div className="font-semibold text-foreground mb-1">{t("txd.notFound")}</div><div>{t("txd.notFoundHint")}</div></>)}</div>
      </div>
    );
  }

  const isCredit = CREDIT_TX_TYPES.has(tr.type);
  const Icon = isCredit ? ArrowDownLeft : TYPE_ICONS[tr.type] ?? Send;
  const rem = detail?.remittance ?? null;
  const pay = detail?.payout ?? null;
  const restricted = t("txd.restricted");

  // Actions that lead to the related feature. A restricted profile sees the button disabled with the reason, never a dead click.
  type Action = { key: string; label: string; icon: typeof Send; to?: string; onClick?: () => void; feature?: string; primary?: boolean; unavailable?: string };
  const actions: Action[] = [];
  // The receipt (PDF first, print second) is proof of a finished transaction, so it is offered once the transaction is completed.
  const receiptStatus: "completed" | "pending" | "failed" = ["paid", "resolved"].includes(tr.state) ? "completed"
    : ["failed", "reversed", "cancelled", "expired"].includes(tr.state) ? "failed" : "pending";
  actions.push({ key: "pdf", label: t("receipt.download"), icon: FileDown, onClick: () => setShowReceipt("pdf"), primary: true, unavailable: receiptStatus === "completed" ? undefined : t("receipt.notCompleted") });
  actions.push({ key: "receipt", label: t("txd.action.receipt"), icon: Receipt, onClick: () => setShowReceipt("view") });
  if (pay) {
    actions.push({ key: "track", label: t("txd.action.trackPayout"), icon: Banknote, to: `${base}/p2p?mode=new`, feature: "p2p" });
    if (pay.receiverId) actions.push({ key: "again", label: t("txd.action.sendAgain", { name: pay.receiverName }), icon: Send, to: `${base}/p2p?mode=new&receiver=${pay.receiverId}`, feature: "p2p" });
  } else if (tr.type === "remittance") actions.push({ key: "remit", label: t("txd.action.newRemittance"), icon: Globe, to: `${base}/remittance` });
  else if (tr.type === "transfer") actions.push({ key: "send", label: t("txd.action.sendAgainMember"), icon: Send, to: `${base}/p2p`, feature: "p2p" });
  else if (tr.type === "payment") actions.push({ key: "pay", label: t("txd.action.newPayment"), icon: CreditCard, to: `${base}/payments` });
  actions.push({ key: "wallet", label: t("txd.action.wallet"), icon: Wallet, to: `${base}/wallet` });
  actions.push({ key: "report", label: t("txd.action.report"), icon: Flag, to: `${base}/disputes?ref=${encodeURIComponent(tr.reference)}` });

  const related = actions.find((a) => a.to && !["wallet", "report", "track"].includes(a.key) && access.can(a.feature)) ?? actions.find((a) => a.key === "wallet");
  const actionCls = (primary?: boolean, disabled?: boolean) => cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors",
    primary ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-card border border-border text-foreground hover:border-primary/40",
    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
  );

  const mapsHref = pay?.agentAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pay.agentName ?? ""} ${pay.agentAddress}`)}` : null;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title={t("txd.title")} subtitle={typeLabel(tr.type)} className="mb-4" />

      <div className="rounded-2xl bg-card border border-border p-5 mb-4 flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", isCredit ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}><Icon size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className={cn("text-2xl font-bold font-mono", isCredit ? "text-primary" : "text-foreground")}>{isCredit ? "+" : "-"}{tr.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-semibold text-muted-foreground">{tr.currency}</span></div>
          <div className="text-xs text-muted-foreground">{new Date(tr.createdAt).toLocaleString()}</div>
        </div>
        <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold", STATE_TONE[tr.state] ?? "bg-secondary text-muted-foreground")}>{stateLabel(tr.state)}</span>
      </div>

      <Section title={t("txd.title")}>
        <Row label={t("txd.reference")}>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">{tr.reference}
            <button type="button" onClick={() => copy(tr.reference)} aria-label={t("txd.copy")} title={t("txd.copy")} className="text-muted-foreground hover:text-primary cursor-pointer"><Copy size={13} /></button></span>
        </Row>
        <Row label={t("txd.type")}>{typeLabel(tr.type)}</Row>
        <Row label={t("txd.date")}>{new Date(tr.createdAt).toLocaleString()}</Row>
        {detail?.wallet && <Row label={t("txd.wallet")}><Link to={`${base}/wallet`} className="text-primary hover:underline">{detail.wallet.provider} · {detail.wallet.currency}</Link></Row>}
        {tr.note && <Row label={t("txd.note")}>{localizeTransferNote(tr.note, t)}</Row>}
        {fee != null && <Row label={t("txd.fee")}>{fee.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tr.currency}</Row>}
        {tr.partnerTxId && <Row label={t("txd.partnerRef")}><span className="font-mono text-xs">{tr.partnerTxId}</span></Row>}
      </Section>

      {rem && (
        <Section title={t("txd.section.remittance")}>
          <Row label={t("txd.route")}>{rem.fromCurrency} → {rem.toCurrency}</Row>
          <Row label={t("txd.youSent")}>{rem.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {rem.fromCurrency}</Row>
          <Row label={t("txd.fee")}>{rem.fee.toLocaleString(undefined, { maximumFractionDigits: 2 })} {rem.fromCurrency}</Row>
          {rem.fxCost > 0 && <Row label={t("txd.fxCost")}>{rem.fxCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} {rem.fromCurrency}</Row>}
          <Row label={t("txd.receiverGets")}>{rem.receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {rem.toCurrency}</Row>
        </Section>
      )}

      {pay && (
        <Section title={t("txd.section.payout")}>
          <Row label={t("txd.receiver")}>{pay.receiverName}</Row>
          {pay.country && <Row label={t("txd.country")}>{t(`p2p.country.${pay.country}`, { defaultValue: pay.country })}</Row>}
          <Row label={t("txd.method")}>{t(`p2p.new.method.${pay.deliveryMethod}`)}{pay.provider ? ` · ${pay.provider}` : ""}</Row>
          {pay.accountMasked && <Row label={t("txd.account")}><span className="font-mono text-xs">{pay.accountMasked}</span></Row>}
          <Row label={t("txd.payoutStatus")}><span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", PAYOUT_TONE[pay.status] ?? "bg-secondary text-muted-foreground")}>{t(`txd.payout.${pay.status}`, { defaultValue: humanise(pay.status) })}</span></Row>
          {pay.pickupCode && pay.status !== "paid_out" && (
            <Row label={t("txd.pickupCode")}>
              <span className="inline-flex items-center gap-1.5 font-mono text-base tracking-widest">{pay.pickupCode}
                <button type="button" onClick={() => copy(pay.pickupCode!)} aria-label={t("txd.copy")} title={t("txd.copy")} className="text-muted-foreground hover:text-primary cursor-pointer"><Copy size={13} /></button></span>
            </Row>
          )}
          {pay.agentName && (
            <Row label={t("txd.pickupPoint")}>
              <span className="block">{pay.agentName}</span>
              {pay.agentAddress && <span className="block text-xs text-muted-foreground">{pay.agentAddress}</span>}
              {mapsHref && <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"><MapPin size={12} />{t("txd.openMap")}</a>}
            </Row>
          )}
          {pay.pickupAmount != null && pay.pickupCurrency && pay.pickupCurrency !== pay.toCurrency && (
            <Row label={t("txd.paidOutAs")}>{pay.pickupAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pay.pickupCurrency}</Row>
          )}
        </Section>
      )}

      {detailQuery.isSuccess && detail === null && (tr.type === "remittance") && (
        <p className="text-xs text-muted-foreground mb-4">{t("txd.extendedUnavailable")}</p>
      )}

      <div className="grid grid-cols-2 gap-2 mb-6">
        {actions.map((a) => {
          const allowed = access.can(a.feature);
          const disabled = !allowed || !!a.unavailable;
          const Ic = a.icon;
          const content = (<><Ic size={15} />{a.label}</>);
          if (disabled) return <button key={a.key} type="button" disabled title={a.unavailable ?? (access.loading ? t("txd.loading") : restricted)} aria-label={`${a.label} — ${a.unavailable ?? restricted}`} className={actionCls(a.primary, true)}>{content}</button>;
          if (a.to) return <Link key={a.key} to={a.to} className={actionCls(a.primary)}>{content}</Link>;
          return <button key={a.key} type="button" onClick={a.onClick} className={actionCls(a.primary)}>{content}</button>;
        })}
      </div>
      {actions.some((a) => a.feature && !access.can(a.feature)) && !access.loading && <p className="text-[11px] text-muted-foreground -mt-4 mb-6">{restricted}</p>}
      {receiptStatus !== "completed" && <p className="text-[11px] text-muted-foreground -mt-4 mb-6">{t("receipt.notCompleted")}</p>}

      {showReceipt && (
        <TransactionReceipt
          type={RECEIPT_TYPE[tr.type]}
          reference={tr.reference}
          amount={tr.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          currency={tr.currency}
          convertedAmount={rem ? rem.receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : undefined}
          convertedCurrency={rem?.toCurrency}
          recipient={pay?.receiverName}
          method={pay ? t(`p2p.new.method.${pay.deliveryMethod}`) : typeLabel(tr.type)}
          status={receiptStatus}
          autoDownload={showReceipt === "pdf"}
          extraRows={[
            ...(rem ? [[t("txd.route"), `${rem.fromCurrency} → ${rem.toCurrency}`] as [string, string]] : []),
            ...(pay ? [[t("txd.country"), pay.country ? t(`p2p.country.${pay.country}`, { defaultValue: pay.country }) : "—"] as [string, string]] : []),
          ]}
          newTransactionLabel={related?.label}
          onNewTransaction={() => { setShowReceipt(false); if (related?.to) navigate(related.to); }}
          fee={fee != null ? `${tr.currency} ${fee.toFixed(2)}` : undefined}
          date={new Date(tr.createdAt).toLocaleString()}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
}
