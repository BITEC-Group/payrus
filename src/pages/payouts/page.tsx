import { useState } from "react";
import { transactionErrorMessage } from "@/lib/transaction-errors.ts";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Banknote, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import PageHeader from "@/components/ui/page-header.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useCreatePayoutBatchMutation, usePayoutBatchesForUser } from "@/hooks/use-backend.ts";

const DEMO_PAYOUTS = [
  { id: "p1", name: "Batch #4471", meta: "142 transfers · GIMAC", amount: "8 420 000", currency: "XAF", status: "settled" },
  { id: "p2", name: "Batch #4470", meta: "96 transfers · M-Pesa CDF", amount: "31 900 000", currency: "CDF", status: "settled" },
  { id: "p3", name: "Card acquiring", meta: "Yesterday · net of 1.4%", amount: "2 118 000", currency: "XAF", status: "settled" },
  { id: "p4", name: "EUR corridor sweep", meta: "SEPA · 14:00 cut-off", amount: "38 400", currency: "EUR", status: "pending" },
  { id: "p5", name: "USD corridor sweep", meta: "Kinshasa · accepted on all channels", amount: "24 100", currency: "USD", status: "pending" },
  { id: "p6", name: "AOA corridor sweep", meta: "Luanda · Multicaixa Express", amount: "9 640 000", currency: "AOA", status: "pending" },
  { id: "p7", name: "Agent float reconciliation", meta: "31 agents · open", amount: "1 042 000", currency: "XAF", status: "open" },
];

const STATUS_STYLE: Record<string, string> = {
  settled: "bg-primary/10 text-primary",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  open: "bg-secondary text-muted-foreground",
};

type Row = { recipientLabel: string; amount: string };

export default function Payouts() {
  const { t } = useTranslation("common");
  const currentUser = useCurrentAppUser();
  const realBatches = usePayoutBatchesForUser(currentUser?.id);
  const createBatch = useCreatePayoutBatchMutation();

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [rows, setRows] = useState<Row[]>([{ recipientLabel: "", amount: "" }]);
  const [creating, setCreating] = useState(false);

  const hasReal = !!realBatches;
  const displayPayouts = hasReal && realBatches.length > 0
    ? realBatches.map(b => ({ id: b.id, name: b.label, meta: new Date(b.createdAt).toLocaleString(), amount: b.totalAmount.toLocaleString(), currency: b.currency, status: b.status }))
    : DEMO_PAYOUTS;

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  async function handleCreate() {
    const validRows = rows.filter(r => r.recipientLabel.trim() && parseFloat(r.amount) > 0);
    if (!label.trim() || validRows.length === 0) { toast.error(t("payouts.formInvalid")); return; }
    if (!currentUser) {
      toast.success(t("payouts.createdToast"));
      setShowForm(false);
      setLabel(""); setRows([{ recipientLabel: "", amount: "" }]);
      return;
    }
    setCreating(true);
    try {
      await createBatch({
        userId: currentUser.id, label: label.trim(), currency,
        items: validRows.map(r => ({ recipientLabel: r.recipientLabel.trim(), amount: parseFloat(r.amount) })),
      });
      toast.success(t("payouts.createdToast"));
      setShowForm(false);
      setLabel(""); setRows([{ recipientLabel: "", amount: "" }]);
    } catch (e) {
      toast.error(transactionErrorMessage(e, t, "payouts.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title={t("payouts.title")} subtitle={t("payouts.intro")} className="mb-5" />

      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />} {t("payouts.newBatch")}
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-xl bg-card border border-border p-4 space-y-3">
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={t("payouts.labelPlaceholder")} className="bg-secondary border-border" />
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm">
            {["XAF", "CDF", "AOA", "USD", "EUR"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input value={r.recipientLabel} onChange={e => updateRow(i, { recipientLabel: e.target.value })} placeholder={t("payouts.recipientPlaceholder")} className="flex-1 bg-secondary border-border" />
              <Input type="number" value={r.amount} onChange={e => updateRow(i, { amount: e.target.value })} placeholder="0.00" className="w-28 bg-secondary border-border" />
            </div>
          ))}
          <button onClick={() => setRows(prev => [...prev, { recipientLabel: "", amount: "" }])} className="text-xs text-primary hover:underline cursor-pointer">
            + {t("payouts.addRecipient")}
          </button>
          <Button className="w-full" disabled={creating} onClick={() => void handleCreate()}>
            {creating ? t("signin.checking") : t("payouts.create")}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {displayPayouts.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.2 }}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Banknote size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{t(p.name)}</div>
              <div className="text-xs text-muted-foreground truncate">{t(p.meta)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold font-mono text-foreground">{p.amount} <span className="text-xs font-normal text-muted-foreground">{p.currency}</span></div>
              <span className={cn("inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md capitalize", STATUS_STYLE[p.status])}>
                {t(`payouts.status.${p.status}`)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
