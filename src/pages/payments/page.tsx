import { useState } from "react";
import { transactionErrorMessage } from "@/lib/transaction-errors.ts";
import CapabilityBadge from "@/components/ui/capability-badge.tsx";
import { motion, AnimatePresence } from "motion/react";
import { CreditCard, QrCode, Smartphone, Banknote, ChevronRight, NfcIcon, ArrowLeft, Wallet } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import TransactionReceipt from "@/components/ui/transaction-receipt.tsx";
import { commissionFor, midMarketConvert } from "@/convex/fx.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useApplyWalletTransferMutation } from "@/hooks/use-backend.ts";

type PaymentMethod = "card" | "qr" | "mobile" | "cash" | "wallet";
type Step = "method" | "amount" | "confirm" | "success";

const cards = [
  { last4: "4821", brand: "Visa", color: "from-blue-600 to-blue-900" },
  { last4: "9302", brand: "Mastercard", color: "from-red-600 to-orange-800" },
];

export default function Payments() {
  const { t } = useTranslation("common");
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selectedCard, setSelectedCard] = useState(0);
  const [txReference] = useState(() => `TXN-${Date.now().toString().slice(-10)}`);
  const [paying, setPaying] = useState(false);

  const currentUser = useCurrentAppUser();
  const applyTransaction = useApplyWalletTransferMutation();
  const numAmt = parseFloat(amount) || 0;
  const commission = commissionFor(numAmt); // flat 3.5% commission, paid by the sender

  const methods = [
    { id: "wallet" as PaymentMethod, label: t("payments.walletPayment"), sub: t("payments.walletSub"), icon: Wallet, color: "bg-primary/10 text-primary border-primary/30" },
    { id: "card" as PaymentMethod, label: t("payments.cardPayment"), sub: t("payments.cardSub"), icon: CreditCard, color: "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30" },
    { id: "qr" as PaymentMethod, label: t("payments.qrMobile"), sub: t("payments.qrSub"), icon: QrCode, color: "bg-primary/10 text-primary border-primary/30" },
    { id: "mobile" as PaymentMethod, label: t("payments.mobileMoney"), sub: t("payments.mobileSub"), icon: Smartphone, color: "bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30" },
    { id: "cash" as PaymentMethod, label: t("payments.cash"), sub: t("payments.cashSub"), icon: Banknote, color: "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30" },
  ];

  const handlePay = () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error(t("common.error")); return; }
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!currentUser) {
      // Anonymous preview — no real wallet to debit, keep the existing demo flow.
      setStep("success");
      toast.success(t("common.success"));
      return;
    }
    setPaying(true);
    try {
      await applyTransaction({ userId: currentUser.id, amount: numAmt, currency: "USD", type: "payment" });
      setStep("success");
      toast.success(t("common.success"));
    } catch (e) {
      toast.error(transactionErrorMessage(e, t, "payments.paymentFailed"));
    } finally {
      setPaying(false);
    }
  };

  const reset = () => { setStep("method"); setMethod(null); setAmount(""); setRecipient(""); };

  const selectedMethod = methods.find(m => m.id === method);

  const goBack = () => {
    if (step === "confirm") setStep("amount");
    else if (step === "amount") setStep("method");
    else setStep("method");
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        {step !== "method" && step !== "success" && (
          <button onClick={goBack} className="w-11 h-11 md:w-9 md:h-9 rounded-lg bg-secondary border border-border flex items-center justify-center hover:bg-primary/5 transition-colors cursor-pointer">
            <ArrowLeft size={16} className="text-muted-foreground" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">{t("payments.title")} <CapabilityBadge capability="payments.methods" /></h1>
          <p className="text-sm text-muted-foreground">{t("payments.subtitle")}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "method" && (
          <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium mb-4">{t("payments.selectMethod")}</p>
            {methods.map((m) => (
              <button key={m.id} onClick={() => { setMethod(m.id); setStep("amount"); }} className={cn("w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-all text-left cursor-pointer", method === m.id ? "border-primary" : "border-border")}>
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", m.color)}>
                  <m.icon size={22} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{m.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{m.sub}</div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            ))}
            <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card mt-4">
              <NfcIcon size={16} className="text-accent" />
              <span className="text-xs text-muted-foreground">{t("payments.nfc")}</span>
            </div>
          </motion.div>
        )}

        {step === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            {selectedMethod && (
              <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium", selectedMethod.color)}>
                <selectedMethod.icon size={15} />
                {selectedMethod.label}
              </div>
            )}
            {method === "card" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">{t("payments.selectCard")}</p>
                <div className="flex gap-3">
                  {cards.map((card, i) => (
                    <button key={i} onClick={() => setSelectedCard(i)} className={cn("flex-1 p-3 rounded-xl border transition-all cursor-pointer", selectedCard === i ? "border-primary bg-primary/5" : "border-border bg-card")}>
                      <div className={cn("h-12 rounded-lg bg-gradient-to-r mb-2", card.color)} />
                      <div className="text-xs font-mono text-muted-foreground">{card.brand} •••• {card.last4}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {method === "mobile" && (
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground font-medium">{t("payments.recipientNumber")}</label>
                <Input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={t("payments.2438xxXxxXxxx")} className="bg-card border-border" />
              </div>
            )}
            {method === "qr" && (
              <div className="flex flex-col items-center p-6 rounded-xl bg-white border border-border">
                <div className="w-40 h-40 grid grid-cols-5 gap-1">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className={cn("rounded-sm", i % 3 === 0 || i % 7 === 0 ? "bg-gray-900" : "bg-transparent")} />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3 font-mono">{t("payments.payrus")}{txReference}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground font-medium">{t("payments.amountLabel")}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">$</span>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="pl-8 bg-card border-border text-2xl font-bold font-mono h-14" />
              </div>
              {amount && <p className="text-xs text-muted-foreground">{t("payments.xaf", { amount: midMarketConvert(parseFloat(amount), "USD", "XAF").toLocaleString(undefined, { maximumFractionDigits: 0 }) })}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground font-medium">{t("payments.descLabel")}</label>
              <Input placeholder={t("payments.descPlaceholder")} className="bg-card border-border" />
            </div>
            <Button onClick={handlePay} className="w-full h-12 text-base font-semibold rounded-xl">{t("payments.continue")}</Button>
          </motion.div>
        )}

        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div className="rounded-xl bg-card border border-border p-5 space-y-4">
              <h2 className="font-semibold text-foreground text-lg">{t("payments.confirmTitle")}</h2>
              <div className="space-y-3 divide-y divide-border">
                {[
                  { label: t("payments.method"), value: selectedMethod?.label ?? "" },
                  { label: t("payments.amount"), value: `$${parseFloat(amount).toFixed(2)}` },
                  { label: t("payments.equivalent"), value: `${midMarketConvert(parseFloat(amount), "USD", "XAF").toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF` },
                  { label: t("payments.fees"), value: `$${commission.toFixed(2)}` },
                  { label: t("payments.total"), value: `$${(numAmt + commission).toFixed(2)}` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between pt-3 first:pt-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={cn("text-sm font-semibold", row.label === t("payments.total") ? "text-primary" : "text-foreground")}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={reset} className="flex-1 h-12 rounded-xl">{t("common.cancel")}</Button>
              <Button onClick={() => void handleConfirm()} disabled={paying} className="flex-1 h-12 text-base font-semibold rounded-xl">{paying ? t("signin.checking") : t("payments.payNow")}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction receipt overlay */}
      {step === "success" && (
        <TransactionReceipt
          type="payment"
          amount={`$${parseFloat(amount).toFixed(2)}`}
          currency="USD"
          convertedAmount={`${midMarketConvert(parseFloat(amount), "USD", "XAF").toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          convertedCurrency="XAF"
          recipient={recipient || undefined}
          method={selectedMethod?.label}
          fee="$0.25"
          reference={txReference}
          date={new Date().toLocaleString()}
          onClose={reset}
          onNewTransaction={reset}
        />
      )}
    </div>
  );
}
