import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Link2, Clock } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import PageHeader from "@/components/ui/page-header.tsx";
import { useProfile } from "@/contexts/profile-context.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useCreatePaymentLinkMutation } from "@/hooks/use-backend.ts";

const ACCEPTED = ["Cards", "GIMAC", "M-Pesa", "SEPA", "Mobile Money"];

export default function PaymentLinks() {
  const { t } = useTranslation("common");
  const { profile } = useProfile();
  const currentUser = useCurrentAppUser();
  const createPaymentLink = useCreatePaymentLinkMutation();

  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [slug, setSlug] = useState("");

  const canGenerate = amount.trim().length > 0 && parseFloat(amount) > 0;

  async function handleGenerate() {
    if (!canGenerate) return;
    const currency = profile?.currency ?? "EUR";
    if (!currentUser) {
      // Anonymous preview — no real link to persist, keep the existing demo flow.
      const base = (profile?.name ?? "payrus").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 18).replace(/^-|-$/g, "");
      setSlug(`payrus.app/b/${base || "merchant"}-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`);
      setGenerated(true);
      return;
    }
    setGenerating(true);
    try {
      const link = await createPaymentLink({ userId: currentUser.id, amount: parseFloat(amount), currency, note: reference || undefined });
      setSlug(`payrus.app/l/${link.slug}`);
      setGenerated(true);
    } catch {
      toast.error(t("links.generateFailed"));
    } finally {
      setGenerating(false);
    }
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(`https://${slug}`).catch(() => {});
    toast.success(t("links.copied"));
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title={t("links.title")} subtitle={t("links.intro")} className="mb-5" />

      {!generated ? (
        <div className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground font-medium">{t("links.amountLabel")}</label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-card border-border text-xl font-bold font-mono h-12"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground font-medium">{t("links.referenceLabel")}</label>
            <Input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder={t("links.referencePlaceholder")}
              className="bg-card border-border"
            />
          </div>
          <div className="rounded-xl bg-card border border-border p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("links.accepted")}</div>
            <div className="flex flex-wrap gap-1.5">
              {ACCEPTED.map(a => (
                <span key={a} className="text-xs px-2 py-1 rounded-md bg-secondary text-foreground font-medium">{t(a)}</span>
              ))}
            </div>
          </div>
          <Button onClick={() => void handleGenerate()} disabled={!canGenerate || generating} className="w-full h-12 text-base font-semibold rounded-xl">
            <Link2 size={16} /> {generating ? t("signin.checking") : t("links.generate")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 max-w-sm">
          <div className="flex flex-col items-center p-6 rounded-2xl bg-white border border-border">
            <div className="w-40 h-40 grid grid-cols-5 gap-1">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className={cn("rounded-sm", i % 3 === 0 || i % 7 === 0 ? "bg-gray-900" : "bg-transparent")} />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 font-mono break-all text-center">{slug}</p>
          </div>

          <div className="rounded-xl bg-card border border-border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("links.amount")}</span>
              <span className="font-semibold text-foreground">{parseFloat(amount).toLocaleString()} {profile?.currency ?? "EUR"}</span>
            </div>
            {reference && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("links.reference")}</span>
                <span className="font-semibold text-foreground truncate max-w-[60%]">{reference}</span>
              </div>
            )}
          </div>

          <Button onClick={handleCopy} className="w-full h-12 text-base font-semibold rounded-xl">
            <Copy size={15} /> {t("links.copyLink")}
          </Button>
          <Button variant="secondary" onClick={() => setGenerated(false)} className="w-full h-11 rounded-xl">
            {t("links.newLink")}
          </Button>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground justify-center">
            <Clock size={12} /> {t("links.expires")}
          </p>
        </div>
      )}
    </div>
  );
}
