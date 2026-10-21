import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, PhoneCall, ShieldOff, Plus } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import PageHeader from "@/components/ui/page-header.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useCreateDisputeMutation, useDisputesForUser, useRecentTransfersForUser } from "@/hooks/use-backend.ts";

const DEMO_CASES = [
  { id: "d1", name: "Dispute · card 4471", meta: "Merchant not received · day 3 of 10", amount: "27 550 XAF", status: "open" as const },
  { id: "d2", name: "Failed transfer to Luanda", meta: "IBAN mismatch · refunded", amount: "", status: "resolved" as const },
];

export default function Disputes() {
  const { t } = useTranslation("common");
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentUser = useCurrentAppUser();
  const realDisputes = useDisputesForUser(currentUser?.id);
  const recentTransfers = useRecentTransfersForUser(currentUser?.id, 200);
  const { lng } = useParams<{ lng: string }>();
  const [searchParams] = useSearchParams();
  const aboutRef = searchParams.get("ref");
  const aboutTransfer = aboutRef ? recentTransfers?.find((x) => x.reference === aboutRef) : undefined;
  useEffect(() => { if (aboutRef) setShowForm(true); }, [aboutRef]);
  const createDispute = useCreateDisputeMutation();

  const hasReal = !!realDisputes;
  const displayCases = hasReal
    ? realDisputes.map(c => ({
        id: c.id, name: `Dispute · ${c.reason}`, meta: c.transferId ? "Linked to a real transfer" : "General inquiry",
        amount: "", status: c.status,
      }))
    : DEMO_CASES;

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    if (!currentUser) {
      // Anonymous preview — nothing real to persist, keep the existing demo flow.
      toast.success(t("disputes.submitted"));
      setReason("");
      setShowForm(false);
      return;
    }
    setSubmitting(true);
    try {
      await createDispute({ userId: currentUser.id, transferId: aboutTransfer?.id, reason: reason.trim() });
      toast.success(t("disputes.submitted"));
      setReason("");
      setShowForm(false);
    } catch {
      toast.error(t("disputes.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title={t("disputes.title")} subtitle={t("disputes.intro")} className="mb-5" />

      <div className="space-y-2 mb-6">
        {displayCases.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">{t("disputes.noCases")}</p>
        )}
        {displayCases.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              c.status === "open" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary",
            )}>
              {c.status === "open" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground truncate">{c.meta}</div>
            </div>
            <div className="text-right shrink-0">
              {c.amount && <div className="text-sm font-bold font-mono text-foreground">{c.amount}</div>}
              <span className={cn(
                "inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                c.status === "open" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary",
              )}>
                {t(`disputes.status.${c.status}`)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-border hover:border-primary/40 transition-colors text-left cursor-pointer mb-3"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Plus size={17} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{t("disputes.raiseNew")}</div>
            <div className="text-xs text-muted-foreground">{t("disputes.raiseNewNote")}</div>
          </div>
        </button>
      ) : (
        <div className="rounded-xl bg-card border border-border p-4 space-y-3 mb-3">
          {aboutRef && (
            <div className="text-xs rounded-lg bg-secondary px-3 py-2 flex items-center justify-between gap-2">
              <span>{t("txd.disputeAbout", { ref: aboutRef })}</span>
              <Link to={`/${lng}/transactions/${encodeURIComponent(aboutRef)}`} className="text-primary font-semibold hover:underline shrink-0">{t("txd.viewTransaction")}</Link>
            </div>
          )}
          <label className="text-sm text-muted-foreground font-medium">{t("disputes.reasonLabel")}</label>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t("disputes.reasonPlaceholder")} className="bg-background border-border" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">{t("disputes.cancel")}</Button>
            <Button onClick={() => void handleSubmit()} disabled={!reason.trim() || submitting} className="flex-1">{submitting ? t("signin.checking") : t("disputes.submit")}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => toast(t("disputes.callAgentNote"))}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors cursor-pointer"
        >
          <PhoneCall size={19} className="text-primary" />
          <span className="text-xs font-semibold text-foreground text-center">{t("disputes.callAgent")}</span>
          <span className="text-[10px] text-muted-foreground text-center">{t("disputes.frEnPtLingala")}</span>
        </button>
        <button
          onClick={() => toast.success(t("disputes.cardFrozen"))}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-destructive/40 transition-colors cursor-pointer"
        >
          <ShieldOff size={19} className="text-destructive" />
          <span className="text-xs font-semibold text-foreground text-center">{t("disputes.reportLost")}</span>
          <span className="text-[10px] text-muted-foreground text-center">{t("disputes.reportLostNote")}</span>
        </button>
      </div>
    </div>
  );
}
