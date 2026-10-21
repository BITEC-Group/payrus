import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { Send, X } from "lucide-react";
import type { EscalationAction } from "@/lib/backend.ts";
import { useSupportRequestEscalationMutation } from "@/hooks/use-backend.ts";

const ACTIONS: { value: EscalationAction; label: string; needsTx: boolean }[] = [
  { value: "complete", label: "Complete a stuck transaction", needsTx: true },
  { value: "refund", label: "Refund a transaction", needsTx: true },
  { value: "close_dispute", label: "Close a dispute", needsTx: true },
  { value: "void", label: "Void an unexecuted transaction (superadmin)", needsTx: true },
  { value: "adjustment", label: "Credit the user (adjustment)", needsTx: false },
  { value: "profile_edit", label: "Change the user's profile", needsTx: false },
  { value: "other", label: "Other request", needsTx: false },
];

// View-only support staff cannot change anything: this files a request for a
// higher profile (admin / superadmin), who approves — which executes it — or
// rejects it from the Escalations tab.
export default function EscalateForm({
  userId, userLabel, transferId, transferReference, currency, onDone,
}: {
  userId: string; userLabel: string; transferId?: string; transferReference?: string; currency?: string; onDone: () => void;
}) {
  const { t } = useTranslation("common");
  const request = useSupportRequestEscalationMutation();
  const available = ACTIONS.filter((a) => !a.needsTx || transferId);
  const [action, setAction] = useState<EscalationAction>(available[0]?.value ?? "other");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState(currency ?? "");
  const [saving, setSaving] = useState(false);
  const field = "mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs";

  const submit = async () => {
    setSaving(true);
    try {
      await request({
        targetUserId: userId, action, details,
        transferId: ACTIONS.find((a) => a.value === action)?.needsTx ? transferId : undefined,
        amount: action === "adjustment" ? Number(amount) : undefined,
        currency: action === "adjustment" ? cur.trim().toUpperCase() : undefined,
      });
      toast.success(t("admin.escalateform.escalationSentToA"));
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/^[A-Za-z]+: /, "") : "Could not send the escalation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-secondary/40 rounded-xl p-3 mt-2 space-y-2">
      <div className="text-[11px] text-muted-foreground">
        {t("admin.escalateform.escalateFor")} <span className="font-semibold text-foreground">{userLabel}</span>
        {transferReference && <> · <span className="font-mono">{transferReference}</span></>}
      </div>
      <label className="block text-[10px] text-muted-foreground font-semibold uppercase">
        {t("admin.escalateform.requestedChange")}
        <select value={action} onChange={(e) => setAction(e.target.value as EscalationAction)} className={field}>
          {available.map((a) => <option key={a.value} value={a.value}>{t(a.label)}</option>)}
        </select>
      </label>
      {action === "adjustment" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-muted-foreground font-semibold uppercase">
            {t("payments.amount")}
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          </label>
          <label className="text-[10px] text-muted-foreground font-semibold uppercase">
            {t("groups.currency")}
            <input value={cur} maxLength={3} onChange={(e) => setCur(e.target.value)} className={field} />
          </label>
        </div>
      )}
      <label className="block text-[10px] text-muted-foreground font-semibold uppercase">
        {t("admin.escalateform.whatTheUserReported")}
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className={field} />
      </label>
      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer">
          <X size={12} /> {t("disputes.cancel")}
        </button>
        <button onClick={() => void submit()} disabled={saving || details.trim().length < 3} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground cursor-pointer disabled:opacity-60">
          <Send size={12} /> {saving ? t("admin.escalateform.sending") : t("admin.escalateform.sendEscalation")}
        </button>
      </div>
    </div>
  );
}
