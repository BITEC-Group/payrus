import { motion } from "motion/react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useCardsForUser, useLinkedPaymentMethods, useRecentTransfersForUser, useWalletViewsForUser } from "@/hooks/use-backend.ts";
import {
  Send, ArrowDownLeft, QrCode, Building2,
  TrendingUp, Shield, Wifi, ChevronRight, Bell,
  Sparkles, Plus, ArrowUpRight, Clock,
  PiggyBank, Users, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getAnonId } from "@/lib/anon-id.ts";
import { PAYMENT_PROVIDERS } from "@/components/ui/add-payment-method-sheet.tsx";
import { useProfile } from "@/contexts/profile-context.tsx";
import type { ProfileType } from "@/contexts/profile-context.tsx";

/* ─── Profile-adaptive data ─────────────────────────────── */

const PROFILE_QUICK_ACTIONS: Partial<Record<ProfileType, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string; path: string }[]>> = {
  group: [
    { label: "dashboard.qa.pensionFund1", icon: Users, gradient: "from-teal-500 to-teal-400", path: "/groups" },
    { label: "dashboard.qa.pensionFund2", icon: PiggyBank, gradient: "from-primary to-emerald-400", path: "/remittance" },
    { label: "dashboard.qa.cooperative3", icon: ArrowUpRight, gradient: "from-accent to-sky-400", path: "/payments" },
    { label: "dashboard.qa.microfinance4", icon: TrendingUp, gradient: "from-violet-500 to-purple-400", path: "/transactions" },
  ],
  treasury: [
    { label: "dashboard.qa.investmentFund1", icon: TrendingUp, gradient: "from-purple-500 to-purple-400", path: "/transactions" },
    { label: "dashboard.qa.investmentFund2", icon: ArrowUpRight, gradient: "from-primary to-emerald-400", path: "/payments" },
    { label: "dashboard.qa.investmentFund3", icon: Send, gradient: "from-accent to-sky-400", path: "/remittance" },
    { label: "dashboard.qa.developmentBank1", icon: Building2, gradient: "from-amber-500 to-yellow-300", path: "/treasury" },
  ],
};

const PROFILE_WIDGETS: Partial<Record<ProfileType, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; sub: string; color: string }[]>> = {
  group: [
    { icon: Users, label: "dashboard.widget.pensionFund1", value: "142,318", sub: "dashboard.widget.pensionFund1Sub", color: "text-teal-700" },
    { icon: PiggyBank, label: "dashboard.widget.pensionFund2", value: "CDF 4.8B", sub: "dashboard.widget.pensionFund2Sub", color: "text-primary" },
    { icon: TrendingUp, label: "dashboard.widget.cooperative3", value: "94.7%", sub: "dashboard.widget.pensionFund3Sub", color: "text-accent" },
  ],
  treasury: [
    { icon: TrendingUp, label: "AUM total", value: "$48.5M", sub: "+6.2% YTD", color: "text-purple-700" },
    { icon: ArrowUpRight, label: "dashboard.widget.investmentFund2", value: "11.4%", sub: "vs benchmark 8.2%", color: "text-primary" },
    { icon: Users, label: "dashboard.widget.investmentFund3", value: "234", sub: "dashboard.widget.investmentFund3Sub", color: "text-accent" },
  ],
};

const PROFILE_INSIGHT: Partial<Record<ProfileType, { title: string; sub: string }>> = {
  group: {
    title: "dashboard.insight.pensionFundTitle",
    sub: "dashboard.insight.pensionFundSub",
  },
  treasury: {
    title: "dashboard.insight.investmentFundTitle",
    sub: "dashboard.insight.investmentFundSub",
  },
};

