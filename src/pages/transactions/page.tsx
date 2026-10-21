import { useState } from "react";
import { localizeTransferNote } from "@/lib/db-notifications.ts";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Search, ArrowUpRight, ArrowDownLeft, Send, CreditCard, Globe, Plus, Repeat, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/ui/page-header.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useRecentTransfersForUser } from "@/hooks/use-backend.ts";
import type { AppTransfer } from "@/lib/backend.ts";

// A transfer counts as money coming IN for the currently signed-in user —
// same convention Index.tsx's dashboard "Recent activity" list already
// uses for the identical real transfers table.
const CREDIT_TX_TYPES = new Set(["deposit", "convert_in"]);
const TYPE_ICONS: Record<AppTransfer["type"], typeof Send> = {
  transfer: Send, payment: CreditCard, remittance: Globe, deposit: Plus, convert_out: Repeat, convert_in: Repeat,
};

export default function Transactions() {
  const { t } = useTranslation("common");
  const { lng } = useParams<{ lng: string }>();
  const currentUser = useCurrentAppUser();
  // 200, not the hook's default 10 — this page is the full history view,
  // Index.tsx's dashboard is the "recent 5" summary.
  const transfers = useRecentTransfersForUser(currentUser?.id, 200);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const typeLabels: Record<AppTransfer["type"], string> = {
    transfer: t("filter.transfer"), payment: t("filter.payment"), remittance: t("filter.remittance"),
    deposit: t("transactions.deposit"), convert_out: t("transactions.convertOut"), convert_in: t("transactions.convertIn"),
  };

  const filters = [
    { key: "All", label: t("filter.all") },
    { key: "Credit", label: t("filter.credit") },
    { key: "Debit", label: t("filter.debit") },
    { key: "Transfer", label: t("filter.transfer") },
    { key: "Payment", label: t("filter.payment") },
    { key: "Remittance", label: t("filter.remittance") },
  ];

  const all = transfers ?? [];
  const filtered = all.filter((tx) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || tx.reference.toLowerCase().includes(q) || (tx.note ?? "").toLowerCase().includes(q);
    const isCredit = CREDIT_TX_TYPES.has(tx.type);
    const matchFilter = activeFilter === "All" ||
      (activeFilter === "Credit" && isCredit) ||
      (activeFilter === "Debit" && !isCredit) ||
      (activeFilter === "Transfer" && tx.type === "transfer") ||
      (activeFilter === "Payment" && tx.type === "payment") ||
      (activeFilter === "Remittance" && tx.type === "remittance");
    return matchSearch && matchFilter;
  });

  // Totals are shown in the user's default currency only — same
  // single-currency-display convention Index.tsx's dashboard already uses
  // for a user who holds several currency wallets, rather than nonsensically
  // adding different currencies together.
  const displayCurrency = currentUser?.transactionCurrency ?? "USD";
  const sameCurrency = all.filter((tx) => tx.currency === displayCurrency);
  const totalIn = sameCurrency.filter((tx) => CREDIT_TX_TYPES.has(tx.type)).reduce((s, tx) => s + tx.amount, 0);
  const totalOut = sameCurrency.filter((tx) => !CREDIT_TX_TYPES.has(tx.type)).reduce((s, tx) => s + tx.amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title={t("transactions.title")} subtitle={t("transactions.subtitle")} className="mb-4 md:mb-6" />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownLeft size={15} className="text-primary" />
            <span className="text-xs text-muted-foreground">{t("transactions.totalIn")}</span>
          </div>
          <div className="text-lg font-bold font-mono text-primary">+{totalIn.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{displayCurrency}</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight size={15} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t("transactions.totalOut")}</span>
          </div>
          <div className="text-lg font-bold font-mono text-foreground">{totalOut.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{displayCurrency}</div>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("transactions.searchPlaceholder")} className="pl-9 bg-card border-border" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
              activeFilter === f.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {transfers === undefined && (
          <div className="text-center py-12 text-muted-foreground text-sm">{t("transactions.loading")}</div>
        )}
        {transfers !== undefined && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">{t("transactions.noResults")}</div>
        )}
        {filtered.map((tx, i) => {
          const isCredit = CREDIT_TX_TYPES.has(tx.type);
          const Icon = isCredit ? ArrowDownLeft : (TYPE_ICONS[tx.type] ?? Send);
          return (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <Link
                to={`/${lng}/transactions/${encodeURIComponent(tx.reference)}`}
                aria-label={t("txd.open", { ref: tx.reference })}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 focus-visible:border-primary transition-colors cursor-pointer"
              >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                isCredit ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
              )}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{tx.note ? localizeTransferNote(tx.note, t) : (typeLabels[tx.type] || tx.type)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{new Date(tx.createdAt).toLocaleString()}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-secondary text-xs">{typeLabels[tx.type] ?? tx.type}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={cn("text-sm font-bold font-mono", isCredit ? "text-primary" : "text-foreground")}>
                  {isCredit ? "+" : "-"}{tx.amount.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">{tx.currency}</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
