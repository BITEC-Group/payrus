import { useEffect, useState } from "react";
import { localizeTransferNote } from "@/lib/db-notifications.ts";
import { transactionErrorMessage } from "@/lib/transaction-errors.ts";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeftRight, Globe, TrendingUp, ArrowLeft, ChevronDown, Smartphone, Landmark, Banknote, Wallet, Zap, Star, Trash2, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import TransactionReceipt from "@/components/ui/transaction-receipt.tsx";
import { commissionFor, midMarketConvert, FX_MARGIN_RATE } from "@/convex/fx.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import {
  useSavedRecipients, useSaveRecipientMutation, useTouchSavedRecipientMutation,
  useDeleteSavedRecipientMutation, useRecentTransfersForUser, useCurrentFxMarginConfig, useRemittanceQuote, useOpenCorridors, useSendRemittanceMutation,
  useRemittancePayFrom, useWalletViewsForUser,
} from "@/hooks/use-backend.ts";
import type { DeliveryMethod } from "@/lib/backend.ts";
import AddWalletDialog from "@/components/wallet/add-wallet-dialog.tsx";
import { requireStepUp } from "@/lib/mfa.ts";

// Launch-phase priority corridors lead the list: XAF (CEMAC — Cameroon, Congo-Brazzaville,
// CAR/Bangui, Gabon, Chad, Eq. Guinea) and AOA (Angola). AED and CNY are visible for
// completeness but are not launch-priority corridors. Rates themselves come from
// convex/fx.ts (the same source of truth applyTransaction uses server-side) —
// this list only supplies display metadata (name/flag) per currency.
const currencies = [
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "XAF", name: "Franc CFA (CEMAC)", flag: "🌍" },
  { code: "AOA", name: "Angolan Kwanza", flag: "🇦🇴" },
  { code: "USD", name: "US Dollar", flag: "🇺🇸" },
  { code: "CDF", name: "Franc Congolais", flag: "🇨🇩" },
  { code: "XOF", name: "Franc CFA (UEMOA)", flag: "🌍" },
  { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪" },
  { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬" },
  { code: "ZAR", name: "South African Rand", flag: "🇿🇦" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧" },
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳" },
];

const corridorPairs: [string, string, string][] = [
  ["🇪🇺 EUR", "EUR", "XAF"], ["🇺🇸 USD", "USD", "XAF"],
  ["🇪🇺 EUR", "EUR", "AOA"], ["🇺🇸 USD", "USD", "AOA"],
  ["🇺🇸 USD", "USD", "CDF"], ["🇪🇺 EUR", "EUR", "CDF"],
  ["🇺🇸 USD", "USD", "NGN"], ["🇺🇸 USD", "USD", "KES"],
  ["🇺🇸 USD", "USD", "AED"], ["🇺🇸 USD", "USD", "CNY"],
];
const flagFor = (code: string) => currencies.find(c => c.code === code)?.flag ?? "🏳️";
const corridors = corridorPairs.map(([fromLabel, from, to]) => ({
  fromCode: from,
  toCode: to,
  from: fromLabel,
  to: `${flagFor(to)} ${to}`,
  rate: midMarketConvert(1, from, to).toLocaleString(undefined, { maximumFractionDigits: 2 }),
}));

type Step = "form" | "confirm" | "success";

// Delivery options, the way Taptap Send / Remitly / Ria / MoneyGram present them:
// pick how the money reaches the recipient, see the expected delivery time up front.
const DELIVERY: { id: DeliveryMethod; icon: typeof Smartphone; eta: string; providers: string[] }[] = [
  { id: "mobile_money", icon: Smartphone, eta: "remittance.eta.minutes", providers: ["M-Pesa", "Orange Money", "MTN MoMo", "Airtel Money"] },
  { id: "bank", icon: Landmark, eta: "remittance.eta.hours", providers: [] },
  { id: "cash_pickup", icon: Banknote, eta: "remittance.eta.minutes", providers: [] },
  { id: "wallet", icon: Wallet, eta: "remittance.eta.instant", providers: [] },
];
const maskAccount = (a: string) => (a.length > 4 ? `••••${a.slice(-4)}` : a);
// World Bank Remittance Prices Worldwide, Q3 2025: global mean cost of sending USD 200 (all corridors/instruments).
const WORLD_BANK_MEAN_COST = 0.0636;
const STATE_STEPS = ["quoted", "pending", "paid"] as const;

export default function Remittance() {
  const { t } = useTranslation("common");
  const [step, setStep] = useState<Step>("form");
  const [fromCurrency, setFromCurrency] = useState("EUR");
  const [toCurrency, setToCurrency] = useState("XAF");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  // The reason the last send failed, kept on screen (a toast alone disappears before it can be read).
  const [sendError, setSendError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();

  const [method, setMethod] = useState<DeliveryMethod>("mobile_money");
  const [provider, setProvider] = useState("");
  const [saveIt, setSaveIt] = useState(true);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const currentUser = useCurrentAppUser();
  const { data: savedRecipients } = useSavedRecipients(currentUser?.id);
  const saveRecipient = useSaveRecipientMutation();
  const touchRecipient = useTouchSavedRecipientMutation();
  const deleteRecipient = useDeleteSavedRecipientMutation();
  const recent = useRecentTransfersForUser(currentUser?.id, 30);
  const myRemittances = (recent ?? []).filter(x => x.type === "remittance").slice(0, 5);
  const sendRemittance = useSendRemittanceMutation();
  const [sending, setSending] = useState(false);

  const fromCurr = currencies.find(c => c.code === fromCurrency)!;
  const toCurr = currencies.find(c => c.code === toCurrency)!;
  const numAmt = parseFloat(amount) || 0;
  // Customer-facing figures include PayRus's live FX margin (set in the ops console), so
  // "they receive" is what the backend quote actually delivers, not the mid-market rate.
  const marginCfg = useCurrentFxMarginConfig();
  // When signed in, the corridor quote from the backend (per-corridor margin + guardrails, migration 0033) wins;
  // otherwise, or if it is not available, fall back to the global margin computed locally.
  const { data: quote } = useRemittanceQuote(fromCurrency, toCurrency, numAmt, !!currentUser);
  const marginRate = quote ? quote.appliedMargin : fromCurrency === toCurrency ? 0 : (marginCfg?.marginRate ?? FX_MARGIN_RATE);
  const convertedAmount = quote ? quote.receiveAmount.toFixed(2)
    : amount ? (midMarketConvert(numAmt, fromCurrency, toCurrency) * (1 - marginRate)).toFixed(2) : "0.00";
  const fxRate = numAmt > 0 && quote ? (quote.receiveAmount / numAmt).toFixed(4) : (midMarketConvert(1, fromCurrency, toCurrency) * (1 - marginRate)).toFixed(4);
  const blockedReason = quote && !quote.ok ? quote.blockedReason : null;
  const fee = quote ? quote.fee : commissionFor(numAmt);
  const totalToPay = numAmt + fee;
  // All-in cost as a share of the amount sent: fee + FX margin (the measure the World Bank and Wise/Remitly comparisons use).
  const totalCostPct = numAmt > 0 ? (fee + numAmt * marginRate) / numAmt : 0;
  const delivery = DELIVERY.find(d => d.id === method)!;
  // Which wallet will be debited (migration 0066): the wallet in the send currency, else one that can cover it. Shown before the
  // customer confirms, so a short balance or a missing wallet is explained up front instead of failing at the last step.
  const wallets = useWalletViewsForUser(currentUser?.id);
  const { data: payFrom } = useRemittancePayFrom(currentUser?.id, fromCurrency, toCurrency, blockedReason ? 0 : numAmt);
  const noWalletAtAll = !!currentUser && wallets !== undefined && wallets.length === 0;
  const shortOfFunds = !!payFrom && !payFrom.sufficient;
  const canReview = !blockedReason && numAmt > 0 && recipient.trim().length >= 2 && recipientAccount.trim().length >= 3 && !shortOfFunds && !noWalletAtAll;

  const pickRecipient = (r: NonNullable<typeof savedRecipients>[number]) => {
    setPickedId(r.id); setRecipient(r.fullName); setRecipientAccount(r.account);
    setMethod(r.deliveryMethod); setProvider(r.provider ?? "");
    if (r.currency && r.currency !== fromCurrency) setToCurrency(r.currency);
  };
  const clearPick = () => { setPickedId(null); setRecipient(""); setRecipientAccount(""); setProvider(""); };

  // Only offer routes that are open (migration 0037). While the list is loading, or if it is unavailable
  // (e.g. the migration is not applied yet), fall back to offering every currency as before.
  const openCorridors = useOpenCorridors();
  const isOpen = (from: string, to: string) => !openCorridors || openCorridors.some(o => o.from === from && o.to === to);
  const fromOptions = currencies.filter(c => !openCorridors || openCorridors.some(o => o.from === c.code));
  const toOptions = currencies.filter(c => c.code !== fromCurrency && isOpen(fromCurrency, c.code));
  useEffect(() => {
    if (!openCorridors || openCorridors.length === 0 || isOpen(fromCurrency, toCurrency)) return;
    const next = openCorridors.find(o => o.from === fromCurrency) ?? openCorridors[0];
    setFromCurrency(next.from); setToCurrency(next.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCorridors, fromCurrency, toCurrency]);
  const canSwap = isOpen(toCurrency, fromCurrency);
  const swap = () => { if (canSwap) { setFromCurrency(toCurrency); setToCurrency(fromCurrency); } };
  const handleSend = () => { if (!canReview) { toast.error(t("remittance.fillRequired")); return; } setStep("confirm"); };
  const [txReference, setTxReference] = useState(() => `REF-${Date.now().toString().slice(-10)}`);

  const handleConfirm = async () => {
    if (!currentUser) {
      // Anonymous preview — no real wallet to debit, keep the existing demo flow.
      setStep("success");
      toast.success(t("common.success"));
      return;
    }
    if (!(await requireStepUp())) { toast.error(t("mfa.codeInvalid")); return; }
    setSending(true);
    setSendError(null);
    try {
      const via = [t(`remittance.method.${method}`), provider].filter(Boolean).join(" · ");
      const note = `${recipient} · ${via} · ${maskAccount(recipientAccount)} · ${fromCurrency}→${toCurrency}`;
      const result = await sendRemittance({ userId: currentUser.id, amount: numAmt, from: fromCurrency, to: toCurrency, note });
      setTxReference(result.reference);
      // Recipient book upkeep is best-effort: a failure here must never mask a completed transfer.
      try {
        if (pickedId) await touchRecipient(pickedId);
        else if (saveIt) {
          const id = await saveRecipient({ fullName: recipient.trim(), deliveryMethod: method, account: recipientAccount.trim(), currency: toCurrency, provider: provider || undefined });
          await touchRecipient(id);
        }
      } catch { /* ignore */ }
      setStep("success");
      toast.success(t("common.success"));
    } catch (e) {
      const message = transactionErrorMessage(e, t, "common.error");
      setSendError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const reset = () => { setStep("form"); setAmount(""); setRecipient(""); setRecipientAccount(""); setPickedId(null); setProvider(""); };

  const confirmRows = [
    { label: t("remittance.youSend"), value: `${amount} ${fromCurrency}` },
    { label: t("remittance.theyReceive"), value: `${parseFloat(convertedAmount).toLocaleString()} ${toCurrency}` },
    { label: t("remittance.rate"), value: `1 ${fromCurrency} = ${fxRate} ${toCurrency}` },
    { label: t("remittance.fee"), value: `${fromCurrency} ${fee.toFixed(2)}` },
    { label: t("remittance.totalToPay"), value: `${totalToPay.toFixed(2)} ${fromCurrency}` },
    { label: t("remittance.recipient"), value: recipient || "—" },
    { label: t("remittance.deliveryMethod"), value: [t(`remittance.method.${method}`), provider, maskAccount(recipientAccount)].filter(Boolean).join(" · ") },
    { label: t("remittance.delivery"), value: t(delivery.eta) },
  ];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        {step !== "form" && (
          <button onClick={() => setStep("form")} className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-primary/10 transition-colors">
            <ArrowLeft size={16} className="text-muted-foreground" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("remittance.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("remittance.subtitle")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={14} className="text-accent" />
          <span className="text-xs font-medium text-muted-foreground">{t("remittance.liveRates")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {corridors.filter(c => isOpen(c.fromCode, c.toCode)).map(c => (
            <div key={c.from + c.to} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{c.from} → {c.to}</span>
              <span className="font-mono font-semibold text-foreground">{c.rate}</span>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "form" && (
          <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <h2 className="font-semibold text-foreground">{t("remittance.converterTitle")}</h2>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t("remittance.youSend")}</label>
                <div className="flex gap-2">
                  <button onClick={() => setShowFromPicker(!showFromPicker)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary border border-border hover:border-primary/50 transition-colors cursor-pointer">
                    <span className="text-lg">{fromCurr.flag}</span>
                    <span className="text-sm font-semibold text-foreground">{fromCurrency}</span>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </button>
                  <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0.00" className="flex-1 bg-secondary border-border font-mono font-bold" />
                </div>
                {showFromPicker && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-popover p-2 grid grid-cols-2 gap-1 shadow-xl z-10">
                    {fromOptions.filter(c => c.code !== toCurrency || isOpen(c.code, toCurrency)).map(c => (
                      <button key={c.code} onClick={() => { setFromCurrency(c.code); setShowFromPicker(false); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary text-sm text-left cursor-pointer">
                        <span>{c.flag}</span><span className="font-medium">{c.code}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
              <div className="flex items-center justify-center">
                <button onClick={swap} disabled={!canSwap} className="w-9 h-9 disabled:opacity-40 disabled:cursor-not-allowed rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer">
                  <ArrowLeftRight size={15} className="text-primary" />
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t("remittance.theyReceive")}</label>
                <div className="flex gap-2">
                  <button onClick={() => setShowToPicker(!showToPicker)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary border border-border hover:border-primary/50 transition-colors cursor-pointer">
                    <span className="text-lg">{toCurr.flag}</span>
                    <span className="text-sm font-semibold text-foreground">{toCurrency}</span>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </button>
                  <div className="flex-1 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20 font-mono font-bold text-primary">
                    {parseFloat(convertedAmount).toLocaleString()}
                  </div>
                </div>
                {showToPicker && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-popover p-2 grid grid-cols-2 gap-1 shadow-xl z-10">
                    {toOptions.map(c => (
                      <button key={c.code} onClick={() => { setToCurrency(c.code); setShowToPicker(false); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary text-sm text-left cursor-pointer">
                        <span>{c.flag}</span><span className="font-medium">{c.code}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp size={12} className="text-primary" />
                  {t("remittance.exchangeRate")}
                </div>
                <span className="font-mono font-semibold text-foreground">1 {fromCurrency} = {fxRate} {toCurrency}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <h2 className="font-semibold text-foreground">{t("remittance.recipientTitle")}</h2>
              {currentUser && savedRecipients && savedRecipients.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Star size={11} /> {t("remittance.savedRecipients")}</label>
                  <div className="flex flex-wrap gap-2">
                    {savedRecipients.map(r => (
                      <span key={r.id} className={cn("inline-flex items-center rounded-full border text-xs", pickedId === r.id ? "border-primary bg-primary/10" : "border-border bg-secondary")}>
                        <button type="button" onClick={() => (pickedId === r.id ? clearPick() : pickRecipient(r))} className="px-3 py-1.5 cursor-pointer font-medium">
                          {r.fullName}<span className="text-muted-foreground"> · {t(`remittance.method.${r.deliveryMethod}`)}</span>
                        </button>
                        <button type="button" aria-label={t("remittance.removeRecipient")} onClick={() => { if (pickedId === r.id) clearPick(); void deleteRecipient(r.id).catch(() => toast.error(t("common.error"))); }} className="pr-2 text-muted-foreground hover:text-destructive cursor-pointer">
                          <Trash2 size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t("remittance.deliveryMethod")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {DELIVERY.map(d => (
                    <button key={d.id} type="button" onClick={() => { setMethod(d.id); setProvider(""); }}
                      className={cn("flex items-center gap-2 rounded-xl border p-2.5 text-left cursor-pointer transition-colors", method === d.id ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-primary/50")}>
                      <d.icon size={16} className="text-primary shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground leading-tight">{t(`remittance.method.${d.id}`)}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Zap size={10} />{t(d.eta)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {delivery.providers.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("remittance.provider")}</label>
                  <div className="flex flex-wrap gap-2">
                    {delivery.providers.map(p => (
                      <button key={p} type="button" onClick={() => setProvider(provider === p ? "" : p)}
                        className={cn("px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer", provider === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary")}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t("remittance.fullName")}</label>
                <Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={t("remittance.fullNamePlaceholder")} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t("remittance.accountPhone")}</label>
                <Input value={recipientAccount} onChange={e => setRecipientAccount(e.target.value)} placeholder={t("remittance.accountPhonePlaceholder")} className="bg-secondary border-border" />
              </div>
            </div>
            {currentUser && !pickedId && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={saveIt} onChange={e => setSaveIt(e.target.checked)} className="accent-primary" />
                {t("remittance.saveRecipient")}
              </label>
            )}
            {blockedReason && (
              <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{t(`remittance.blocked.${blockedReason}`)}</div>
            )}
            {numAmt > 0 && (
              <div className="rounded-2xl bg-card border border-border p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("remittance.youSend")}</span><span className="font-mono">{numAmt.toFixed(2)} {fromCurrency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("remittance.fee")}</span><span className="font-mono">{fee.toFixed(2)} {fromCurrency}</span></div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>{t("remittance.totalToPay")}</span><span className="font-mono">{totalToPay.toFixed(2)} {fromCurrency}</span></div>
                <div className="flex justify-between text-primary font-semibold"><span>{t("remittance.theyReceive")}</span><span className="font-mono">{parseFloat(convertedAmount).toLocaleString()} {toCurrency}</span></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>{t("remittance.fxMargin")} ({(marginRate * 100).toFixed(1)}%)</span><span className="font-mono">{(numAmt * marginRate).toFixed(2)} {fromCurrency}</span></div>
                <div className={cn("flex justify-between text-xs font-semibold", totalCostPct <= WORLD_BANK_MEAN_COST ? "text-primary" : "text-destructive")}>
                  <span>{t("remittance.totalCost")}</span><span>{(totalCostPct * 100).toFixed(2)}% · {t("remittance.worldBankMean", { pct: (WORLD_BANK_MEAN_COST * 100).toFixed(2) })}</span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock size={11} />{t("remittance.arrives")}: {t(delivery.eta)}</p>
              </div>
            )}
            {currentUser && numAmt > 0 && !blockedReason && (noWalletAtAll || payFrom) && (
              <div className={cn("rounded-xl border p-3 text-xs space-y-2", shortOfFunds || noWalletAtAll ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-secondary/40 text-muted-foreground")} data-testid="pay-from" role={shortOfFunds || noWalletAtAll ? "alert" : undefined}>
                {noWalletAtAll && <p>{t("remittance.payFrom.none")}</p>}
                {payFrom && payFrom.sameCurrency && !shortOfFunds && <p>{t("remittance.payFrom.same", { currency: payFrom.walletCurrency, balance: payFrom.balance.toLocaleString() })}</p>}
                {payFrom && !payFrom.sameCurrency && !shortOfFunds && <p>{t("remittance.payFrom.convert", { from: fromCurrency, debit: payFrom.debit.toLocaleString(), currency: payFrom.walletCurrency, balance: payFrom.balance.toLocaleString() })}</p>}
                {shortOfFunds && payFrom && <p>{t("remittance.payFrom.short", { need: payFrom.debit.toLocaleString(), currency: payFrom.walletCurrency, have: payFrom.balance.toLocaleString() })}</p>}
                {(noWalletAtAll || shortOfFunds || (payFrom && !payFrom.sameCurrency)) && (
                  <div className="flex gap-3">
                    {(noWalletAtAll || (payFrom && !payFrom.sameCurrency)) && (
                      <button type="button" onClick={() => setShowAddWallet(true)} className="font-semibold underline cursor-pointer">{t("remittance.payFrom.openWallet", { currency: fromCurrency })}</button>
                    )}
                    <button type="button" onClick={() => navigate(`/${lng ?? "en"}/wallet`)} className="font-semibold underline cursor-pointer">{t("remittance.payFrom.topUp")}</button>
                  </div>
                )}
              </div>
            )}
            <Button onClick={handleSend} disabled={!canReview} className="w-full h-12 text-base font-semibold rounded-xl">{t("remittance.reviewTransfer")}</Button>
            {showAddWallet && <AddWalletDialog userId={currentUser?.id} held={(wallets ?? []).map((w) => w.currency)} suggested={fromCurrency} onClose={() => setShowAddWallet(false)} />}
            {myRemittances.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                <h2 className="font-semibold text-foreground">{t("remittance.trackTitle")}</h2>
                {myRemittances.map(x => {
                  const idx = Math.max(0, STATE_STEPS.indexOf(x.state as (typeof STATE_STEPS)[number]));
                  const failed = x.state === "failed";
                  return (
                    <div key={x.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-mono text-muted-foreground">{x.reference}</span>
                        <span className="font-semibold">{x.amount.toLocaleString()} {x.currency}</span>
                      </div>
                      {x.note && <p className="text-xs text-muted-foreground truncate">{localizeTransferNote(x.note, t)}</p>}
                      <div className="flex items-center gap-1">
                        {STATE_STEPS.map((st, i) => (
                          <div key={st} className="flex-1 flex items-center gap-1">
                            <CheckCircle2 size={12} className={failed ? "text-destructive" : i <= idx ? "text-primary" : "text-muted-foreground/40"} />
                            <span className={cn("text-[10px]", i <= idx && !failed ? "text-foreground" : "text-muted-foreground")}>{t(`remittance.state.${st}`)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
              <h2 className="font-semibold text-foreground text-lg">{t("remittance.reviewTitle")}</h2>
              <div className="space-y-3 divide-y divide-border">
                {confirmRows.map(row => (
                  <div key={row.label} className="flex justify-between pt-3 first:pt-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={cn("text-sm font-semibold", row.label === t("remittance.theyReceive") ? "text-primary" : "text-foreground")}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {sendError && <div role="alert" data-testid="send-error" className="w-full rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{sendError}</div>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={reset} className="flex-1 h-12 rounded-xl">{t("common.cancel")}</Button>
              <Button onClick={() => void handleConfirm()} disabled={sending} className="flex-1 h-12 text-base font-semibold rounded-xl">{sending ? t("signin.checking") : t("remittance.confirmSend")}</Button>
            </div>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <TransactionReceipt
              type="remittance"
              amount={amount}
              currency={fromCurrency}
              convertedAmount={parseFloat(convertedAmount).toLocaleString()}
              convertedCurrency={toCurrency}
              recipient={recipient || undefined}
              method={`${fromCurrency} → ${toCurrency}`}
              fee={`${fromCurrency} ${fee.toFixed(2)}`}
              reference={txReference}
              date={new Date().toLocaleString()}
              onClose={reset}
              onNewTransaction={reset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