const PROFILE_TRANSACTIONS: Partial<Record<ProfileType, Array<{ id: number; name: string; type: string; amount: number; currency: string; date: string; icon: string; bg: string }>>> = {
  group: [
    { id: 1, name: "dashboard.tx.pensionFund1", type: "credit", amount: 840000000, currency: "CDF", date: "Aujourd'hui, 09:15", icon: "🏛️", bg: "bg-teal-50" },
    { id: 2, name: "dashboard.tx.pensionFund2", type: "debit", amount: -620000000, currency: "CDF", date: "Aujourd'hui, 08:00", icon: "👴", bg: "bg-primary/15" },
    { id: 3, name: "dashboard.tx.cooperative3", type: "debit", amount: -1500000000, currency: "CDF", date: "Hier", icon: "📈", bg: "bg-accent/15" },
    { id: 4, name: "dashboard.tx.pensionFund4", type: "credit", amount: 12400000, currency: "CDF", date: "Aug 8", icon: "⚡", bg: "bg-amber-50" },
  ],
  treasury: [
    { id: 1, name: "dashboard.tx.investmentFund1", type: "credit", amount: 2850000, currency: "USD", date: "Aujourd'hui, 09:00", icon: "📊", bg: "bg-purple-50" },
    { id: 2, name: "dashboard.tx.investmentFund2", type: "debit", amount: -420000, currency: "USD", date: "Aujourd'hui, 08:00", icon: "💸", bg: "bg-rose-50" },
    { id: 3, name: "dashboard.tx.investmentFund3", type: "debit", amount: -1200000, currency: "USD", date: "Hier", icon: "💰", bg: "bg-primary/15" },
    { id: 4, name: "dashboard.tx.investmentFund4", type: "credit", amount: 184000, currency: "USD", date: "Aug 7", icon: "📱", bg: "bg-accent/15" },
  ],
};


const contacts = [
  { name: "Amara K.", initials: "AK", color: "bg-violet-500" },
  { name: "Oumar D.", initials: "OD", color: "bg-orange-500" },
  { name: "Fatou B.", initials: "FB", color: "bg-cyan-500" },
  { name: "Kofi A.", initials: "KA", color: "bg-rose-500" },
  { name: "Ngozi E.", initials: "NE", color: "bg-emerald-500" },
];

