import { ArrowUpRight, ArrowDownLeft, Send, CreditCard, Repeat, Globe, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet.tsx";
import { useTransfersForWallet } from "@/hooks/use-backend.ts";
import { useTranslation } from "react-i18next";
import { txTypeLabel } from "@/lib/i18n-labels.ts";

export interface WalletSummary {
  id: string | null;
  code: string;
  flag: string;
  balance: string;
}

// Credit vs. debit is inferred from `type` now, rather than the presence of
// a Convex `credited` field — `transfers` (supabase/migrations/0005) doesn't
// carry a separate debited/credited breakdown per row the way Convex's
// `transactions` did. The commission fee is restored via `backend.ts`'s
// `quotes(fee)` join (`AppTransfer.fee`); the old FX-margin figure is not —
// unlike `commission`, it was never stored as a standalone number even in
// `quotes` (only the final `fx_rate` and a text `wholesale_rate_ref` are),
// so showing it would mean re-deriving it client-side from the 10% margin
// rate that's currently a constant inside `create_quote()` in
// 0005_wallet_view_quote_transfer.sql — duplicating that constant here would
// silently drift if the real one ever changes, which is worse than not
// showing the figure.
const CREDIT_TYPES = new Set(["deposit", "convert_in"]);

export default function WalletHistorySheet({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: WalletSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("common");
  const history = useTransfersForWallet(wallet?.id ?? undefined);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>{wallet?.flag}</span>
            <span>{wallet?.code}</span>
            <span className="text-muted-foreground font-normal text-sm">· {wallet?.balance}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-2">
          {!wallet?.id && (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {t("wallethistorysheet.thisIsADemo")}
            </p>
          )}
          {wallet?.id && history === undefined && (
            <p className="text-xs text-muted-foreground py-6 text-center">{t("wallethistorysheet.loadingTransactionHistory")}</p>
          )}
          {wallet?.id && history && history.length === 0 && (
            <p className="text-xs text-muted-foreground py-6 text-center">{t("wallethistorysheet.noTransactionsOnThis")}</p>
          )}
          {history?.map((tx) => {
            const isCredit = CREDIT_TYPES.has(tx.type);
            const icons = { transfer: Send, payment: CreditCard, remittance: Globe, deposit: Plus, convert_out: Repeat, convert_in: Repeat } as const;
            const Icon = icons[tx.type as keyof typeof icons] ?? CreditCard;
            return (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-foreground">
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{txTypeLabel(t, tx.type)} · {tx.reference}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {new Date(tx.createdAt).toLocaleString()} · {tx.state}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isCredit ? (
                    <>
                      <div className="text-sm font-bold text-primary flex items-center gap-1 justify-end">
                        <ArrowDownLeft size={12} /> +{tx.currency} {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      {!!tx.fee && tx.fee > 0 && (
                        <div className="text-[10px] text-muted-foreground">{t("wallethistorysheet.fee")} {tx.currency} {tx.fee.toFixed(2)}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-destructive flex items-center gap-1 justify-end">
                        <ArrowUpRight size={12} /> -{tx.currency} {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      {!!tx.fee && tx.fee > 0 && (
                        <div className="text-[10px] text-muted-foreground">{t("wallethistorysheet.commission")} {tx.currency} {tx.fee.toFixed(2)}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
