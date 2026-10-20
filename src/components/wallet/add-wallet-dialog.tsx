import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { useCreateMyWalletMutation, useWalletCurrencies } from "@/hooks/use-backend.ts";

const FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", XAF: "🌍", XOF: "🌍", CDF: "🇨🇩", AOA: "🇦🇴", AED: "🇦🇪", CNY: "🇨🇳", NGN: "🇳🇬", GHS: "🇬🇭", RWF: "🇷🇼",
  ZAR: "🇿🇦", ETB: "🇪🇹", GBP: "🇬🇧", CAD: "🇨🇦", KES: "🇰🇪", MAD: "🇲🇦", EGP: "🇪🇬", TZS: "🇹🇿", UGX: "🇺🇬", BRL: "🇧🇷", INR: "🇮🇳",
};

/** Maps the database's refusals to translation keys so the customer sees a clear reason. */
function walletErrorKey(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already have")) return "wallet.add.exists";
  if (m.includes("at most 12")) return "wallet.add.limit";
  if (m.includes("not a supported")) return "wallet.add.unsupported";
  if (m.includes("branding")) return "wallet.add.unsupported";
  return "wallet.add.failed";
}

interface Props {
  userId: string | undefined;
  /** Currencies the customer already holds a wallet in (hidden from the list). */
  held: string[];
  /** Preselected currency, e.g. the send currency of a transfer that has no wallet yet. */
  suggested?: string;
  onClose: () => void;
  onCreated?: (currency: string) => void;
}

export default function AddWalletDialog({ userId, held, suggested, onClose, onCreated }: Props) {
  const { t } = useTranslation("common");
  const currencies = useWalletCurrencies();
  const createWallet = useCreateMyWalletMutation();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(suggested && !held.includes(suggested) ? suggested : null);
  const [busy, setBusy] = useState(false);

  const available = useMemo(
    () => (currencies ?? []).filter((c) => !held.includes(c.code) && c.code.toLowerCase().includes(query.trim().toLowerCase())),
    [currencies, held, query],
  );

  async function create() {
    if (!userId || !picked) return;
    setBusy(true);
    try {
      await createWallet({ userId, currency: picked });
      toast.success(t("wallet.add.created", { currency: picked }));
      onCreated?.(picked);
      onClose();
    } catch (e) {
      toast.error(t(walletErrorKey(e instanceof Error ? e.message : "")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden gap-0" data-testid="add-wallet-dialog">
        <DialogHeader className="px-6 pt-6 pb-3 text-left">
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Plus size={15} className="text-primary" /> {t("wallet.add.title")}</DialogTitle>
          <DialogDescription className="text-[11px]">{t("wallet.add.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input id="add-wallet-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("wallet.add.search")} aria-label={t("wallet.add.search")}
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary/50" />
          </div>
          <div className="max-h-56 overflow-auto grid grid-cols-3 gap-2" role="listbox" aria-label={t("wallet.add.title")}>
            {currencies === undefined && <div className="col-span-3 text-center text-xs text-muted-foreground py-6">{t("signin.checking")}</div>}
            {currencies !== undefined && available.length === 0 && <div className="col-span-3 text-center text-xs text-muted-foreground py-6">{t("wallet.add.none")}</div>}
            {available.map((c) => (
              <button key={c.code} type="button" role="option" aria-selected={picked === c.code} onClick={() => setPicked(c.code)}
                className={cn("rounded-xl border px-2 py-2 text-xs font-bold cursor-pointer transition-colors",
                  picked === c.code ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary hover:border-primary/40")}>
                {FLAGS[c.code] ?? "💱"} {c.code}
              </button>
            ))}
          </div>
          <button type="button" disabled={!picked || busy || !userId} onClick={() => void create()}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy ? t("signin.checking") : picked ? t("wallet.add.create", { currency: picked }) : t("wallet.add.pick")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
