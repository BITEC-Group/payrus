import { useState } from "react";
import { transactionErrorMessage } from "@/lib/transaction-errors.ts";
import { useTranslation } from "react-i18next";
import { Droplet, Tv, Smartphone, Wifi, Pause } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import PageHeader from "@/components/ui/page-header.tsx";
import TransactionReceipt from "@/components/ui/transaction-receipt.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useApplyWalletTransferMutation, useBillBillers, useBillSubscriptionsForUser, useUpsertBillSubscriptionMutation } from "@/hooks/use-backend.ts";
import { toast } from "sonner";

const DEMO_BILLERS = [
  { id: "seeg", name: "SEEG — Water", meta: "Libreville · due in 3 days", amount: "18 400", currency: "XAF", icon: Droplet, autoPay: false, paused: false },
  { id: "canal", name: "Canal+ Gabon", meta: "Monthly subscription", amount: "22 500", currency: "XAF", icon: Tv, autoPay: true, paused: false },
  { id: "airtel", name: "Airtel Airtime", meta: "Kinshasa · +243 •• 41", amount: "12 000", currency: "CDF", icon: Smartphone, autoPay: false, paused: false },
  { id: "unitel", name: "Unitel Angola", meta: "Luanda · data bundle", amount: "4 900", currency: "AOA", icon: Wifi, autoPay: false, paused: false },
  { id: "orange", name: "Orange CI Internet", meta: "Paused", amount: "—", currency: "", icon: Wifi, autoPay: false, paused: true },
];

// Real billers (supabase/migrations/0016) have no bill amount of their own
// (they're a catalog, not per-cycle invoices) — reuse a small fixed demo
// amount per category so "Pay" still has something real to debit, same
// spirit as payments/page.tsx's fixed-amount card/QR flows.
const CATEGORY_ICON: Record<string, typeof Droplet> = { water: Droplet, tv: Tv, mobile: Smartphone, internet: Wifi };
const CATEGORY_AMOUNT: Record<string, number> = { water: 18400, tv: 22500, mobile: 12000, internet: 4900 };

export default function Bills() {
  const { t } = useTranslation("common");
  const currentUser = useCurrentAppUser();
  const realBillers = useBillBillers();
  const subscriptions = useBillSubscriptionsForUser(currentUser?.id);
  const upsertSubscription = useUpsertBillSubscriptionMutation();
  const applyTransaction = useApplyWalletTransferMutation();

  const [demoAutoPay, setDemoAutoPay] = useState<Record<string, boolean>>(
    Object.fromEntries(DEMO_BILLERS.map(b => [b.id, b.autoPay])),
  );
  const [paying, setPaying] = useState<{ id: string; name: string; amount: string; currency: string } | null>(null);
  const [reference, setReference] = useState("");
  const [payingReal, setPayingReal] = useState(false);

  const hasReal = !!currentUser && !!realBillers && realBillers.length > 0;
  const subByBiller = Object.fromEntries((subscriptions ?? []).map(s => [s.billerId, s]));

  async function handlePay(biller: { id: string; name: string; amount: string | number; currency: string }) {
    if (!hasReal) {
      setReference(`BILL-${Date.now().toString().slice(-10)}`);
      setPaying({ id: biller.id, name: biller.name, amount: String(biller.amount), currency: biller.currency });
      return;
    }
    setPayingReal(true);
    try {
      const amount = typeof biller.amount === "number" ? biller.amount : parseFloat(biller.amount);
      await applyTransaction({ userId: currentUser!.id, amount, currency: biller.currency, type: "payment", note: `Bill: ${biller.name}` });
      setReference(`BILL-${Date.now().toString().slice(-10)}`);
      setPaying({ id: biller.id, name: biller.name, amount: amount.toLocaleString(), currency: biller.currency });
    } catch (e) {
      toast.error(transactionErrorMessage(e, t, "bills.payFailed"));
    } finally {
      setPayingReal(false);
    }
  }

  function handleToggleAutoPay(billerId: string, v: boolean) {
    if (!hasReal) { setDemoAutoPay(a => ({ ...a, [billerId]: v })); return; }
    void upsertSubscription({ userId: currentUser!.id, billerId, autoPay: v });
  }

  const displayBillers = hasReal
    ? realBillers.map(b => ({
        id: b.id, name: b.name, meta: b.meta ?? "", amount: (CATEGORY_AMOUNT[b.category ?? ""] ?? 10000).toLocaleString(),
        rawAmount: CATEGORY_AMOUNT[b.category ?? ""] ?? 10000, currency: b.currency,
        icon: CATEGORY_ICON[b.category ?? ""] ?? Wifi, autoPay: subByBiller[b.id]?.autoPay ?? false, paused: subByBiller[b.id]?.paused ?? false,
      }))
    : DEMO_BILLERS.map(b => ({ ...b, rawAmount: parseFloat(b.amount.replace(/\s/g, "")) || 0 }));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title={t("bills.title")} subtitle={t("bills.intro")} className="mb-5" />

      <div className="space-y-2">
        {displayBillers.map(b => (
          <div key={b.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              b.paused ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary",
            )}>
              {b.paused ? <Pause size={18} /> : <b.icon size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{b.name}</div>
              <div className="text-xs text-muted-foreground truncate">{b.meta}</div>
            </div>
            <div className="text-right shrink-0 space-y-1.5">
              {!b.paused && (
                <div className="text-sm font-bold font-mono text-foreground">{b.amount} <span className="text-xs font-normal text-muted-foreground">{b.currency}</span></div>
              )}
              {!b.paused && (
                <Button size="sm" variant="secondary" className="h-7 text-xs" disabled={payingReal} onClick={() => void handlePay({ id: b.id, name: b.name, amount: b.rawAmount, currency: b.currency })}>
                  {payingReal ? t("signin.checking") : t("bills.pay")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-card border border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("bills.autoPayTitle")}</h2>
        {displayBillers.filter(b => !b.paused).map(b => (
          <div key={b.id} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{b.name}</span>
            <Switch checked={hasReal ? b.autoPay : demoAutoPay[b.id]} onCheckedChange={v => handleToggleAutoPay(b.id, v)} />
          </div>
        ))}
      </div>

      {paying && (
        <TransactionReceipt
          type="bill"
          amount={paying.amount}
          currency={paying.currency}
          recipient={paying.name}
          reference={reference}
          date={new Date().toLocaleString()}
          onClose={() => setPaying(null)}
          onNewTransaction={() => setPaying(null)}
        />
      )}
    </div>
  );
}