const wallets = [
  { name: "Orange Money", balance: "XAF 48,200", flag: "🍊", color: "bg-orange-50 border-orange-200 text-orange-700" },
  { name: "MTN MoMo", balance: "XAF 12,000", flag: "🟡", color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
  { name: "Unitel Money", balance: "AOA 182,400", flag: "🇦🇴", color: "bg-red-50 border-red-200 text-red-700" },
  { name: "Wave", balance: "XOF 31,500", flag: "🌊", color: "bg-blue-50 border-blue-200 text-blue-700" },
];

// Shown only for anonymous/no-account preview visitors, when there's no real
// per-user card from Convex to show in the sidebar panel.
const DEMO_CARD_SUMMARY = { brand: "Visa", last4: "4821", balance: 12485.50, currency: "USD" };

const spendingData = [
  { month: "Mar", value: 820 }, { month: "Apr", value: 1100 },
  { month: "May", value: 740 }, { month: "Jun", value: 1380 },
  { month: "Jul", value: 960 }, { month: "Aug", value: 1240 },
];

const DEFAULT_TRANSACTIONS = [
  { id: 1, name: "dashboard.tx.default1", type: "debit", amount: -25000, currency: "XAF", date: "Aujourd'hui, 14:32", icon: "🍊", bg: "bg-orange-50" },
  { id: 2, name: "dashboard.tx.default2", type: "credit", amount: 450000, currency: "XAF", date: "Aujourd'hui, 09:00", icon: "💼", bg: "bg-primary/15" },
  { id: 3, name: "dashboard.tx.default3", type: "debit", amount: -8500, currency: "XAF", date: "Hier", icon: "💳", bg: "bg-blue-50" },
  { id: 4, name: "dashboard.tx.default4", type: "debit", amount: -30000, currency: "XAF", date: "Aug 9", icon: "🌍", bg: "bg-accent/15" },
];

// Real transfers (from useRecentTransfersForUser) have no pre-baked
// icon/color/label the way the hardcoded PROFILE_TRANSACTIONS/
// DEFAULT_TRANSACTIONS arrays do — derived here the same way
// wallet-history-sheet.tsx derives them for its own transfer rows.
const REAL_TX_CREDIT_TYPES = new Set(["deposit", "convert_in"]);
const REAL_TX_ICON: Record<string, string> = { transfer: "↔️", payment: "💳", deposit: "➕", remittance: "🌍", convert_out: "🔁", convert_in: "🔁" };
const REAL_TX_BG: Record<string, string> = { transfer: "bg-accent/15", payment: "bg-blue-50", deposit: "bg-primary/15", remittance: "bg-accent/15", convert_out: "bg-violet-50", convert_in: "bg-violet-50" };
const REAL_TX_LABEL: Record<string, string> = { transfer: "Transfer", payment: "Payment", deposit: "Deposit", remittance: "Remittance", convert_out: "Conversion out", convert_in: "Conversion in" };

interface TooltipProps { active?: boolean; payload?: Array<{ value: number }>; label?: string; }
function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground font-mono">${payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const { lng } = useParams<{ lng: string }>();
  const { t } = useTranslation("common");
  const { profile } = useProfile();
  const navigate = useNavigate();
  const base = `/${lng ?? "en"}`;

  const profileType = profile?.type ?? "personal";
  const isFinancialInstitution = (["treasury","group"] as ProfileType[]).includes(profileType);

  // Real per-user financial data when signed in; anonymous/no-account
  // preview visitors keep today's shared demo arrays — each query is scoped
  // by userId via a Convex index, so results can never cross between users.
  const currentUser = useCurrentAppUser();
  const realWallets = useWalletViewsForUser(currentUser?.id);
  const realCards = useCardsForUser(currentUser?.id);
  const realRecentTransfers = useRecentTransfersForUser(currentUser?.id, 4);
  const primaryCard = realCards && realCards.length > 0 ? realCards[0] : null;
  const linkedMethods = useLinkedPaymentMethods(getAnonId());
  const walletsToShow = realWallets && realWallets.length > 0
    ? realWallets.map(w => ({ name: w.provider, balance: `${w.currency} ${w.balance.toLocaleString()}`, flag: w.flag, color: w.colorClass, currency: w.currency as string | undefined }))
    : wallets;

  // Format balance for display — compact for very large numbers
  const formatBalance = (n: number, currency: string) => {
    if (n >= 1_000_000_000) return `${currency} ${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(3).replace(/\.?0+$/, "")}M`;
    return `${currency} ${n.toLocaleString()}`;
  };

  const displayBalance = profile
    ? formatBalance(profile.balance, profile.currency)
    : "XAF 7,303,000";

  const displayUSD = profile
    ? `≈ $${profile.balanceUSD.toLocaleString()} USD · •••• ${profile.accountNumber}`
    : "≈ $12,149 USD · •••• 4821";

  const displayName = profile?.name ?? "Jean Dupont";
  const displayTier = profile?.tier ?? "Premium ✦";

  // Real recent activity when signed in with real transfers; anonymous/
  // no-activity-yet visitors keep the existing profile-adaptive mock feed.
  const recentTransactions = realRecentTransfers && realRecentTransfers.length > 0
    ? realRecentTransfers.map((tr) => ({
        id: tr.id,
        name: REAL_TX_LABEL[tr.type] ?? tr.type,
        type: REAL_TX_CREDIT_TYPES.has(tr.type) ? "credit" : "debit",
        amount: REAL_TX_CREDIT_TYPES.has(tr.type) ? tr.amount : -tr.amount,
        currency: tr.currency,
        date: new Date(tr.createdAt).toLocaleString(),
        icon: REAL_TX_ICON[tr.type] ?? "💳",
        bg: REAL_TX_BG[tr.type] ?? "bg-secondary",
      }))
    : (PROFILE_TRANSACTIONS[profileType] ?? DEFAULT_TRANSACTIONS);

  // Profile-adaptive quick actions
  const defaultQuickActions = [
    { label: "quick.send", icon: Send, gradient: "from-primary to-emerald-400", to: `${base}/remittance` },
    { label: "quick.pay", icon: ArrowUpRight, gradient: "from-accent to-sky-400", to: `${base}/payments` },
    { label: "quick.qrPay", icon: QrCode, gradient: "from-violet-500 to-purple-400", to: `${base}/payments` },
    { label: "quick.request", icon: ArrowDownLeft, gradient: "from-amber-500 to-yellow-300", to: `${base}/payments` },
  ];
  const profileQuickActions = PROFILE_QUICK_ACTIONS[profileType];
  const quickActions = profileQuickActions
    ? profileQuickActions.map(a => ({ ...a, to: `${base}${a.path}` }))
    : defaultQuickActions;

  // KPIs for financial institution profiles
  const profileWidgets = PROFILE_WIDGETS[profileType];

  // Insight
  const profileInsight = PROFILE_INSIGHT[profileType];

  const stats = [
    { label: t("stats.sent"), value: "XAF 726k", change: "+12%", up: true },
    { label: t("stats.fxSavings"), value: "XAF 22,500", change: "+5%", up: true },
    { label: t("stats.pending"), value: "XAF 51k", change: "2 txns", up: false },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">{t("dashboard.greeting")}</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{displayName}</h1>
        </div>
        <div className="relative">
          <button
            onClick={() => navigate(`${base}/notifications`)}
            className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors">
            <Bell size={16} className="text-muted-foreground" />
          </button>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[9px] text-white font-bold flex items-center justify-center">3</span>
        </div>
      </motion.div>

      {/* Main balance card */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, delay: 0.04 }}
        className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#f8fbff_0%,#edf4fa_100%)] border border-[#d8e5f0] shadow-[0_18px_40px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-white/70">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-transparent to-accent/4 pointer-events-none" />
        <div className="relative p-5 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <Wifi size={12} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">{t("dashboard.account")}</span>
            <div className="text-[10px] text-primary truncate font-medium">{displayTier}</div>
            <div className="ml-auto flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
              <Shield size={9} className="text-primary" />
              <span className="text-[10px] text-primary font-semibold">{t("dashboard.verified")}</span>
            </div>
          </div>
          <div className="text-4xl md:text-[2.5rem] font-black text-foreground font-mono tracking-tight">{displayBalance}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{displayUSD}</div>
        </div>
        <div className="px-2 pt-1 pb-0">
          <ResponsiveContainer width="100%" height={68}>
            <AreaChart data={spendingData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.62 0.19 155)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="oklch(0.62 0.19 155)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="value" stroke="oklch(0.62 0.19 155)" strokeWidth={2} fill="url(#sg)"
                dot={false} activeDot={{ r: 3, fill: "oklch(0.62 0.19 155)", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-[#d8e5f0] bg-white/60 backdrop-blur-[2px]">
          {stats.map((s) => (
            <div key={s.label} className="px-4 py-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className="text-sm font-bold text-foreground mt-0.5 font-mono">{s.value}</div>
              <div className={cn("text-[10px] mt-0.5 flex items-center gap-0.5", s.up ? "text-primary" : "text-muted-foreground")}>
                {s.up && <TrendingUp size={9} />}{s.change}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {quickActions.map((a, i) => (
          <motion.div key={a.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.04 }}>
            <Link to={a.to} className="flex flex-col items-center gap-2.5 group cursor-pointer rounded-2xl border border-border bg-card/80 p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
              <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/20", a.gradient)}>
                <a.icon size={19} className="text-white" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium text-center group-hover:text-foreground transition-colors">{t(a.label)}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Financial institution KPI widgets */}
      {isFinancialInstitution && profileWidgets && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="grid grid-cols-3 gap-3">
          {profileWidgets.map((w) => (
            <div key={w.label} className="rounded-2xl bg-card border border-border p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <w.icon size={13} className={w.color} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{t(w.label)}</span>
              </div>
              <div className={cn("text-lg font-bold font-mono", w.color)}>{w.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t(w.sub)}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Mobile wallets — hide for financial institutions */}
      {!isFinancialInstitution && (
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-4 lg:items-start">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-semibold text-foreground">{t("dashboard.mobileWallets")}</h2>
              <button type="button" onClick={() => navigate(`/${lng}/settings`, { state: { section: "payments" } })} className="text-[11px] text-primary flex items-center gap-1 cursor-pointer hover:underline">
                <Plus size={11} /> {t("dashboard.linkWallet")}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {walletsToShow.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => navigate(`${base}/wallet${(w as { currency?: string }).currency ? `?currency=${(w as { currency?: string }).currency}` : ""}`)}
                  className={cn("shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer hover:opacity-80 transition-opacity text-left", w.color)}
                >
                  <span className="text-lg leading-none">{w.flag}</span>
                  <div>
                    <div className="text-[10px] font-medium opacity-70">{w.name}</div>
                    <div className="text-xs font-bold font-mono">{w.balance}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Card + linked-channels panel — desktop only */}
          <div className="hidden lg:flex lg:flex-col lg:gap-3 mt-4 lg:mt-0">
            <Link to={`${base}/cards`} className="block rounded-2xl border border-border bg-card p-3.5 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard size={13} className="text-primary" /> {t("dashboard.yourCard")}
                </span>
                <ChevronRight size={12} className="text-muted-foreground" />
              </div>
              {primaryCard ? (
                <>
                  <div className="text-sm font-bold text-foreground">{primaryCard.brand} •••• {primaryCard.last4}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{primaryCard.currency} {primaryCard.balance.toLocaleString()}</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-foreground">{DEMO_CARD_SUMMARY.brand} •••• {DEMO_CARD_SUMMARY.last4}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{DEMO_CARD_SUMMARY.currency} {DEMO_CARD_SUMMARY.balance.toLocaleString()}</div>
                </>
              )}
            </Link>

            <div className="rounded-2xl border border-border bg-card p-3.5">
              <span className="text-[11px] font-semibold text-foreground block mb-2">{t("dashboard.channels")}</span>
              <div className="space-y-1.5">
                {(linkedMethods ?? []).slice(0, 3).map((m) => {
                  const Icon = PAYMENT_PROVIDERS.find(p => p.id === m.provider)?.icon ?? CreditCard;
                  return (
                    <div key={m.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon size={13} className="text-foreground shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </div>
                  );
                })}
                {(!linkedMethods || linkedMethods.length === 0) && (
                  <p className="text-[11px] text-muted-foreground">{t("dashboard.noChannelsYet")}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contacts */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-foreground">{t("dashboard.sendAgain")}</h2>
          <Link to={`${base}/remittance`} className="text-[11px] text-primary flex items-center gap-1 hover:underline cursor-pointer">
            {t("dashboard.seeAll")} <ChevronRight size={11} />
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {contacts.map((c, i) => (
            <motion.button key={c.name} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.04 }}
              onClick={() => navigate(`${base}/p2p`)}
              className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0">
              <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary/50", c.color)}>
                {c.initials}
              </div>
              <span className="text-[10px] text-muted-foreground font-medium group-hover:text-foreground transition-colors whitespace-nowrap">{c.name.split(" ")[0]}</span>
            </motion.button>
          ))}
          <motion.button initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + contacts.length * 0.04 }}
            onClick={() => navigate(`${base}/p2p`)}
            className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0">
            <div className="w-11 h-11 rounded-full border-2 border-dashed border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
              <Plus size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{t("dashboard.new")}</span>
          </motion.button>
        </div>
      </div>

      {/* AI / Profile insight */}
      <motion.button type="button" onClick={() => navigate(profileInsight ? `${base}/modules` : `${base}/savings`)}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-[linear-gradient(135deg,rgba(10,47,92,0.05),rgba(14,127,176,0.04))] border border-primary/15 cursor-pointer hover:bg-primary/8 transition-colors shadow-sm text-left">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground">
            {profileInsight ? t(profileInsight.title) : t("dashboard.insightTitle")}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {profileInsight ? t(profileInsight.sub) : t("dashboard.insightSub")}
          </div>
        </div>
        <ChevronRight size={13} className="text-muted-foreground shrink-0" />
      </motion.button>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-foreground">{t("dashboard.recentActivity")}</h2>
          <Link to={`${base}/transactions`} className="text-[11px] text-primary flex items-center gap-1 hover:underline cursor-pointer">
            {t("dashboard.viewAll")} <ChevronRight size={11} />
          </Link>
        </div>
        <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
          {recentTransactions.map((tx, i) => (
            <motion.button key={tx.id} type="button" onClick={() => navigate(`${base}/transactions`)}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.28 + i * 0.04 }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors cursor-pointer text-left">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0", tx.bg)}>
                {tx.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{t(tx.name)}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock size={9} className="text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{tx.date.replace(/^Aujourd'hui/, t("common.today")).replace(/^Hier$/, t("common.yesterday"))}</span>
                </div>
              </div>
              <div className={cn("text-sm font-bold font-mono tabular-nums text-right", tx.amount > 0 ? "text-primary" : "text-foreground")}>
                {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                <div className="text-[10px] font-normal text-muted-foreground">{tx.currency}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Agent banking promo */}
      <motion.button type="button" onClick={() => navigate(`${base}/profile`)}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="relative w-full overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#f8fbff_0%,#edf4fa_100%)] border border-border p-4 cursor-pointer hover:border-primary/30 transition-colors shadow-sm text-left">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/4 to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">{t("dashboard.agentTitle")}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{t("dashboard.agentSub")}</div>
          </div>
          <ChevronRight size={15} className="text-muted-foreground shrink-0" />
        </div>
      </motion.button>

    </div>
  );
}
