import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, CreditCard, Plus, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { useIssueCardMutation, useUpdateCardSettingsMutation } from "@/hooks/use-backend.ts";
import type { LinkedPaymentMethod } from "@/lib/backend.ts";

/** The card fields the dialogs show (the Cards page keeps a superset). */
export interface CardView {
  /** The database id; absent for the demo deck shown to signed-out visitors. */
  realId?: string;
  tier: string; brand: string; last4: string; holder: string; expiry: string; balance: number; currency: string; type: string;
  network: string; contactless: boolean; locked: boolean; monthlySpend: number; monthlyLimit: number;
}

const money = (n: number, currency: string) => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Row({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/60 last:border-0 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-foreground text-right break-words" data-testid={testId}>{children}</span>
    </div>
  );
}

export function CardDetailsDialog({ card, onClose }: { card: CardView; onClose: () => void }) {
  const { t } = useTranslation("common");
  const remaining = Math.max(card.monthlyLimit - card.monthlySpend, 0);
  const pct = card.monthlyLimit > 0 ? Math.min(100, Math.round((card.monthlySpend / card.monthlyLimit) * 100)) : 0;

  const copy = () => {
    const text = `${card.brand} •••• ${card.last4} · ${t("cards.details.expires")} ${card.expiry} · ${card.holder}`;
    navigator.clipboard.writeText(text).then(() => toast.success(t("cards.details.copied")), () => toast.error(t("cards.details.copyFailed")));
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden gap-0" data-testid="card-details">
        <DialogHeader className="px-6 pt-6 pb-3 text-left">
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><CreditCard size={15} className="text-primary" /> {t("cards.details.title")}</DialogTitle>
          <DialogDescription className="text-[11px]">{card.brand} {card.tier} · {card.type}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-3 max-h-[70vh] overflow-auto">
          <div className="rounded-2xl bg-secondary/50 px-4 py-3">
            <div className="font-mono text-lg tracking-widest text-foreground" data-testid="card-number">•••• •••• •••• {card.last4}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1"><ShieldCheck size={11} className="text-emerald-700" /> {t("cards.details.numberNote")}</div>
          </div>
          <div>
            <Row label={t("cards.details.holder")}>{card.holder}</Row>
            <Row label={t("cards.details.expires")}>{card.expiry}</Row>
            <Row label={t("cards.details.network")}>{card.network}</Row>
            <Row label={t("cards.details.type")}>{card.type}</Row>
            <Row label={t("cards.details.currency")}>{card.currency}</Row>
            <Row label={t("cards.details.balance")}>{money(card.balance, card.currency)}</Row>
            <Row label={t("cards.details.contactless")}>{card.contactless ? t("cards.details.on") : t("cards.details.off")}</Row>
            <Row label={t("cards.details.status")} testId="card-status">
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", card.locked ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700")}>
                {card.locked ? t("cards.details.locked") : t("cards.details.active")}
              </span>
            </Row>
          </div>
          <div className="rounded-2xl border border-border p-3 space-y-2">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("cards.details.monthlyLimit")}</span><span className="font-mono font-semibold">{money(card.monthlyLimit, card.currency)}</span></div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
            <div className="flex justify-between text-[11px] text-muted-foreground"><span>{t("cards.details.spent")}: {money(card.monthlySpend, card.currency)}</span><span>{t("cards.details.remaining")}: {money(remaining, card.currency)}</span></div>
          </div>
          <button type="button" onClick={copy}
            className="w-full py-2.5 rounded-xl border border-border text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-secondary cursor-pointer transition-colors">
            <Copy size={13} /> {t("cards.details.copy")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CardSettingsDialog({ card, userId, onClose }: { card: CardView; userId: string | undefined; onClose: () => void }) {
  const { t } = useTranslation("common");
  const update = useUpdateCardSettingsMutation();
  const [limit, setLimit] = useState(String(card.monthlyLimit));
  const [contactless, setContactless] = useState(card.contactless);
  const [busy, setBusy] = useState(false);
  const limitNum = Number(limit);
  const valid = limit.trim() !== "" && Number.isFinite(limitNum) && limitNum >= 0 && limitNum <= 100000;
  const canSave = !!card.realId && !!userId;

  async function save() {
    if (!card.realId || !userId || !valid) return;
    setBusy(true);
    try {
      await update({ userId, cardId: card.realId, monthlyLimit: limitNum, contactless });
      toast.success(t("cards.settings.saved"));
      onClose();
    } catch {
      toast.error(t("cards.settings.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden gap-0" data-testid="card-settings">
        <DialogHeader className="px-6 pt-6 pb-3 text-left">
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Settings2 size={15} className="text-primary" /> {t("cards.settings.title")}</DialogTitle>
          <DialogDescription className="text-[11px]">{card.brand} •••• {card.last4}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">{t("cards.settings.limit", { currency: card.currency })}</span>
            <input id="card-limit" type="number" min={0} max={100000} step="50" value={limit} onChange={(e) => setLimit(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm font-mono" />
          </label>
          {!valid && <p className="text-xs text-destructive" role="alert">{t("cards.settings.limitRange")}</p>}
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 cursor-pointer">
            <span className="text-sm font-medium">{t("cards.details.contactless")}</span>
            <input id="card-contactless" type="checkbox" checked={contactless} onChange={(e) => setContactless(e.target.checked)} className="accent-primary w-4 h-4" />
          </label>
          {!canSave && <p className="text-[11px] text-muted-foreground">{t("cards.settings.demoNote")}</p>}
          <button type="button" disabled={!canSave || !valid || busy} onClick={() => void save()}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy ? t("signin.checking") : t("cards.settings.save")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IssueCardDialog({ userId, currencies, defaultCurrency, onClose, onIssued }: {
  userId: string | undefined; currencies: string[]; defaultCurrency: string; onClose: () => void; onIssued?: () => void;
}) {
  const { t } = useTranslation("common");
  const issue = useIssueCardMutation();
  const options = currencies.length > 0 ? currencies : [defaultCurrency];
  const [currency, setCurrency] = useState(options.includes(defaultCurrency) ? defaultCurrency : options[0]);
  const [limit, setLimit] = useState("1000");
  const [busy, setBusy] = useState(false);
  const limitNum = Number(limit);
  const valid = limit.trim() !== "" && Number.isFinite(limitNum) && limitNum >= 0 && limitNum <= 100000;

  async function create() {
    if (!userId || !valid) return;
    setBusy(true);
    try {
      const card = await issue({ userId, currency, monthlyLimit: limitNum });
      toast.success(t("cards.issue.created", { last4: card.last4 }));
      onIssued?.();
      onClose();
    } catch (e) {
      const m = e instanceof Error ? e.message.toLowerCase() : "";
      toast.error(m.includes("at most 6") ? t("cards.issue.limitReached") : t("cards.issue.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden gap-0" data-testid="issue-card">
        <DialogHeader className="px-6 pt-6 pb-3 text-left">
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Plus size={15} className="text-primary" /> {t("cards.issue.title")}</DialogTitle>
          <DialogDescription className="text-[11px]">{t("cards.issue.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">{t("cards.issue.currency")}</span>
            <select id="issue-card-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm">
              {options.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">{t("cards.settings.limit", { currency })}</span>
            <input id="issue-card-limit" type="number" min={0} max={100000} step="50" value={limit} onChange={(e) => setLimit(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm font-mono" />
          </label>
          {!valid && <p className="text-xs text-destructive" role="alert">{t("cards.settings.limitRange")}</p>}
          {!userId && <p className="text-[11px] text-muted-foreground">{t("cards.issue.signIn")}</p>}
          <button type="button" disabled={!userId || !valid || busy} onClick={() => void create()}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy ? t("signin.checking") : t("cards.issue.create")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LinkedAccountDialog({ account, providerLabel, onClose }: { account: LinkedPaymentMethod; providerLabel: string; onClose: () => void }) {
  const { t, i18n } = useTranslation("common");
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden gap-0" data-testid="linked-account-details">
        <DialogHeader className="px-6 pt-6 pb-3 text-left">
          <DialogTitle className="text-sm font-bold">{t("cards.account.title")}</DialogTitle>
          <DialogDescription className="text-[11px]">{providerLabel}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <Row label={t("cards.account.label")}>{account.label}</Row>
          <Row label={t("cards.account.provider")}>{providerLabel}</Row>
          <Row label={t("cards.account.status")}>{account.status === "primary" ? t("cards.account.primary") : t("cards.account.active")}</Row>
          <Row label={t("cards.account.linked")}>{new Date(account.createdAt).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" })}</Row>
        </div>
      </DialogContent>
    </Dialog>
  );
}
