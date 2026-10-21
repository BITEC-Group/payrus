import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { AdminTransfer } from "@/lib/backend.ts";
import EscalateForm from "./escalate-form.tsx";
import {
  useAdminListTransfers, useAdminListUsers, useMyPermissions, useSupportCompleteTransferMutation, useSupportResolveTransferMutation,
  useSupportVoidTransferMutation, useSupportCreateAdjustmentMutation,
} from "@/hooks/use-backend.ts";

const STATE_STYLE: Record<string, string> = {
  paid: "bg-primary/10 text-primary",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-destructive/10 text-destructive",
  disputed: "bg-destructive/10 text-destructive",
  refund_pending: "bg-amber-100 text-amber-700",
};

const COMPLETABLE = ["pending", "failed", "submitted", "confirming", "partner_accepted"];
const REFUNDABLE = ["disputed", "refund_pending", "reversed"];
const VOIDABLE = ["draft", "quoted"];

// Real ledger across every user (admin_list_transfers). Which action buttons
// show — and which the database accepts — follows the caller's CRUD matrix
// (my_permissions): read = list, update = complete/resolve/refund,
// delete = void an unexecuted transaction, create = adjustment credit.
export default function TransactionsPanel() {
  const { t } = useTranslation("common");
  const [callerId, setCallerId] = useState<string>("");
  const users = useAdminListUsers();
  const { data, isLoading, error } = useAdminListTransfers(300, callerId || undefined);
  const perms = useMyPermissions();
  const [escalateFor, setEscalateFor] = useState<AdminTransfer | null>(null);
  const complete = useSupportCompleteTransferMutation();
  const resolve = useSupportResolveTransferMutation();
  const voidTransfer = useSupportVoidTransferMutation();
  const adjust = useSupportCreateAdjustmentMutation();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const canUpdate = perms?.transactions.update ?? false;
  const canDelete = perms?.transactions.delete ?? false;
  const canCreate = perms?.transactions.create ?? false;

  const run = async (tItem: AdminTransfer, action: () => Promise<void>, ok: string) => {
    setBusyId(tItem.id);
    try {
      await action();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/^[A-Za-z]+: /, "") : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const askNote = (label: string) => window.prompt(label) ?? null;

  const handleComplete = (tItem: AdminTransfer) => {
    const note = askNote(t("Note for the user and audit log (optional):"));
    if (note === null) return;
    void run(tItem, () => complete({ transferId: tItem.id, note: note || undefined }), t("Transaction completed"));
  };
  const handleResolve = (tItem: AdminTransfer, newState: "resolved" | "refunded") => {
    const note = askNote(newState === "refunded" ? "Refund reason (credits the user's wallet):" : "Resolution note:");
    if (note === null) return;
    void run(tItem, () => resolve({ transferId: tItem.id, newState, note: note || undefined }), newState === "refunded" ? "Refunded" : "Dispute closed");
  };
  const handleVoid = (tItem: AdminTransfer) => {
    const note = askNote(t("Reason for voiding this unexecuted transaction (required):"));
    if (!note) return;
    const password = window.prompt(t("Voiding is superadmin-only. Enter the admin password:"));
    if (password === null) return;
    void run(tItem, () => voidTransfer({ transferId: tItem.id, note, password }), t("Transaction voided"));
  };
  const handleAdjust = (tItem: AdminTransfer) => {
    const amountText = window.prompt(`Adjustment credit for ${tItem.userName ?? tItem.userEmail ?? "user"} (${tItem.currency}):`);
    if (!amountText) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("admin.transactionspanel.enterAPositiveAmount"));
      return;
    }
    const reason = window.prompt(t("Reason (required):"));
    if (!reason) return;
    void run(tItem, () => adjust({ userId: tItem.userId, amount, currency: tItem.currency, reason }), t("Adjustment credited"));
  };

  const q = search.trim().toLowerCase();
  const rows = (data ?? []).filter((tItem) =>
    !q ||
    tItem.reference.toLowerCase().includes(q) ||
    tItem.type.toLowerCase().includes(q) ||
    tItem.state.toLowerCase().includes(q) ||
    tItem.currency.toLowerCase().includes(q) ||
    (tItem.userName ?? "").toLowerCase().includes(q) ||
    (tItem.userEmail ?? "").toLowerCase().includes(q) ||
    (tItem.note ?? "").toLowerCase().includes(q),
  );

  const btn = "text-[10px] font-semibold px-2 py-1 rounded-lg border border-border hover:bg-secondary cursor-pointer disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-semibold uppercase text-muted-foreground shrink-0" htmlFor="caller-select">{t("admin.transactionspanel.caller")}</label>
        <select id="caller-select" value={callerId} onChange={(e) => setCallerId(e.target.value)} className="flex-1 rounded-xl border border-border bg-card px-2 py-2 text-xs">
          <option value="">{t("admin.transactionspanel.allUsers")}</option>
          {(users ?? []).map((row) => (
            <option key={row.user.id} value={row.user.id}>{row.user.name ?? row.user.email ?? row.user.id}{row.user.email ? ` (${row.user.email})` : ""}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.transactionspanel.searchByReferenceUser")}
          className="w-full rounded-xl border border-border bg-card pl-8 pr-3 py-2 text-xs"
        />
      </div>

      {isLoading && <div className="text-xs text-muted-foreground text-center py-8">{t("admin.transactionspanel.loadingTransactions")}</div>}
      {error && <div className="text-xs text-destructive text-center py-8">{t("admin.transactionspanel.couldNotLoadTransactions")}</div>}
      {data && rows.length === 0 && <div className="text-xs text-muted-foreground text-center py-8">{t("admin.transactionspanel.noTransactionsMatch")}</div>}

      {rows.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-[10px] text-muted-foreground">{t("admin.transactionspanel.ofShownLatest300", { shown: rows.length, total: data?.length })}</div>
          <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
            {rows.map((tItem) => (
              <div key={tItem.id} className="px-4 py-3 hover:bg-secondary/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold truncate">{tItem.reference}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{tItem.userName ?? "-"} · {tItem.userEmail ?? t("admin.userspanel.noEmail")}</div>
                    <div className="text-[10px] text-muted-foreground/70 truncate">{tItem.type}{tItem.note ? ` · ${tItem.note}` : ""} · {new Date(tItem.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold font-mono">{tItem.amount.toLocaleString()} {tItem.currency}</div>
                    <span className={cn("inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", STATE_STYLE[tItem.state] ?? "bg-secondary text-muted-foreground")}>
                      {tItem.state.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {canUpdate && COMPLETABLE.includes(tItem.state) && (
                    <button className={btn} disabled={busyId === tItem.id} onClick={() => handleComplete(tItem)}>{t("admin.transactionspanel.complete")}</button>
                  )}
                  {canUpdate && tItem.state === "disputed" && (
                    <button className={btn} disabled={busyId === tItem.id} onClick={() => handleResolve(tItem, "resolved")}>{t("admin.transactionspanel.closeDispute")}</button>
                  )}
                  {canUpdate && REFUNDABLE.includes(tItem.state) && (
                    <button className={btn} disabled={busyId === tItem.id} onClick={() => handleResolve(tItem, "refunded")}>{t("filter.refund")}</button>
                  )}
                  {canDelete && VOIDABLE.includes(tItem.state) && (
                    <button className={cn(btn, "text-destructive")} disabled={busyId === tItem.id} onClick={() => handleVoid(tItem)}>{t("admin.transactionspanel.void")}</button>
                  )}
                  {canCreate && (
                    <button className={btn} disabled={busyId === tItem.id} onClick={() => handleAdjust(tItem)}>{t("admin.transactionspanel.creditUser")}</button>
                  )}
                  <button className={btn} onClick={() => setEscalateFor(escalateFor?.id === tItem.id ? null : tItem)}>{t("organisation.organisationpanel.escalate")}</button>
                </div>
                {escalateFor?.id === tItem.id && (
                  <EscalateForm
                    userId={tItem.userId}
                    userLabel={tItem.userName ?? tItem.userEmail ?? tItem.userId}
                    transferId={tItem.id}
                    transferReference={tItem.reference}
                    currency={tItem.currency}
                    onDone={() => setEscalateFor(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
