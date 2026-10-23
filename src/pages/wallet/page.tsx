import { useState } from "react";
import { localizeTransferNote } from "@/lib/db-notifications.ts";
import { walletProviderLabel } from "@/lib/i18n-labels.ts";
import { transactionErrorMessage } from "@/lib/transaction-errors.ts";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet, Building2, Users, Bitcoin, CreditCard, Smartphone, Nfc,
  ChevronRight, ChevronDown, ArrowLeft, CheckCircle, Copy, AlertCircle, Shield, Repeat, Plus
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/ui/page-header.tsx";
import TransactionReceipt from "@/components/ui/transaction-receipt.tsx";
import AddWalletDialog from "@/components/wallet/add-wallet-dialog.tsx";
import { RATES_PER_USD, convertWithMargin, depositFeeFor } from "@/convex/fx.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useDepositMutation, useConvertBetweenWalletsMutation, useRecentTransfersForUser, useWalletViewsForUser } from "@/hooks/use-backend.ts";

type TopUpMethod = "bank" | "agent" | "crypto" | "card" | "mobile" | "apple_pay" | "google_pay";
type Step = "balance" | "method" | "details" | "confirm" | "success";
type ConvertStep = "form" | "confirm" | "success";
type Mode = "topup" | "convert";

const ALL_CURRENCIES = Object.keys(RATES_PER_USD);
const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", XAF: "🌍", XOF: "🌍", CDF: "🇨🇩", AOA: "🇦🇴", AED: "🇦🇪", CNY: "🇨🇳",
  NGN: "🇳🇬", GHS: "🇬🇭", RWF: "🇷🇼", ZAR: "🇿🇦", ETB: "🇪🇹", GBP: "🇬🇧", CAD: "🇨🇦", KES: "🇰🇪",
};

