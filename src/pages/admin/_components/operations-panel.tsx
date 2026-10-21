import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type {
  OpsCorporateCard, OpsExpenseReport, OpsGameBet, OpsLoyaltyAccount, OpsPitch, OpsTontineMember,
} from "@/lib/backend.ts";
import { useAdminOpsRows, useAdminResolveExpenseReportMutation } from "@/hooks/use-backend.ts";

const who = (name: string | null, email: string | null) => name ?? email ?? "—";
const num = (n: unknown) => Number(n).toLocaleString();

const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

// Factory instead of a generic JSX tag: the app's JSX instrumentation cannot
// parse <Section<T> ...>.
function makeSection<T>({ title, note, rpc, keyOf, render }: {
  title: string; note: string; rpc: string; keyOf: (row: T) => string; render: (row: T) => { primary: string; secondary: string };
}) {
  return function OpsSection() {
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useAdminOpsRows<T>(rpc);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
      <div>
        <div className="text-sm font-bold text-foreground">{t(title)}</div>
        <div className="text-[11px] text-muted-foreground">{t(note)}</div>
      </div>
      {isLoading && <div className="text-xs text-muted-foreground py-2">{t("common.loading")}</div>}
      {error && <div className="text-xs text-destructive py-2">{t("admin.operationspanel.notAvailableForYour")}</div>}
      {data && data.length === 0 && <div className="text-xs text-muted-foreground py-2">{t("admin.operationspanel.nothingToShowYet")}</div>}
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {data?.map((row) => {
          const { primary, secondary } = render(row);
          return (
            <div key={keyOf(row)} className="rounded-lg bg-secondary/30 px-3 py-2">
              <div className="text-xs font-semibold truncate">{primary}</div>
              <div className="text-[10px] text-muted-foreground truncate">{secondary}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
  };
}

function ExpenseReports() {
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useAdminOpsRows<OpsExpenseReport>("admin_list_expense_reports");
  const resolve = useAdminResolveExpenseReportMutation();

  const act = async (r: OpsExpenseReport, status: "approved" | "rejected") => {
    const password = window.prompt(`Enter the admin password to ${status === "approved" ? t("admin.operationspanel.approveReimbursesTheWallet") : "reject"} this report:`);
    if (password === null) return;
    try {
      await resolve({ reportId: r.id, status, password });
      toast.success(status === "approved" ? "Approved and reimbursed" : "Rejected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/^[A-Za-z_]+: /, "") : "Action failed");
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
      <div>
        <div className="text-sm font-bold text-foreground">{t("admin.operationspanel.expenseReports")}</div>
        <div className="text-[11px] text-muted-foreground">{t("admin.operationspanel.everyUserSSubmitted")}</div>
      </div>
      {isLoading && <div className="text-xs text-muted-foreground py-2">{t("common.loading")}</div>}
      {error && <div className="text-xs text-destructive py-2">{t("admin.operationspanel.notAvailableForYour")}</div>}
      {data && data.length === 0 && <div className="text-xs text-muted-foreground py-2">{t("admin.operationspanel.noExpenseReportsYet")}</div>}
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {data?.map((r) => (
          <div key={r.id} className="rounded-lg bg-secondary/30 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{t(r.title)} · {who(r.userName, r.userEmail)}</div>
              <div className="text-[10px] text-muted-foreground">{r.currency} {num(r.amount)} · {r.category}{r.project ? ` · ${r.project}` : ""} · {new Date(r.submittedAt).toLocaleDateString()}</div>
            </div>
            {r.status === "pending" ? (
              <div className="flex gap-1.5">
                <button onClick={() => void act(r, "approved")} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary text-primary-foreground cursor-pointer">{t("modules.approve")}</button>
                <button onClick={() => void act(r, "rejected")} className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-border text-destructive cursor-pointer">{t("admin.escalationspanel.reject")}</button>
              </div>
            ) : (
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS[r.status])}>{r.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const CorporateCards = makeSection<OpsCorporateCard>({
  title: "Corporate cards", note: "Cards issued by organisations, with spend against limit.", rpc: "admin_list_corporate_cards", keyOf: (c) => c.id,
  render: (c) => ({ primary: `${c.holderName} · ${c.role}`, secondary: `${c.currency} ${num(c.spentAmount)} / ${num(c.limitAmount)} · ${who(c.ownerName, c.ownerEmail)}` }),
});
const LoyaltyAccounts = makeSection<OpsLoyaltyAccount>({
  title: "Loyalty accounts", note: "Linked venues, points and cashback per user.", rpc: "admin_list_loyalty_accounts", keyOf: (a) => a.id,
  render: (a) => ({ primary: `${a.venueName} · ${who(a.userName, a.userEmail)}`, secondary: `${num(a.points)} pts · ${a.currency} ${num(a.monthlySpend)} this month · ${a.cashbackRate}% cashback` }),
});
const GameBets = makeSection<OpsGameBet>({
  title: "Game bets", note: "Bets placed and their resolution.", rpc: "admin_list_game_bets", keyOf: (b) => b.id,
  render: (b) => ({ primary: `${b.kind} · ${who(b.userName, b.userEmail)}`, secondary: `${b.currency} ${num(b.stakeAmount)} stake · ${b.status}${b.payoutAmount != null ? ` · payout ${num(b.payoutAmount)}` : ""} · ${new Date(b.placedAt).toLocaleString()}` }),
});
const TontineMembers = makeSection<OpsTontineMember>({
  title: "Tontine members", note: "Who sits in which circle and in what payout position.", rpc: "admin_list_tontine_members", keyOf: (m) => `${m.circleId}-${m.memberPosition}`,
  render: (m) => ({ primary: `${m.circleName} · #${m.memberPosition}`, secondary: `${who(m.userName, m.userEmail)} · ${new Date(m.joinedAt).toLocaleDateString()}` }),
});
const PitchSubmissions = makeSection<OpsPitch>({
  title: "Pitch submissions", note: "Investment pitches submitted by users.", rpc: "admin_list_pitch_submissions", keyOf: (p) => p.id,
  render: (p) => ({ primary: `${p.title} · ${who(p.ownerName, p.ownerEmail)}`, secondary: `${p.category ?? "—"} · ${p.currency} ${num(p.raised)} / ${num(p.goal)} · ${p.risk} risk · ${new Date(p.createdAt).toLocaleDateString()}` }),
});

// Mirrors the ops-console Configuration screen's operations sections so an
// admin sees the same data in both apps (same RPCs, 0021).
export default function OperationsPanel() {
  return (
    <div className="space-y-4 max-w-3xl">
      <ExpenseReports />
      <CorporateCards />
      <LoyaltyAccounts />
      <GameBets />
      <TontineMembers />
      <PitchSubmissions />
    </div>
  );
}