export default function WalletPage() {
  const { t } = useTranslation("common");
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("tab") === "convert" ? "convert" : "topup");

  const currentUser = useCurrentAppUser();
  const realWallets = useWalletViewsForUser(currentUser?.id);
  const recentTx = useRecentTransfersForUser(currentUser?.id, 10);
  const depositMutation = useDepositMutation();
  const convertMutation = useConvertBetweenWalletsMutation();

  const heldCurrencies = realWallets?.map(w => w.currency) ?? [];
  const defaultCurrency = currentUser?.transactionCurrency ?? heldCurrencies[0] ?? "XAF";

  /* ───────────────────── Top-up flow (existing) ───────────────────── */
  const [step, setStep] = useState<Step>("balance");
  const [method, setMethod] = useState<TopUpMethod | null>(null);
  const [mobileOp, setMobileOp] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(searchParams.get("currency") ?? defaultCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(searchParams.get("add") === "1");
  const [depositing, setDepositing] = useState(false);
  const [lastDeposit, setLastDeposit] = useState<{ credited: number; fee: number } | null>(null);
  const [txReference, setTxReference] = useState(() => `TOP-${Date.now().toString().slice(-10)}`);

  const selectedWallet = realWallets?.find(w => w.currency === currency);
  const walletBalance = selectedWallet?.balance ?? (currentUser ? 0 : 247500);
  const walletBalanceCurrency = currentUser ? currency : "XAF";

  const methods: { id: TopUpMethod; label: string; sub: string; icon: typeof Building2; color: string; fee: string; time: string }[] = [
    { id: "bank", label: t("wallet.methodBank"), sub: t("wallet.methodBankSub"), icon: Building2, color: "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30", fee: "0%", time: t("wallet.time24h") },
    { id: "agent", label: t("wallet.methodAgent"), sub: t("wallet.methodAgentSub"), icon: Users, color: "bg-primary/10 text-primary border-primary/30", fee: "1%", time: t("wallet.timeInstant") },
    { id: "crypto", label: t("wallet.methodCrypto"), sub: t("wallet.methodCryptoSub"), icon: Bitcoin, color: "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30", fee: "0.5%", time: t("wallet.time10min") },
    { id: "card", label: t("wallet.methodCard"), sub: t("wallet.methodCardSub"), icon: CreditCard, color: "bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30", fee: "2.5%", time: t("wallet.timeInstant") },
    { id: "mobile", label: t("wallet.methodMobile"), sub: t("wallet.methodMobileSub"), icon: Smartphone, color: "bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30", fee: "1.5%", time: t("wallet.timeInstant") },
    { id: "apple_pay", label: t("wallet.methodApplePay"), sub: t("wallet.methodApplePaySub"), icon: Nfc, color: "bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/30", fee: "1%", time: t("wallet.timeInstant") },
    { id: "google_pay", label: t("wallet.methodGooglePay"), sub: t("wallet.methodGooglePaySub"), icon: Wallet, color: "bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/30", fee: "1%", time: t("wallet.timeInstant") },
  ];
  const selectedMethod = methods.find(m => m.id === method);
  const feeRate = selectedMethod ? parseFloat(selectedMethod.fee) / 100 : 0;
  const estimatedFee = amount ? Math.round(parseFloat(amount || "0") * feeRate) : 0;

  const handleConfirm = async () => {
    if (!currentUser) {
      // Anonymous preview — no real wallet to credit, keep the existing demo flow.
      setStep("success");
      toast.success(t("common.success"));
      return;
    }
    setDepositing(true);
    try {
      const grossAmount = parseFloat(amount);
      const result = await depositMutation({ userId: currentUser.id, amount: grossAmount, currency, method: method ?? undefined });
      const fee = depositFeeFor(method ?? undefined, grossAmount);
      setLastDeposit({ credited: grossAmount - fee, fee });
      setTxReference(result.reference);
      setStep("success");
      toast.success(t("common.success"));
    } catch (e) {
      toast.error(transactionErrorMessage(e, t, "wallet.topUpFailed"));
    } finally {
      setDepositing(false);
    }
  };

  const goBack = () => {
    if (step === "confirm") setStep("details");
    else if (step === "details") setStep("method");
    else if (step === "method") setStep("balance");
    else setStep("balance");
  };

  const reset = () => {
    setStep("balance");
    setMethod(null);
    setAmount("");
    setLastDeposit(null);
    setTxReference(`TOP-${Date.now().toString().slice(-10)}`);
  };

  const bankDetails = {
    bankName: "BSIC Central African Rep.",
    accountName: "PayRus SAS",
    accountNumber: "CF 0900 1234 5678 9012 34",
    reference: txReference,
  };

  /* ───────────────────── Convert flow (new) ───────────────────── */
  const [convertStep, setConvertStep] = useState<ConvertStep>("form");
  const [fromCurrency, setFromCurrency] = useState(defaultCurrency);
  const [toCurrency, setToCurrency] = useState(() => ALL_CURRENCIES.find(c => c !== defaultCurrency) ?? "USD");
  const [convertAmount, setConvertAmount] = useState("");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertRef, setConvertRef] = useState(() => `CNV-${Date.now().toString().slice(-10)}`);
  const [lastConverted, setLastConverted] = useState<{ converted: number; fxMargin: number } | null>(null);

  const fromWallet = realWallets?.find(w => w.currency === fromCurrency);
  const convertNumAmt = parseFloat(convertAmount) || 0;
  const conversionPreview = convertNumAmt > 0 ? convertWithMargin(convertNumAmt, fromCurrency, toCurrency) : { converted: 0, fxMargin: 0 };
  const hasNoWallets = !!currentUser && realWallets !== undefined && realWallets.length === 0;

  const handleConvertReview = () => {
    if (!convertAmount || convertNumAmt <= 0) { toast.error(t("wallet.enterValidAmount")); return; }
    if (currentUser && fromWallet && convertNumAmt > fromWallet.balance) { toast.error(t("txerror.insufficient_balance", { need: convertNumAmt.toLocaleString(), have: fromWallet.balance.toLocaleString(), currency: fromWallet.currency })); return; }
    setConvertStep("confirm");
  };

  const handleConvertConfirm = async () => {
    if (!currentUser) {
      setConvertStep("success");
      toast.success(t("common.success"));
      return;
    }
    setConverting(true);
    try {
      const result = await convertMutation({ userId: currentUser.id, amount: convertNumAmt, fromCurrency, toCurrency });
      const preview = convertWithMargin(convertNumAmt, fromCurrency, toCurrency);
      setLastConverted({ converted: preview.converted, fxMargin: preview.fxMargin });
      setConvertRef(result.fromTransfer.reference);
      setConvertStep("success");
      toast.success(t("common.success"));
    } catch (e) {
      toast.error(transactionErrorMessage(e, t, "wallet.convertFailed"));
    } finally {
      setConverting(false);
    }
  };

  const resetConvert = () => {
    setConvertStep("form");
    setConvertAmount("");
    setLastConverted(null);
    setConvertRef(`CNV-${Date.now().toString().slice(-10)}`);
  };

  const recentDeposits = (recentTx ?? []).filter(tx => tx.type === "deposit").slice(0, 3);

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-6 max-w-2xl mx-auto">
      <PageHeader title={t("wallet.title")} className="mb-4 md:mb-6" />

      {/* Mode switch */}
      <div className="flex gap-2 mb-5 p-1 rounded-2xl bg-secondary border border-border">
        <button
          onClick={() => setMode("topup")}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors", mode === "topup" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
        >
          <Plus size={14} /> {t("wallet.topUp")}
        </button>
        <button
          onClick={() => setMode("convert")}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors", mode === "convert" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
        >
          <Repeat size={14} /> {t("wallet.convert", "Convert")}
        </button>
      </div>

      {mode === "topup" && (
        <>
          {/* Wallet balance card */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/20 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Wallet size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("wallet.balance")}</p>
                  <p className="text-2xl font-black font-mono text-foreground">{walletBalanceCurrency} {walletBalance.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                <Shield size={12} />
                {t("wallet.secured")}
              </div>
            </div>
            {currentUser && realWallets && realWallets.length > 0 && (
              <div className="relative mt-1">
                <button
                  onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-bold text-foreground hover:border-primary/50 transition-colors cursor-pointer"
                >
                  {CURRENCY_FLAGS[currency] ?? "💱"} {currency} <ChevronDown size={11} />
                </button>
                {showCurrencyPicker && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-xl shadow-xl overflow-hidden w-40 max-h-56 overflow-y-auto">
                    {realWallets.map(w => (
                      <button key={w.id} onClick={() => { setCurrency(w.currency); setShowCurrencyPicker(false); }} className={cn("w-full px-3 py-2 text-sm font-medium text-left hover:bg-secondary transition-colors cursor-pointer flex justify-between", w.currency === currency && "text-primary bg-primary/5")}>
                        <span>{w.flag} {w.currency}</span>
                        <span className="text-xs text-muted-foreground">{w.balance.toLocaleString()}</span>
                      </button>
                    ))}
                    <div className="border-t border-border">
                      {ALL_CURRENCIES.filter(c => !heldCurrencies.includes(c)).map(c => (
                        <button key={c} onClick={() => { setCurrency(c); setShowCurrencyPicker(false); }} className={cn("w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors cursor-pointer text-muted-foreground", c === currency && "text-primary bg-primary/5")}>
                          {CURRENCY_FLAGS[c] ?? "💱"} {c} <span className="text-[10px]">({t("wallet.newCurrency", "new")})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
              <span>{t("wallet.status")}: <span className="text-primary font-semibold">{t("wallet.active")}</span></span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "balance" && (
              <motion.div key="balance" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
                <Button onClick={() => setStep("method")} className="w-full h-12 text-base font-bold cursor-pointer">
                  <Wallet size={18} className="mr-2" />
                  {t("wallet.topUp")}
                </Button>

                {currentUser && (
                  <div className="rounded-2xl bg-card border border-border p-4" data-testid="my-wallets">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm text-foreground">{t("wallet.myWallets")}</h3>
                      <button type="button" onClick={() => setShowAddWallet(true)} data-testid="add-wallet-button"
                        className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
                        <Plus size={12} /> {t("wallet.add.button")}
                      </button>
                    </div>
                    {realWallets && realWallets.length > 0 ? (
                      <div className="space-y-2">
                        {realWallets.map((w) => (
                          <button key={w.id} type="button" onClick={() => setCurrency(w.currency)}
                            className={cn("w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left cursor-pointer transition-colors",
                              w.currency === currency ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                            <span className="text-sm font-medium">{w.flag} {walletProviderLabel(t, w.provider) ?? w.currency} <span className="text-xs text-muted-foreground">· {w.currency}</span></span>
                            <span className="text-sm font-bold font-mono">{w.balance.toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("wallet.noWalletsYet")}</p>
                    )}
                  </div>
                )}

                <div className="rounded-2xl bg-card border border-border p-4">
                  <h3 className="font-semibold text-sm text-foreground mb-3">{t("wallet.recentTopUps")}</h3>
                  {currentUser && recentDeposits.length > 0 ? (
                    <div className="space-y-2.5">
                      {recentDeposits.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-foreground">{tx.note ? localizeTransferNote(tx.note, t) : t("wallet.methodBank")}</p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold font-mono text-primary">+{tx.currency} {tx.amount.toLocaleString()}</p>
                            <p className="text-[10px] text-primary">{t("wallet.completed")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : currentUser ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">{t("wallet.noTopUpsYet", "No top-ups yet.")}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {[
                        { method: t("wallet.methodMobile"), amount: "+XAF 50,000", date: "08 Aug" },
                        { method: t("wallet.methodBank"), amount: "+XAF 150,000", date: "02 Aug" },
                        { method: t("wallet.methodAgent"), amount: "+XAF 25,000", date: "28 Jul" },
                      ].map((tx, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-foreground">{tx.method}</p>
                            <p className="text-xs text-muted-foreground">{tx.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold font-mono text-primary">{tx.amount}</p>
                            <p className="text-[10px] text-primary">{t("wallet.completed")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === "method" && (
              <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={goBack} className="w-11 h-11 md:w-9 md:h-9 rounded-lg bg-secondary border border-border flex items-center justify-center hover:bg-primary/5 transition-colors cursor-pointer">
                    <ArrowLeft size={16} className="text-muted-foreground" />
                  </button>
                  <div>
                    <h2 className="font-bold text-foreground">{t("wallet.chooseMethod")}</h2>
                    <p className="text-xs text-muted-foreground">{t("wallet.chooseMethodSub")}</p>
                  </div>
                </div>
                {methods.map((m) => (
                  <button key={m.id} onClick={() => { setMethod(m.id); setStep("details"); }} className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-all text-left cursor-pointer border-border">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", m.color)}>
                      <m.icon size={22} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{m.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.sub}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-foreground">{m.fee}</div>
                      <div className="text-[10px] text-muted-foreground">{m.time}</div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                ))}
              </motion.div>
            )}

            {step === "details" && (
              <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={goBack} className="w-11 h-11 md:w-9 md:h-9 rounded-lg bg-secondary border border-border flex items-center justify-center hover:bg-primary/5 transition-colors cursor-pointer">
                    <ArrowLeft size={16} className="text-muted-foreground" />
                  </button>
                  {selectedMethod && (
                    <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium", selectedMethod.color)}>
                      <selectedMethod.icon size={15} />
                      {selectedMethod.label}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                  <label className="text-sm font-medium text-foreground">{t("wallet.enterAmount")}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{currency}</span>
                    <Input
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      type="number"
                      placeholder="0"
                      className="pl-14 h-14 text-2xl font-mono font-bold bg-secondary border-border"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[5000, 10000, 25000, 50000, 100000].map(a => (
                      <button
                        key={a}
                        onClick={() => setAmount(String(a))}
                        className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-mono font-bold hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        {a.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  {selectedMethod && (
                    <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-secondary/60 mt-2">
                      <span className="text-muted-foreground">{t("wallet.fee")}</span>
                      <span className="font-mono font-semibold text-foreground">{selectedMethod.fee} — {currency} {estimatedFee.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {method === "bank" && (
                  <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <Building2 size={14} className="text-blue-500" />
                      {t("wallet.bankInstructions")}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(bankDetails).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <span className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-foreground">{val}</span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(val); toast.success(t("wallet.copied")); }}
                              className="text-muted-foreground hover:text-primary cursor-pointer"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
                      <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">{t("wallet.bankNote")}</p>
                    </div>
                  </div>
                )}

                {method === "agent" && (
                  <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <Users size={14} className="text-primary" />
                      {t("wallet.agentInstructions")}
                    </h3>
                    <p className="text-xs text-muted-foreground">{t("wallet.agentDesc")}</p>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-xs font-mono font-bold text-primary">{t("wallet.agentCode")}: {txReference}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(txReference); toast.success(t("wallet.copied")); }}
                        className="text-muted-foreground hover:text-primary cursor-pointer"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {method === "crypto" && (
                  <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <Bitcoin size={14} className="text-amber-500" />
                      {t("wallet.cryptoInstructions")}
                    </h3>
                    <div className="p-3 rounded-lg bg-secondary border border-border">
                      <p className="text-[10px] text-muted-foreground mb-1">{t("wallet.cryptoNetwork")}{t("wallet.tronTrc20")}</p>
                      <p className="text-xs font-mono font-medium text-foreground break-all">{t("wallet.tpayrus7xkj9cdf4wm")}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <AlertCircle size={12} className="text-amber-500" />
                      {t("wallet.cryptoNote")}
                    </div>
                  </div>
                )}

                {method === "card" && (
                  <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <CreditCard size={14} className="text-violet-500" />
                      {t("wallet.cardInstructions")}
                    </h3>
                    <p className="text-xs text-muted-foreground">{t("wallet.cardDesc")}</p>
                  </div>
                )}

                {method === "mobile" && (
                  <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <Smartphone size={14} className="text-orange-500" />
                      {t("wallet.mobileInstructions")}
                    </h3>
                    <p className="text-xs text-muted-foreground">{t("wallet.mobileDesc")}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {["Orange Money", "MTN MoMo", "Airtel Money"].map(op => (
                        <button key={op} type="button" onClick={() => setMobileOp(op)} aria-pressed={mobileOp === op} className={cn("p-2.5 rounded-xl border text-xs font-medium text-center transition-colors cursor-pointer", mobileOp === op ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border hover:border-primary/50")}>
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(method === "apple_pay" || method === "google_pay") && (
                  <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      {method === "apple_pay" ? <Nfc size={14} className="text-slate-500" /> : <Wallet size={14} className="text-green-500" />}
                      {t("wallet.walletPayInstructions", { provider: method === "apple_pay" ? t("paymentMethods.applePay") : t("paymentMethods.googlePay") })}
                    </h3>
                    <p className="text-xs text-muted-foreground">{t("wallet.walletPayDesc")}</p>
                  </div>
                )}

                <Button
                  onClick={() => { if (!amount || parseFloat(amount) <= 0) { toast.error(t("wallet.enterValidAmount")); return; } setStep("confirm"); }}
                  className="w-full h-12 text-base font-bold cursor-pointer"
                >
                  {t("wallet.continue")}
                </Button>
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={goBack} className="w-11 h-11 md:w-9 md:h-9 rounded-lg bg-secondary border border-border flex items-center justify-center hover:bg-primary/5 transition-colors cursor-pointer">
                    <ArrowLeft size={16} className="text-muted-foreground" />
                  </button>
                  <h2 className="font-bold text-foreground">{t("wallet.confirmTopUp")}</h2>
                </div>
                <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground mb-1">{t("wallet.topUpAmount")}</p>
                    <p className="text-3xl font-black font-mono text-foreground">{currency} {parseFloat(amount || "0").toLocaleString()}</p>
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("wallet.via")}</span>
                      <span className="font-medium text-foreground">{selectedMethod?.label}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("wallet.fee")}</span>
                      <span className="font-mono font-medium text-foreground">{currency} {estimatedFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                      <span className="text-muted-foreground font-semibold">{t("wallet.credited", "You'll receive")}</span>
                      <span className="font-mono font-bold text-primary">{currency} {(parseFloat(amount || "0") - estimatedFee).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                      <span className="text-muted-foreground font-semibold">{t("wallet.reference")}</span>
                      <span className="font-mono font-bold text-primary">{txReference}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={reset} className="flex-1 h-12 rounded-xl cursor-pointer">{t("common.cancel")}</Button>
                  <Button onClick={() => void handleConfirm()} disabled={depositing} className="flex-1 h-12 text-base font-bold cursor-pointer">
                    {depositing ? t("signin.checking") : t("wallet.confirmAndTopUp")}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
                <TransactionReceipt
                  type="deposit"
                  reference={txReference}
                  amount={parseFloat(amount || "0").toLocaleString()}
                  currency={currency}
                  method={selectedMethod?.label ?? ""}
                  recipient="PayRus Wallet"
                  fee={lastDeposit ? `${currency} ${lastDeposit.fee.toFixed(2)}` : undefined}
                  date={new Date().toLocaleString()}
                  onClose={reset}
                  onNewTransaction={reset}
                />
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
                    <CheckCircle size={16} />
                    {lastDeposit
                      ? t("wallet.newBalanceMessage", { currency, credited: lastDeposit.credited.toLocaleString() })
                      : t("wallet.successMessage")}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {mode === "convert" && (
        <AnimatePresence mode="wait">
          {convertStep === "form" && (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                <h2 className="font-semibold text-foreground">{t("wallet.convertTitle", "Convert between your wallets")}</h2>

                {hasNoWallets && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
                    <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">{t("wallet.noWalletsYet", "Top up a wallet first before converting between currencies.")}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("wallet.convertFrom", "From (your wallet)")}</label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button onClick={() => setShowFromPicker(!showFromPicker)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary border border-border hover:border-primary/50 transition-colors cursor-pointer whitespace-nowrap">
                        <span>{CURRENCY_FLAGS[fromCurrency] ?? "💱"}</span>
                        <span className="text-sm font-semibold text-foreground">{fromCurrency}</span>
                        <ChevronDown size={14} className="text-muted-foreground" />
                      </button>
                      {showFromPicker && (
                        <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-xl shadow-xl overflow-hidden w-40 max-h-56 overflow-y-auto">
                          {(currentUser ? (realWallets ?? []).map(w => w.currency) : ALL_CURRENCIES).filter(c => c !== toCurrency).map(c => (
                            <button key={c} onClick={() => { setFromCurrency(c); setShowFromPicker(false); }} className="w-full px-3 py-2 text-sm font-medium text-left hover:bg-secondary transition-colors cursor-pointer">
                              {CURRENCY_FLAGS[c] ?? "💱"} {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input value={convertAmount} onChange={e => setConvertAmount(e.target.value)} type="number" placeholder="0.00" className="flex-1 bg-secondary border-border font-mono font-bold" />
                  </div>
                  {currentUser && fromWallet && (
                    <p className="text-[11px] text-muted-foreground">{t("wallet.available", "Available")}: {fromWallet.currency} {fromWallet.balance.toLocaleString()}</p>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  <button
                    onClick={() => { const f = fromCurrency; setFromCurrency(toCurrency); setToCurrency(f); }}
                    className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <Repeat size={15} className="text-primary" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("wallet.convertTo", "To")}</label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button onClick={() => setShowToPicker(!showToPicker)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary border border-border hover:border-primary/50 transition-colors cursor-pointer whitespace-nowrap">
                        <span>{CURRENCY_FLAGS[toCurrency] ?? "💱"}</span>
                        <span className="text-sm font-semibold text-foreground">{toCurrency}</span>
                        <ChevronDown size={14} className="text-muted-foreground" />
                      </button>
                      {showToPicker && (
                        <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-xl shadow-xl overflow-hidden w-40 max-h-56 overflow-y-auto">
                          {ALL_CURRENCIES.filter(c => c !== fromCurrency).map(c => (
                            <button key={c} onClick={() => { setToCurrency(c); setShowToPicker(false); }} className="w-full px-3 py-2 text-sm font-medium text-left hover:bg-secondary transition-colors cursor-pointer">
                              {CURRENCY_FLAGS[c] ?? "💱"} {c} {!heldCurrencies.includes(c) && <span className="text-[10px] text-muted-foreground">({t("wallet.newCurrency", "new")})</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20 font-mono font-bold text-primary flex items-center">
                      {conversionPreview.converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {convertNumAmt > 0 && (
                  <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary">
                    <span className="text-muted-foreground">{t("wallet.fxMarginLabel", "FX margin (10%)")}</span>
                    <span className="font-mono font-semibold text-foreground">{toCurrency} {conversionPreview.fxMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              <Button onClick={handleConvertReview} disabled={hasNoWallets} className="w-full h-12 text-base font-semibold rounded-xl cursor-pointer">{t("wallet.reviewConvert", "Review conversion")}</Button>
            </motion.div>
          )}

          {convertStep === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                <h2 className="font-semibold text-foreground text-lg">{t("wallet.confirmConvert", "Confirm conversion")}</h2>
                <div className="space-y-3 divide-y divide-border">
                  {[
                    [t("wallet.convertFrom", "From"), `${fromCurrency} ${convertNumAmt.toLocaleString()}`],
                    [t("wallet.convertTo", "To"), `${toCurrency} ${conversionPreview.converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}`],
                    [t("wallet.fxMarginLabel", "FX margin (10%)"), `${toCurrency} ${conversionPreview.fxMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between pt-3 first:pt-0">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-semibold text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={resetConvert} className="flex-1 h-12 rounded-xl cursor-pointer">{t("common.cancel")}</Button>
                <Button onClick={() => void handleConvertConfirm()} disabled={converting} className="flex-1 h-12 text-base font-semibold rounded-xl cursor-pointer">
                  {converting ? t("signin.checking") : t("wallet.confirmConvert", "Confirm conversion")}
                </Button>
              </div>
            </motion.div>
          )}

          {convertStep === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
              <TransactionReceipt
                type="convert"
                reference={convertRef}
                amount={convertNumAmt.toLocaleString()}
                currency={fromCurrency}
                convertedAmount={(lastConverted?.converted ?? conversionPreview.converted).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                convertedCurrency={toCurrency}
                method={`${fromCurrency} → ${toCurrency}`}
                date={new Date().toLocaleString()}
                onClose={resetConvert}
                onNewTransaction={resetConvert}
              />
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
                  <CheckCircle size={16} />
                  {t("wallet.convertSuccessMessage", "Conversion complete")}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    {showAddWallet && (
        <AddWalletDialog userId={currentUser?.id} held={heldCurrencies} onClose={() => setShowAddWallet(false)} onCreated={(c) => setCurrency(c)} />
      )}
    </div>
  );
}
