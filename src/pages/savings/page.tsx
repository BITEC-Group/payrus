import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  PiggyBank, Target, Users, TrendingUp, Plus, ChevronRight,
  Sparkles, Coins, Landmark, BarChart3, Star, ArrowUpRight,
  Calendar, Shield, Zap, Globe, Check, Clock, Leaf,
  Trophy, Flame, Heart, BookOpen, Briefcase, Home, GraduationCap,
  X, ChevronDown, UtensilsCrossed, Wine, Music2, Hotel,
  Plane, Car, Coffee, Receipt, CheckCircle, AlertCircle,
  Building2, CreditCard, MapPin, ChevronUp, Wallet, Gift,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useProfile } from "@/contexts/profile-context.tsx";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import EditLimitDialog from "./edit-limit-dialog.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import {
  useContributeToPotMutation, useContributeToTontineMutation, useCreateSavingsPotMutation, useInvestInProductMutation,
  useInvestmentProducts, useJoinTontineMutation, useSavingsPotsForUser, useTontineCircles, useCreateTontineCircleMutation,
  useLoyaltyAccountsForUser, useLinkLoyaltyVenueMutation, useRecordVenueSpendMutation, useRedeemLoyaltyRewardMutation, useLoyaltySpendHistory,
  useExpenseReportsForUser, useSubmitExpenseReportMutation, useCorporateCardsForUser, useCreateCorporateCardMutation,
} from "@/hooks/use-backend.ts";
import type {
  AppInvestmentProduct, AppSavingsPot, AppTontineCircle, AppLoyaltyAccount, AppExpenseReport, AppCorporateCard,
} from "@/lib/backend.ts";

/* ─── Types ─────────────────────────────────────────────────── */

type SavingsPotCategory = "education" | "business" | "home" | "emergency" | "travel" | "health" | "agriculture" | "custom";

interface SavingsPot {
  id: string;
  name: string;
  category: SavingsPotCategory;
  target: number;
  current: number;
  currency: string;
  monthlyContrib: number;
  interestRate: number;
  dueDate: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface TontineCircle {
  id: string;
  name: string;
  members: number;
  potAmount: number;
  currency: string;
  frequency: "weekly" | "monthly";
  myContrib: number;
  nextPayout: string;
  nextRecipient: string;
  myTurn: string;
  round: number;
  totalRounds: number;
  color: string;
}

interface InvestmentProduct {
  id: string;
  name: string;
  type: "fixed_term" | "money_market" | "bond" | "micro_equity";
  description: string;
  apy: number;
  minAmount: number;
  currency: string;
  duration: string;
  risk: "low" | "medium" | "high";
  flag: string;
  color: string;
  badge?: string;
}

/* ─── Data ───────────────────────────────────────────────────── */

const POT_ICONS: Record<SavingsPotCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  education: GraduationCap, business: Briefcase, home: Home,
  emergency: Shield, travel: Globe, health: Heart,
  agriculture: Leaf, custom: Star,
};

const MY_POTS: SavingsPot[] = [
  { id: "1", name: "savings.pot.kids", category: "education", target: 500000, current: 312000, currency: "XAF", monthlyContrib: 25000, interestRate: 4.5, dueDate: "Sep 2026", color: "from-violet-500 to-purple-400", icon: GraduationCap },
  { id: "2", name: "savings.pot.business", category: "business", target: 1500000, current: 480000, currency: "XAF", monthlyContrib: 50000, interestRate: 5.2, dueDate: "Mar 2027", color: "from-primary to-emerald-400", icon: Briefcase },
  { id: "3", name: "savings.pot.emergency", category: "emergency", target: 300000, current: 300000, currency: "XAF", monthlyContrib: 0, interestRate: 3.8, dueDate: "Ongoing", color: "from-amber-500 to-yellow-400", icon: Shield },
  { id: "4", name: "savings.pot.cornField", category: "agriculture", target: 800000, current: 155000, currency: "XAF", monthlyContrib: 40000, interestRate: 6.0, dueDate: "Dec 2026", color: "from-lime-500 to-green-400", icon: Leaf },
];

const TONTINES: TontineCircle[] = [
  { id: "1", name: "savings.tontine.kivu", members: 12, potAmount: 1200000, currency: "XAF", frequency: "monthly", myContrib: 100000, nextPayout: "1 Sep 2026", nextRecipient: "Fatou B.", myTurn: "Nov 2026", round: 4, totalRounds: 12, color: "bg-rose-50 border-rose-200 text-rose-700" },
  { id: "2", name: "Njangi Douala Sud", members: 8, potAmount: 400000, currency: "XAF", frequency: "weekly", myContrib: 50000, nextPayout: "16 Aug 2026", nextRecipient: "You 🎉", myTurn: "16 Aug 2026", round: 6, totalRounds: 8, color: "bg-primary/15 border-primary/25 text-primary" },
  { id: "3", name: "savings.tontine.bukavu", members: 20, potAmount: 4000000, currency: "CDF", frequency: "monthly", myContrib: 200000, nextPayout: "1 Oct 2026", nextRecipient: "Mwana S.", myTurn: "Jan 2027", round: 2, totalRounds: 20, color: "bg-accent/15 border-accent/25 text-accent" },
];

const INVESTMENT_PRODUCTS: InvestmentProduct[] = [
  { id: "1", name: "savings.product.savingsPlus", type: "money_market", description: "Flexible savings, withdraw anytime. Daily interest.", apy: 6.5, minAmount: 5000, currency: "XAF", duration: "Flexible", risk: "low", flag: "🌍", color: "from-primary to-emerald-400", badge: "Most Popular" },
  { id: "2", name: "savings.product.beacBond", type: "fixed_term", description: "BEAC-issued 90-day treasury note. Capital guaranteed.", apy: 9.2, minAmount: 50000, currency: "XAF", duration: "90 days", risk: "low", flag: "🇨🇲", color: "from-amber-500 to-yellow-400", badge: "Capital Guaranteed" },
  { id: "3", name: "savings.product.africaBond", type: "bond", description: "Diversified African sovereign bond portfolio.", apy: 11.4, minAmount: 100000, currency: "XAF", duration: "12 months", risk: "medium", flag: "🌍", color: "from-accent to-sky-400" },
  { id: "4", name: "savings.product.fixedDepositCdf", type: "fixed_term", description: "Fixed 6-month deposit in Congolese francs.", apy: 14.0, minAmount: 200000, currency: "CDF", duration: "6 months", risk: "low", flag: "🇨🇩", color: "from-violet-500 to-purple-400" },
  { id: "5", name: "savings.product.microEquity", type: "micro_equity", description: "Fund farmer cooperatives. Returns tied to harvest.", apy: 18.5, minAmount: 25000, currency: "XAF", duration: "Season", risk: "high", flag: "🌱", color: "from-lime-500 to-green-400", badge: "Impact Investing" },
  { id: "6", name: "PayRus Gold Reserve", type: "fixed_term", description: "Gold-indexed savings product. Hedge against inflation.", apy: 12.8, minAmount: 500000, currency: "XAF", duration: "12 months", risk: "medium", flag: "🥇", color: "from-yellow-500 to-amber-300" },
];

// Real pots/circles/products (supabase/migrations/0018) map into the same
// local interfaces the existing rich UI already renders — real rows don't
// carry a specific icon/gradient/flag, so a generic default is used, same
// pattern as the other Phase 3 pages' toDisplayX() mappers.
function toDisplayPot(p: AppSavingsPot): SavingsPot {
  const category = (["education", "business", "home", "emergency", "travel", "health", "agriculture"].includes(p.category ?? "") ? p.category : "custom") as SavingsPotCategory;
  return {
    id: p.id, name: p.name, category, target: p.targetAmount, current: p.currentAmount, currency: p.currency,
    monthlyContrib: p.monthlyContrib, interestRate: p.interestRate, dueDate: p.dueDate ?? "Ongoing",
    color: "from-primary to-emerald-400", icon: POT_ICONS[category],
  };
}

// nextRecipient/myTurn stay "—" for real circles — who's at a given
// rotation position is only owner-readable (tontine_members' RLS policy),
// an intentional privacy boundary, not a gap. nextPayout is real: 0020's
// process_due_tontine_payouts settles automatically once it passes.
function toDisplayTontine(c: AppTontineCircle, myContrib: number): TontineCircle {
  return {
    id: c.id, name: c.name, members: 1, potAmount: c.potAmount, currency: c.currency, frequency: c.frequency as "weekly" | "monthly",
    myContrib, nextPayout: c.nextPayoutDate ?? "—", nextRecipient: "—", myTurn: "—", round: c.currentRound, totalRounds: c.totalRounds,
    color: "bg-primary/15 border-primary/25 text-primary",
  };
}

function toDisplayProduct(p: AppInvestmentProduct): InvestmentProduct {
  return {
    id: p.id, name: p.name, type: "fixed_term", description: p.description ?? "", apy: p.apy, minAmount: p.minAmount,
    currency: p.currency, duration: p.duration ?? "", risk: p.risk, flag: "💰", color: "from-primary to-emerald-400",
  };
}

const LOYALTY_REWARD_TEMPLATE = [
  { label: "savings.reward.smallPerk", points: 1000, icon: Gift },
  { label: "savings.reward.mediumPerk", points: 3000, icon: Star },
  { label: "savings.reward.bigPerk", points: 8000, icon: Trophy },
];

// Real loyalty accounts (0019) don't carry a specific emoji/gradient/
// reward catalog/spend-history — generic defaults, same toDisplayX()
// pattern. The month-by-month spend chart stays flat/decorative for real
// accounts: only a running `monthlySpend` counter exists, not
// month-bucketed history.
function toDisplayLoyaltyPot(a: AppLoyaltyAccount): LoyaltyPot {
  const category = (["restaurant", "bar", "club", "pub", "hotel", "cafe"].includes(a.venueCategory) ? a.venueCategory : "restaurant") as VenueCategory;
  return {
    id: a.id, venueName: a.venueName, venueCategory: category, points: a.points, pointsValue: a.pointsValue,
    currency: a.currency, monthlySpend: a.monthlySpend, spendLimit: a.spendLimit, cashbackRate: a.cashbackRate,
    nextReward: Math.max(1000, Math.ceil((a.points + 1) / 1000) * 1000), color: "from-primary to-emerald-400", emoji: "🏪",
    rewardOptions: LOYALTY_REWARD_TEMPLATE,
    monthHistory: [{ m: "This month", spend: a.monthlySpend }],
  };
}

function toDisplayExpense(e: AppExpenseReport): ExpenseReport {
  return {
    id: e.id, title: e.title, date: new Date(e.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    amount: e.amount, currency: e.currency, category: (["transport", "meals", "hotel", "fuel"].includes(e.category) ? e.category : "other") as ExpenseReport["category"],
    status: e.status === "pending" ? "pending" : e.status === "approved" ? "approved" : "rejected",
    employee: e.employeeName ?? "—", project: e.project ?? "—",
  };
}

function toDisplayCard(c: AppCorporateCard): CorporateCard {
  return { id: c.id, holder: c.holderName, role: c.role, limit: c.limitAmount, spent: c.spentAmount, currency: c.currency, color: "from-primary to-emerald-400" };
}

const growthData = [
  { m: "Mar", v: 120000 }, { m: "Apr", v: 185000 }, { m: "May", v: 220000 },
  { m: "Jun", v: 290000 }, { m: "Jul", v: 358000 }, { m: "Aug", v: 432000 },
  { m: "Sep", v: 520000 },
];

const POT_CATEGORIES: { id: SavingsPotCategory; labelKey: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }[] = [
  { id: "education", labelKey: "savings.catEducation", icon: GraduationCap, color: "from-violet-500 to-purple-400" },
  { id: "business", labelKey: "savings.catBusiness", icon: Briefcase, color: "from-primary to-emerald-400" },
  { id: "home", labelKey: "savings.catHome", icon: Home, color: "from-amber-500 to-yellow-400" },
  { id: "agriculture", labelKey: "savings.catAgriculture", icon: Leaf, color: "from-lime-500 to-green-400" },
  { id: "emergency", labelKey: "savings.catEmergency", icon: Shield, color: "from-rose-500 to-pink-400" },
  { id: "health", labelKey: "savings.catHealth", icon: Heart, color: "from-red-500 to-rose-400" },
  { id: "travel", labelKey: "savings.catTravel", icon: Globe, color: "from-accent to-sky-400" },
  { id: "custom", labelKey: "savings.catOther", icon: Star, color: "from-muted-foreground to-muted" },
];

/* ─── Sub-components ─────────────────────────────────────────── */

interface TooltipProps { active?: boolean; payload?: Array<{ value: number }>; label?: string; }
function ChartTip({ active, payload, label }: TooltipProps) {
  const { t } = useTranslation("common");
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-bold font-mono text-primary">{t("fundraise.xaf")} {payload[0].value.toLocaleString()}</p>
    </div>
  );
}

function PotCard({ pot, index, onFund }: { pot: SavingsPot; index: number; onFund: (pot: SavingsPot) => void }) {
  const { t } = useTranslation("common");
  const pct = Math.round((pot.current / pot.target) * 100);
  const Icon = pot.icon;
  const completed = pct >= 100;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden hover:border-border/80 hover:shadow-lg hover:shadow-black/20 transition-all group"
    >
      {completed && (
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
            <Trophy size={9} /> {t("savings.goalReached")}
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform", pot.color)}>
          <Icon size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{t(pot.name)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <Calendar size={9} /> {pot.dueDate} · {pot.interestRate}% APY
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono font-bold text-foreground">{pot.currency} {pot.current.toLocaleString()}</span>
          <span className="text-[10px] text-muted-foreground">/ {pot.currency} {pot.target.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(pct, 100)}%` }}
            transition={{ duration: 0.9, ease: "easeOut" as const, delay: index * 0.07 + 0.2 }}
            className={cn("h-full rounded-full bg-gradient-to-r", pot.color)}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className={cn("text-[10px] font-semibold", completed ? "text-primary" : "text-muted-foreground")}>{t("savings.pctComplete", { pct })}</span>
          {pot.monthlyContrib > 0 && (
            <span className="text-[10px] text-muted-foreground">{t("savings.monthlyContribution", { currency: pot.currency, amount: pot.monthlyContrib.toLocaleString() })}</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <TrendingUp size={10} className="text-primary" />
          <span className="text-primary font-semibold">+{pot.interestRate}%</span> {t("savings.annualReturn")}
        </div>
        <button onClick={() => onFund(pot)} className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline cursor-pointer">
          {t("savings.fund")} <ArrowUpRight size={10} />
        </button>
      </div>
    </motion.div>
  );
}

function TontineCard({ t: tontine, index, onContribute }: { t: TontineCircle; index: number; onContribute: (t: TontineCircle) => void }) {
  const { t } = useTranslation("common");
  const isMyTurn = tontine.nextRecipient.startsWith("You");
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={() => onContribute(tontine)}
      className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:shadow-black/20 transition-all relative overflow-hidden"
    >
      {isMyTurn && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/6 via-transparent to-transparent pointer-events-none" />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center", tontine.color)}>
              <Users size={15} />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">{t(tontine.name)}</div>
              <div className="text-[10px] text-muted-foreground">{tontine.members} {t("savings.membersLabel")} · {t(tontine.frequency === "weekly" ? "savings.weekly" : "savings.monthly")}</div>
            </div>
          </div>
          {isMyTurn && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold animate-pulse">
              <Flame size={9} /> {t("savings.yourTurn")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-secondary/60 rounded-xl p-2.5 text-center">
            <div className="text-xs font-black font-mono text-foreground">{tontine.currency} {(tontine.potAmount / 1000).toFixed(0)}K</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{t("savings.totalPot")}</div>
          </div>
          <div className="bg-secondary/60 rounded-xl p-2.5 text-center">
            <div className="text-xs font-black font-mono text-foreground">{tontine.currency} {tontine.myContrib.toLocaleString()}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{t("savings.myContribution")}</div>
          </div>
          <div className="bg-secondary/60 rounded-xl p-2.5 text-center">
            <div className="text-xs font-black font-mono text-foreground">{tontine.round}/{tontine.totalRounds}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{t("savings.currentRound")}</div>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(tontine.round / tontine.totalRounds) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" as const, delay: index * 0.08 + 0.2 }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
          />
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">
            {t("savings.next")}: <span className="text-foreground font-semibold">{tontine.nextRecipient}</span> · {tontine.nextPayout}
          </span>
          <span className="text-muted-foreground">
            {t("savings.myTurn")}: <span className={cn("font-semibold", isMyTurn ? "text-primary" : "text-foreground")}>{tontine.myTurn}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function InvestCard({ prod, index, onInvest }: { prod: InvestmentProduct; index: number; onInvest: (prod: InvestmentProduct) => void }) {
  const { t } = useTranslation("common");
  const riskColor = prod.risk === "low" ? "text-primary bg-primary/10" : prod.risk === "medium" ? "text-amber-700 bg-amber-50" : "text-destructive bg-destructive/10";
  const riskLabel = t(prod.risk === "low" ? "savings.riskLow" : prod.risk === "medium" ? "savings.riskMedium" : "savings.riskHigh");
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      onClick={() => onInvest(prod)}
      className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden cursor-pointer hover:border-border/80 hover:shadow-lg hover:shadow-black/20 transition-all group"
    >
      <div className={cn("absolute inset-0 opacity-[0.035] bg-gradient-to-br pointer-events-none", prod.color)} />
      {prod.badge && (
        <div className="absolute top-3 right-3">
          <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", prod.badge === "Most Popular" ? "bg-primary/20 text-primary" : prod.badge === "Capital Guaranteed" ? "bg-accent/20 text-accent" : "bg-lime-50 text-lime-700")}>
            {t(prod.badge)}
          </span>
        </div>
      )}
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform", prod.color)}>
            {prod.flag}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground truncate pr-16">{t(prod.name)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t(prod.description)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <div className={cn("text-xl font-black font-mono bg-gradient-to-r bg-clip-text text-transparent", prod.color)}>{prod.apy}%</div>
            <div className="text-[9px] text-muted-foreground">{t("savings.apyReturn")}</div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-foreground">{prod.currency} {prod.minAmount.toLocaleString()}</div>
            <div className="text-[9px] text-muted-foreground">{t("savings.minimum")}</div>
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{prod.duration}</div>
            <div className="text-[9px] text-muted-foreground">{t("savings.duration")}</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", riskColor)}>{riskLabel}</span>
          <button className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer bg-gradient-to-r text-white group-hover:shadow-md", prod.color)}>
            {t("savings.invest")} <ArrowUpRight size={11} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Contribute Modal (pot / tontine / product — real money) ─── */

function ContributeModal({ title, currency, minAmount, presets, confirming, onConfirm, onClose }: {
  title: string; currency: string; minAmount?: number; presets: number[]; confirming: boolean;
  onConfirm: (amount: number) => void; onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [amount, setAmount] = useState("");
  const numAmount = Number(amount);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" as const }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">{title}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {presets.map(p => (
              <button
                key={p} onClick={() => setAmount(String(p))}
                className={cn("text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer",
                  amount === String(p) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.amountLabel", { currency })}</label>
            <Input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className="font-mono text-base" />
            {minAmount && <p className="text-[10px] text-muted-foreground mt-1">{t("savings.minimumAmount", { amount: minAmount.toLocaleString(), currency })}</p>}
          </div>
          <Button className="w-full font-bold" disabled={confirming || !numAmount || numAmount <= 0} onClick={() => onConfirm(numAmount)}>
            {confirming ? t("signin.checking") : t("savings.confirmContribution")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── New Pot Modal ─────────────────────────────────────────── */

function NewPotModal({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (args: { name: string; category: SavingsPotCategory; target: number; monthly: number }) => Promise<void>;
}) {
  const { t } = useTranslation("common");
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCat, setSelectedCat] = useState<SavingsPotCategory | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [creating, setCreating] = useState(false);

  const handleClose = () => { setStep(1); setSelectedCat(null); setName(""); setTarget(""); setMonthly(""); onClose(); };

  const handleCreate = async () => {
    if (!selectedCat || !name || !target) return;
    setCreating(true);
    try {
      await onCreate({ name, category: selectedCat, target: Number(target), monthly: Number(monthly) || 0 });
      handleClose();
    } catch {
      toast.error(t("savings.potCreationFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleClose}>
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" as const }}
            className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-black text-foreground">{t("savings.newPotTitle")}</h2>
                <p className="text-[11px] text-muted-foreground">{t("savings.stepOf", { step })}</p>
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center cursor-pointer hover:bg-secondary/80">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">{t("savings.chooseGoal")}</p>
                <div className="grid grid-cols-4 gap-2">
                  {POT_CATEGORIES.map((c) => (
                    <button key={c.id} onClick={() => setSelectedCat(c.id)}
                      className={cn("flex flex-col items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer transition-all",
                        selectedCat === c.id ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-border/80")}>
                      <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center", c.color)}>
                        <c.icon size={14} className="text-white" />
                      </div>
                      <span className="text-[9px] text-muted-foreground text-center leading-tight">{t(c.labelKey)}</span>
                    </button>
                  ))}
                </div>
                <button disabled={!selectedCat} onClick={() => setStep(2)}
                  className={cn("w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer mt-2",
                    selectedCat ? "bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground hover:shadow-lg hover:shadow-primary/25" : "bg-secondary text-muted-foreground cursor-not-allowed")}>
                  {t("savings.continue")}
                </button>
              </div>
            )}

            {step === 2 && selectedCat && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">{t("savings.potName")}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("savings.potNamePlaceholder")}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">{t("savings.targetAmountLabel")}</label>
                  <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="500 000" type="number"
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors font-mono" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">{t("savings.monthlyAutoDeposit")}</label>
                  <input value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="25 000" type="number"
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors font-mono" />
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/8 border border-primary/20">
                  <Sparkles size={13} className="text-primary shrink-0" />
                  <p className="text-[11px] text-muted-foreground">{t("savings.guaranteedReturnPrefix")} <span className="text-primary font-bold">{t("savings.52Apy")}</span> {t("savings.guaranteedReturnSuffix")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setStep(1)} className="py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors cursor-pointer">
                    {t("savings.back")}
                  </button>
                  <button disabled={!name || !target || creating}
                    onClick={handleCreate}
                    className={cn("py-3 rounded-xl font-bold text-sm transition-all cursor-pointer",
                      name && target && !creating ? "bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground hover:shadow-lg hover:shadow-primary/25" : "bg-secondary text-muted-foreground cursor-not-allowed")}>
                    {creating ? t("signin.checking") : t("savings.createPot")}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── New Tontine Circle Modal ────────────────────────────────── */

function NewCircleModal({ currency, creating, onCreate, onClose }: {
  currency: string; creating: boolean; onCreate: (args: { name: string; potAmount: number; frequency: "weekly" | "monthly"; totalRounds: number }) => void; onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [name, setName] = useState("");
  const [potAmount, setPotAmount] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("monthly");
  const [totalRounds, setTotalRounds] = useState("10");

  const valid = !!name && Number(potAmount) > 0 && Number(totalRounds) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" as const }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">{t("savings.createCircle")}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.circleNameLabel")}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("savings.circleNamePlaceholder")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.amountLabel", { currency })}</label>
            <Input type="number" placeholder="0" value={potAmount} onChange={e => setPotAmount(e.target.value)} className="font-mono" />
          </div>
          <div className="flex gap-2">
            {(["weekly", "monthly"] as const).map(f => (
              <button key={f} onClick={() => setFrequency(f)}
                className={cn("flex-1 py-2 rounded-xl text-xs font-bold border capitalize transition-colors cursor-pointer",
                  frequency === f ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
                {t(f === "weekly" ? "savings.weekly" : "savings.monthly")}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.totalRoundsLabel")}</label>
            <Input type="number" value={totalRounds} onChange={e => setTotalRounds(e.target.value)} className="font-mono" />
          </div>
          <Button className="w-full font-bold" disabled={!valid || creating} onClick={() => onCreate({ name, potAmount: Number(potAmount), frequency, totalRounds: Number(totalRounds) })}>
            {creating ? t("signin.checking") : t("savings.createCircle")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Link Venue Modal ────────────────────────────────────────── */

function LinkVenueModal({ creating, onCreate, onClose }: {
  creating: boolean; onCreate: (args: { venueName: string; venueCategory: VenueCategory }) => void; onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [venueName, setVenueName] = useState("");
  const [venueCategory, setVenueCategory] = useState<VenueCategory>("restaurant");
  const categories: VenueCategory[] = ["restaurant", "bar", "club", "pub", "hotel", "cafe"];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" as const }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">{t("savings.linkVenue")}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.venueNameLabel")}</label>
            <Input value={venueName} onChange={e => setVenueName(e.target.value)} placeholder={t("savings.venueNamePlaceholder")} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(c => {
              const Icon = VENUE_ICONS[c];
              return (
                <button key={c} onClick={() => setVenueCategory(c)}
                  className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-semibold capitalize cursor-pointer transition-colors",
                    venueCategory === c ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
                  <Icon size={14} /> {c}
                </button>
              );
            })}
          </div>
          <Button className="w-full font-bold" disabled={!venueName || creating} onClick={() => onCreate({ venueName, venueCategory })}>
            {creating ? t("signin.checking") : t("savings.linkVenue")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── New Corporate Card Modal ────────────────────────────────── */

function NewCardModal({ currency, creating, onCreate, onClose }: {
  currency: string; creating: boolean; onCreate: (args: { holderName: string; role: string; limitAmount: number }) => void; onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [holderName, setHolderName] = useState("");
  const [role, setRole] = useState("");
  const [limitAmount, setLimitAmount] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" as const }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">{t("savings.newCard")}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.cardHolderLabel")}</label>
            <Input value={holderName} onChange={e => setHolderName(e.target.value)} placeholder={t("savings.cardHolderPlaceholder")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.cardRoleLabel")}</label>
            <Input value={role} onChange={e => setRole(e.target.value)} placeholder={t("savings.cardRolePlaceholder")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.cardLimitLabel", { currency })}</label>
            <Input type="number" value={limitAmount} onChange={e => setLimitAmount(e.target.value)} className="font-mono" />
          </div>
          <Button className="w-full font-bold" disabled={!holderName || !role || Number(limitAmount) <= 0 || creating}
            onClick={() => onCreate({ holderName, role, limitAmount: Number(limitAmount) })}>
            {creating ? t("signin.checking") : t("savings.newCard")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Submit Expense Report Modal ─────────────────────────────── */

function SubmitExpenseModal({ currency, submitting, onSubmit, onClose }: {
  currency: string; submitting: boolean; onSubmit: (args: { title: string; amount: number; category: ExpenseReport["category"]; project: string }) => void; onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseReport["category"]>("transport");
  const [project, setProject] = useState("");
  const categories: ExpenseReport["category"][] = ["transport", "meals", "hotel", "fuel", "other"];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" as const }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">{t("savings.submit")}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.expenseTitleLabel")}</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("savings.expenseTitlePlaceholder")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.amountLabel", { currency })}</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="font-mono" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => {
              const cfg = EXPENSE_CATEGORIES[c];
              return (
                <button key={c} onClick={() => setCategory(c)}
                  className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer",
                    category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
                  <cfg.icon size={11} /> {t(cfg.labelKey)}
                </button>
              );
            })}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("savings.expenseProjectLabel")}</label>
            <Input value={project} onChange={e => setProject(e.target.value)} placeholder={t("savings.expenseProjectPlaceholder")} />
          </div>
          <Button className="w-full font-bold" disabled={!title || Number(amount) <= 0 || submitting} onClick={() => onSubmit({ title, amount: Number(amount), category, project })}>
            {submitting ? t("signin.checking") : t("savings.submit")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Loyalty & Corporate T&E Types ─────────────────────────── */

type VenueCategory = "restaurant" | "bar" | "club" | "pub" | "hotel" | "cafe";

interface LoyaltyPot {
  id: string;
  venueName: string;
  venueCategory: VenueCategory;
  points: number;
  pointsValue: number; // CFA equiv per point
  currency: string;
  monthlySpend: number;
  nextReward: number; // points to next reward
  rewardOptions: { label: string; points: number; icon: React.ComponentType<{ size?: number; className?: string }> }[];
  color: string;
  emoji: string;
  monthHistory: { m: string; spend: number }[];
  spendLimit: number; // monthly budget cap set by user
  cashbackRate: number; // % back as points
}

interface ExpenseReport {
  id: string;
  title: string;
  date: string;
  amount: number;
  currency: string;
  category: "transport" | "meals" | "hotel" | "fuel" | "other";
  status: "approved" | "pending" | "rejected";
  employee: string;
  project: string;
}

interface CorporateCard {
  id: string;
  holder: string;
  role: string;
  limit: number;
  spent: number;
  currency: string;
  color: string;
}

/* ─── Loyalty & Corporate Data ───────────────────────────────── */

const VENUE_ICONS: Record<VenueCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  restaurant: UtensilsCrossed,
  bar: Wine,
  club: Music2,
  pub: Wine,
  hotel: Hotel,
  cafe: Coffee,
};

const LOYALTY_POTS: LoyaltyPot[] = [
  {
    id: "l1", venueName: "Brasserie du Fleuve", venueCategory: "restaurant",
    points: 3840, pointsValue: 10, currency: "XAF",
    monthlySpend: 45000, spendLimit: 60000, cashbackRate: 8,
    nextReward: 5000, color: "from-amber-500 to-orange-400", emoji: "🍽️",
    rewardOptions: [
      { label: "savings.reward.freeEntree", points: 2000, icon: UtensilsCrossed },
      { label: "savings.reward.freeDessert", points: 800, icon: Gift },
      { label: "savings.reward.bottleOfWine", points: 4500, icon: Wine },
    ],
    monthHistory: [
      { m: "Apr", spend: 38000 }, { m: "May", spend: 52000 },
      { m: "Jun", spend: 41000 }, { m: "Jul", spend: 47000 }, { m: "Aug", spend: 45000 },
    ],
  },
  {
    id: "l2", venueName: "Club Ndako VIP", venueCategory: "club",
    points: 9200, pointsValue: 10, currency: "XAF",
    monthlySpend: 120000, spendLimit: 100000, cashbackRate: 12,
    nextReward: 10000, color: "from-violet-600 to-purple-400", emoji: "🎶",
    rewardOptions: [
      { label: "savings.reward.vipEntry", points: 3000, icon: Star },
      { label: "savings.reward.freeBottle", points: 8000, icon: Wine },
      { label: "savings.reward.reservedTable", points: 5000, icon: Users },
    ],
    monthHistory: [
      { m: "Apr", spend: 80000 }, { m: "May", spend: 135000 },
      { m: "Jun", spend: 95000 }, { m: "Jul", spend: 148000 }, { m: "Aug", spend: 120000 },
    ],
  },
  {
    id: "l3", venueName: "Hôtel Sultani", venueCategory: "hotel",
    points: 21000, pointsValue: 10, currency: "XAF",
    monthlySpend: 0, spendLimit: 300000, cashbackRate: 10,
    nextReward: 25000, color: "from-cyan-500 to-sky-400", emoji: "🏨",
    rewardOptions: [
      { label: "savings.reward.freeNight", points: 20000, icon: Hotel },
      { label: "savings.reward.breakfastIncluded", points: 5000, icon: Coffee },
      { label: "savings.reward.roomUpgrade", points: 10000, icon: ArrowUpRight },
    ],
    monthHistory: [
      { m: "Apr", spend: 180000 }, { m: "May", spend: 0 },
      { m: "Jun", spend: 260000 }, { m: "Jul", spend: 0 }, { m: "Aug", spend: 0 },
    ],
  },
  {
    id: "l4", venueName: "Le Pub de Bruxelles", venueCategory: "pub",
    points: 1650, pointsValue: 10, currency: "XAF",
    monthlySpend: 18000, spendLimit: 30000, cashbackRate: 6,
    nextReward: 2000, color: "from-amber-700 to-amber-500", emoji: "🍺",
    rewardOptions: [
      { label: "savings.reward.freePint", points: 500, icon: Wine },
      { label: "savings.reward.privateHappyHour", points: 3000, icon: Users },
    ],
    monthHistory: [
      { m: "Apr", spend: 22000 }, { m: "May", spend: 15000 },
      { m: "Jun", spend: 19000 }, { m: "Jul", spend: 21000 }, { m: "Aug", spend: 18000 },
    ],
  },
];

const EXPENSE_REPORTS: ExpenseReport[] = [
  { id: "e1", title: "savings.expense.travelDoualaYaounde", date: "12 Aug 2026", amount: 85000, currency: "XAF", category: "transport", status: "approved", employee: "Kofi A.", project: "Client BDEAC" },
  { id: "e2", title: "savings.expense.clientDinner", date: "11 Aug 2026", amount: 124000, currency: "XAF", category: "meals", status: "pending", employee: "Fatou B.", project: "Pitch AfDB 2026" },
  { id: "e3", title: "savings.expense.kinshasaHotelNight", date: "10 Aug 2026", amount: 210000, currency: "XAF", category: "hotel", status: "approved", employee: "Amara K.", project: "Expansion RDC" },
  { id: "e4", title: "savings.expense.fieldMissionFuel", date: "9 Aug 2026", amount: 35000, currency: "XAF", category: "fuel", status: "rejected", employee: "Oumar D.", project: "Audit Bandundu" },
  { id: "e5", title: "savings.expense.flightsDakarParis", date: "8 Aug 2026", amount: 780000, currency: "XAF", category: "transport", status: "approved", employee: "Kofi A.", project: "Roadshow Europe" },
  { id: "e6", title: "savings.expense.teamMeal", date: "7 Aug 2026", amount: 66000, currency: "XAF", category: "meals", status: "pending", employee: "Ngozi E.", project: "Team Offsite" },
];

const CORPORATE_CARDS: CorporateCard[] = [
  { id: "c1", holder: "Kofi Asante", role: "Director", limit: 2000000, spent: 865000, currency: "XAF", color: "from-amber-500 to-yellow-400" },
  { id: "c2", holder: "Fatou Balde", role: "Sales Manager", limit: 800000, spent: 512000, currency: "XAF", color: "from-primary to-emerald-400" },
  { id: "c3", holder: "Amara Kouyaté", role: "Field Agent", limit: 400000, spent: 210000, currency: "XAF", color: "from-accent to-sky-400" },
];

const EXPENSE_CATEGORIES: Record<ExpenseReport["category"], { labelKey: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  transport: { labelKey: "savings.catTransport", icon: Plane, color: "text-blue-700" },
  meals: { labelKey: "savings.catMeals", icon: UtensilsCrossed, color: "text-amber-700" },
  hotel: { labelKey: "savings.catHotel", icon: Hotel, color: "text-cyan-700" },
  fuel: { labelKey: "savings.catFuel", icon: Car, color: "text-orange-700" },
  other: { labelKey: "savings.catOther", icon: Receipt, color: "text-muted-foreground" },
};

/* ─── Loyalty sub-components ─────────────────────────────────── */

function LoyaltyCard({ pot, index, isReal, onSpend, onRedeem, onEditLimit }: {
  pot: LoyaltyPot; index: number; isReal: boolean; onEditLimit: (pot: LoyaltyPot) => void;
  onSpend: (pot: LoyaltyPot) => void; onRedeem: (pot: LoyaltyPot, reward: LoyaltyPot["rewardOptions"][number]) => void;
}) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(false);
  const VenueIcon = VENUE_ICONS[pot.venueCategory];
  const cashValue = pot.points * pot.pointsValue;
  const progressToNext = Math.min(100, Math.round((pot.points / pot.nextReward) * 100));
  const overBudget = pot.monthlySpend > pot.spendLimit;
  // Real month-by-month history (0020) — each account is its own
  // component instance, so fetching it here (rather than in a loop in
  // the parent) is the correct hooks pattern, same as RealInvestmentRow
  // in invest/page.tsx.
  const realHistory = useLoyaltySpendHistory(isReal ? pot.id : undefined);
  const monthHistory = isReal && realHistory ? realHistory : pot.monthHistory;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className={cn("h-2 bg-gradient-to-r w-full", pot.color)} />
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg shrink-0", pot.color)}>
            {pot.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{pot.venueName}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
              <VenueIcon size={9} />
              <span className="capitalize">{pot.venueCategory}</span>
              <span>·</span>
              <span className="text-primary font-semibold">{t("savings.cashbackInPoints", { rate: pot.cashbackRate })}</span>
            </div>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Points balance */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-secondary/60 rounded-xl p-2.5 text-center">
            <div className="text-sm font-black font-mono text-foreground">{pot.points.toLocaleString()}</div>
            <div className="text-[9px] text-muted-foreground">{t("savings.pointsLabel")}</div>
          </div>
          <div className="bg-secondary/60 rounded-xl p-2.5 text-center">
            <div className="text-sm font-black font-mono text-primary">{pot.currency} {cashValue.toLocaleString()}</div>
            <div className="text-[9px] text-muted-foreground">{t("savings.cashValue")}</div>
          </div>
          <div className={cn("rounded-xl p-2.5 text-center", overBudget ? "bg-destructive/10" : "bg-secondary/60")}>
            <div className={cn("text-sm font-black font-mono", overBudget ? "text-destructive" : "text-foreground")}>
              {pot.currency} {pot.monthlySpend.toLocaleString()}
            </div>
            <div className="text-[9px] text-muted-foreground">{t("savings.thisMonth")}</div>
          </div>
        </div>

        {/* Budget warning */}
        {overBudget && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/25 rounded-xl px-3 py-2 mb-3">
            <AlertCircle size={12} className="text-destructive shrink-0" />
            <span className="text-[10px] text-destructive font-semibold">
              {t("savings.overBudgetSpend", { amount: `${pot.currency} ${(pot.monthlySpend - pot.spendLimit).toLocaleString()}` })}
            </span>
          </div>
        )}

        {/* Progress to next reward */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">{t("savings.nextTier")}</span>
            <span className="font-semibold text-foreground">{t("savings.pts2", { points: pot.points.toLocaleString(), next: pot.nextReward.toLocaleString() })}</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full bg-gradient-to-r", pot.color)}
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.8, ease: "easeOut" as const, delay: index * 0.07 + 0.2 }}
            />
          </div>
        </div>

        {/* Spend here */}
        <button
          onClick={() => onSpend(pot)}
          className="w-full mb-3 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs font-bold cursor-pointer hover:bg-primary/15 transition-colors"
        >
          <CreditCard size={12} /> {t("savings.spendHere")}
        </button>

        {/* Reward options */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {pot.rewardOptions.map(r => (
            <button
              key={r.label}
              disabled={pot.points < r.points}
              onClick={() => onRedeem(pot, r)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-xl border transition-colors cursor-pointer",
                pot.points >= r.points
                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                  : "bg-secondary border-border text-muted-foreground cursor-not-allowed opacity-60"
              )}
            >
              <r.icon size={10} />
              {t(r.label)}
              <span className="font-mono text-[9px] opacity-80">{r.points.toLocaleString()}{t("savings.pts")}</span>
            </button>
          ))}
        </div>

        {/* Expanded: spending chart + limit setting */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" as const }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-border mt-4 space-y-3">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("savings.spendingHistory")}</div>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={monthHistory} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`lg-${pot.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.66 0.20 138)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="oklch(0.66 0.20 138)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="m" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 8 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: unknown) => [`XAF ${Number(v).toLocaleString()}`, t("savings.spend")]} />
                    <Area type="monotone" dataKey="spend" stroke="oklch(0.66 0.20 138)" strokeWidth={1.5} fill={`url(#lg-${pot.id})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-3 py-2.5">
                  <div>
                    <div className="text-[10px] text-muted-foreground">{t("savings.monthlyLimit")}</div>
                    <div className="text-xs font-bold font-mono">{pot.currency} {pot.spendLimit.toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => onEditLimit(pot)}
                    className="text-[10px] text-primary font-bold hover:underline cursor-pointer"
                  >
                    {t("savings.edit")}
                  </button>
                </div>
                <button
                  onClick={() => toast.success(t("savings.balanceConverted"))}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground text-xs font-bold cursor-pointer hover:shadow-lg hover:shadow-primary/25 transition-all"
                >
                  <Wallet size={13} /> {t("savings.convertToCash", { amount: `${pot.currency} ${cashValue.toLocaleString()}` })}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Corporate T&E components ───────────────────────────────── */

function ExpenseRow({ exp }: { exp: ExpenseReport }) {
  const { t } = useTranslation("common");
  const cat = EXPENSE_CATEGORIES[exp.category];
  const CatIcon = cat.icon;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/60 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
        <CatIcon size={14} className={cat.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{t(exp.title)}</div>
        <div className="text-[10px] text-muted-foreground flex gap-1.5 mt-0.5">
          <span>{exp.employee}</span>
          <span>·</span>
          <span>{exp.project}</span>
          <span>·</span>
          <span>{exp.date}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-bold font-mono">{exp.currency} {exp.amount.toLocaleString()}</div>
        <span className={cn(
          "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
          exp.status === "approved" ? "bg-primary/15 text-primary" :
          exp.status === "pending" ? "bg-amber-50 text-amber-700" :
          "bg-destructive/15 text-destructive"
        )}>
          {t(exp.status === "approved" ? "savings.statusApproved" : exp.status === "pending" ? "savings.statusPending" : "savings.statusRejected")}
        </span>
      </div>
    </div>
  );
}

function CorporateCardWidget({ card, index }: { card: CorporateCard; index: number }) {
  const { t } = useTranslation("common");
  const pct = Math.round((card.spent / card.limit) * 100);
  const alert = pct >= 80;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-card border border-border rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", card.color)}>
          <CreditCard size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate">{card.holder}</div>
          <div className="text-[10px] text-muted-foreground">{card.role}</div>
        </div>
        {alert && <AlertCircle size={14} className="text-amber-700 shrink-0" />}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className={cn("font-bold font-mono", alert ? "text-amber-700" : "text-foreground")}>
            {card.currency} {card.spent.toLocaleString()}
          </span>
          <span className="text-muted-foreground">/ {card.currency} {card.limit.toLocaleString()}</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full bg-gradient-to-r", alert ? "from-amber-500 to-orange-400" : card.color)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" as const, delay: index * 0.07 + 0.2 }}
          />
        </div>
        <div className="text-[9px] text-muted-foreground">{t("savings.pctUsedThisMonth", { pct })}</div>
      </div>
    </motion.div>
  );
}



type Tab = "savings" | "tontines" | "investments" | "loyalty" | "corporate";

function presetsFor(min?: number): number[] {
  const base = [5000, 10000, 25000, 50000, 100000, 250000];
  const filtered = min ? base.filter((v) => v >= min) : base;
  return (filtered.length ? filtered : base).slice(0, 4);
}

export default function SavingsPage() {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<Tab>("savings");
  const [newPotOpen, setNewPotOpen] = useState(false);
  const { profile } = useProfile();
  const currency = profile?.currency ?? "XAF";

  const currentUser = useCurrentAppUser();
  const realPots = useSavingsPotsForUser(currentUser?.id);
  const realTontines = useTontineCircles();
  const realProducts = useInvestmentProducts();
  const createSavingsPotMutation = useCreateSavingsPotMutation();
  const contributeToPotMutation = useContributeToPotMutation();
  const joinTontineMutation = useJoinTontineMutation();
  const contributeToTontineMutation = useContributeToTontineMutation();
  const investInProductMutation = useInvestInProductMutation();
  const createTontineCircleMutation = useCreateTontineCircleMutation();

  const realLoyalty = useLoyaltyAccountsForUser(currentUser?.id);
  const realExpenses = useExpenseReportsForUser(currentUser?.id);
  const realCards = useCorporateCardsForUser(currentUser?.id);
  const linkLoyaltyVenueMutation = useLinkLoyaltyVenueMutation();
  const recordVenueSpendMutation = useRecordVenueSpendMutation();
  const redeemLoyaltyRewardMutation = useRedeemLoyaltyRewardMutation();
  const submitExpenseReportMutation = useSubmitExpenseReportMutation();
  const createCorporateCardMutation = useCreateCorporateCardMutation();

  // Real data once signed in with something to show; anonymous/no-data
  // visitors keep the existing rich mock catalog — same fallback
  // convention used throughout this migration (see fundraise/travel).
  const hasRealPots = !!currentUser && !!realPots && realPots.length > 0;
  const hasRealTontines = !!currentUser && !!realTontines && realTontines.length > 0;
  const hasRealProducts = !!currentUser && !!realProducts && realProducts.length > 0;
  const hasRealLoyalty = !!currentUser && !!realLoyalty && realLoyalty.length > 0;
  const hasRealExpenses = !!currentUser && !!realExpenses && realExpenses.length > 0;
  const hasRealCards = !!currentUser && !!realCards && realCards.length > 0;

  const displayPots: SavingsPot[] = hasRealPots ? realPots.map(toDisplayPot) : MY_POTS;
  const displayTontines: TontineCircle[] = hasRealTontines ? realTontines.map((c) => toDisplayTontine(c, 0)) : TONTINES;
  const displayProducts: InvestmentProduct[] = hasRealProducts ? realProducts.map(toDisplayProduct) : INVESTMENT_PRODUCTS;
  const displayLoyalty: LoyaltyPot[] = hasRealLoyalty ? realLoyalty.map(toDisplayLoyaltyPot) : LOYALTY_POTS;
  const displayExpenses: ExpenseReport[] = hasRealExpenses ? realExpenses.map(toDisplayExpense) : EXPENSE_REPORTS;
  const displayCards: CorporateCard[] = hasRealCards ? realCards.map(toDisplayCard) : CORPORATE_CARDS;

  const totalSaved = displayPots.reduce((s, p) => s + p.current, 0);
  const totalTarget = displayPots.reduce((s, p) => s + p.target, 0);
  const totalInterest = Math.round(totalSaved * 0.052 / 12);

  const [contributing, setContributing] = useState<{ kind: "pot" | "tontine" | "product"; item: SavingsPot | TontineCircle | InvestmentProduct } | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirmContribute(amount: number) {
    if (!contributing) return;
    const { kind, item } = contributing;
    const isReal = (kind === "pot" && hasRealPots) || (kind === "tontine" && hasRealTontines) || (kind === "product" && hasRealProducts);
    const successKey = kind === "product" ? "savings.investSuccess" : "savings.contributionSuccess";
    const failKey = kind === "product" ? "savings.investFailed" : "savings.contributionFailed";
    if (!currentUser || !isReal) {
      toast.success(t(successKey, { currency: item.currency, amount: amount.toLocaleString(), name: t(item.name) }));
      setContributing(null);
      return;
    }
    setConfirming(true);
    try {
      if (kind === "pot") {
        await contributeToPotMutation({ userId: currentUser.id, potId: item.id, amount });
      } else if (kind === "product") {
        await investInProductMutation({ userId: currentUser.id, productId: item.id, amount });
      } else {
        try {
          await contributeToTontineMutation({ userId: currentUser.id, circleId: item.id, amount });
        } catch (e) {
          if (e instanceof Error && e.message.includes("not a member")) {
            await joinTontineMutation({ userId: currentUser.id, circleId: item.id });
            await contributeToTontineMutation({ userId: currentUser.id, circleId: item.id, amount });
          } else {
            throw e;
          }
        }
      }
      toast.success(t(successKey, { currency: item.currency, amount: amount.toLocaleString(), name: t(item.name) }));
      setContributing(null);
    } catch {
      toast.error(t(failKey));
    } finally {
      setConfirming(false);
    }
  }

  async function handleCreatePot(args: { name: string; category: SavingsPotCategory; target: number; monthly: number }) {
    if (!currentUser) {
      toast.success(t("savings.potCreated", { name: args.name }));
      return;
    }
    await createSavingsPotMutation({ userId: currentUser.id, name: args.name, category: args.category, targetAmount: args.target, currency, monthlyContrib: args.monthly });
    toast.success(t("savings.potCreated", { name: args.name }));
  }

  const [newCircleOpen, setNewCircleOpen] = useState(false);
  const [creatingCircle, setCreatingCircle] = useState(false);
  async function handleCreateCircle(args: { name: string; potAmount: number; frequency: "weekly" | "monthly"; totalRounds: number }) {
    if (!currentUser) {
      toast.success(t("savings.circleCreated", { name: args.name }));
      setNewCircleOpen(false);
      return;
    }
    setCreatingCircle(true);
    try {
      await createTontineCircleMutation({ ownerUserId: currentUser.id, name: args.name, currency, potAmount: args.potAmount, frequency: args.frequency, totalRounds: args.totalRounds });
      toast.success(t("savings.circleCreated", { name: args.name }));
      setNewCircleOpen(false);
    } catch {
      toast.error(t("savings.circleCreationFailed"));
    } finally {
      setCreatingCircle(false);
    }
  }

  const [linkVenueOpen, setLinkVenueOpen] = useState(false);
  const [linkingVenue, setLinkingVenue] = useState(false);
  async function handleLinkVenue(args: { venueName: string; venueCategory: VenueCategory }) {
    if (!currentUser) {
      toast.success(t("savings.venueLinked", { name: args.venueName }));
      setLinkVenueOpen(false);
      return;
    }
    setLinkingVenue(true);
    try {
      await linkLoyaltyVenueMutation({ userId: currentUser.id, venueName: args.venueName, venueCategory: args.venueCategory, currency });
      toast.success(t("savings.venueLinked", { name: args.venueName }));
      setLinkVenueOpen(false);
    } catch {
      toast.error(t("savings.venueLinkFailed"));
    } finally {
      setLinkingVenue(false);
    }
  }

  const [spendingAt, setSpendingAt] = useState<LoyaltyPot | null>(null);
  const [editingLimit, setEditingLimit] = useState<LoyaltyPot | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [spending, setSpending] = useState(false);
  async function handleConfirmSpend(amount: number) {
    if (!spendingAt) return;
    const pot = spendingAt;
    if (!currentUser || !hasRealLoyalty) {
      toast.success(t("savings.spendRecorded", { currency: pot.currency, amount: amount.toLocaleString(), name: pot.venueName }));
      setSpendingAt(null);
      return;
    }
    setSpending(true);
    try {
      await recordVenueSpendMutation({ userId: currentUser.id, accountId: pot.id, amount });
      toast.success(t("savings.spendRecorded", { currency: pot.currency, amount: amount.toLocaleString(), name: pot.venueName }));
      setSpendingAt(null);
    } catch {
      toast.error(t("savings.spendFailed"));
    } finally {
      setSpending(false);
    }
  }

  async function handleRedeem(pot: LoyaltyPot, reward: LoyaltyPot["rewardOptions"][number]) {
    if (!currentUser || !hasRealLoyalty) {
      toast.success(t("savings.rewardRedeemed", { label: t(reward.label) }));
      return;
    }
    try {
      await redeemLoyaltyRewardMutation({ userId: currentUser.id, accountId: pot.id, pointsCost: reward.points, rewardLabel: t(reward.label) });
      toast.success(t("savings.rewardRedeemed", { label: t(reward.label) }));
    } catch {
      toast.error(t("savings.rewardRedeemFailed"));
    }
  }

  const [newCardOpen, setNewCardOpen] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  async function handleCreateCard(args: { holderName: string; role: string; limitAmount: number }) {
    if (!currentUser) {
      toast.success(t("savings.cardCreated", { name: args.holderName }));
      setNewCardOpen(false);
      return;
    }
    setCreatingCard(true);
    try {
      await createCorporateCardMutation({ ownerUserId: currentUser.id, holderName: args.holderName, role: args.role, limitAmount: args.limitAmount, currency });
      toast.success(t("savings.cardCreated", { name: args.holderName }));
      setNewCardOpen(false);
    } catch {
      toast.error(t("savings.cardCreationFailed"));
    } finally {
      setCreatingCard(false);
    }
  }

  const [submitExpenseOpen, setSubmitExpenseOpen] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  async function handleSubmitExpense(args: { title: string; amount: number; category: ExpenseReport["category"]; project: string }) {
    if (!currentUser) {
      toast.success(t("savings.expenseSubmitted", { title: args.title }));
      setSubmitExpenseOpen(false);
      return;
    }
    setSubmittingExpense(true);
    try {
      await submitExpenseReportMutation({ userId: currentUser.id, title: args.title, amount: args.amount, currency, category: args.category, project: args.project || undefined });
      toast.success(t("savings.expenseSubmitted", { title: args.title }));
      setSubmitExpenseOpen(false);
    } catch {
      toast.error(t("savings.expenseSubmitFailed"));
    } finally {
      setSubmittingExpense(false);
    }
  }

  const totalLoyaltyPoints = displayLoyalty.reduce((s, p) => s + p.points, 0);
  const totalLoyaltyCash = displayLoyalty.reduce((s, p) => s + p.points * p.pointsValue, 0);
  const totalExpenses = displayExpenses.reduce((s, e) => s + e.amount, 0);
  const pendingExpenses = displayExpenses.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);

  const isCorporate = profile && ["merchant", "treasury", "ngo", "group"].includes(profile.type);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: "savings", label: t("savings.tabSavings"), icon: PiggyBank },
    { id: "tontines", label: t("savings.tabTontines"), icon: Users },
    { id: "investments", label: t("savings.tabInvest"), icon: TrendingUp },
    { id: "loyalty", label: t("savings.tabLoyalty"), icon: Gift },
    ...(isCorporate ? [{ id: "corporate" as Tab, label: t("savings.tabCorporate"), icon: Building2 }] : []),
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5 pb-24 md:pb-6">
      <PageHeader title={t("savings.title")} className="mb-4 md:mb-6" />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-0.5">
          <PiggyBank size={14} className="text-primary" />
          <span className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase">{t("savings.brandLabel")}</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-foreground tracking-tight">{t("savings.pageHeading")}</h1>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-lime-50 border border-lime-200">
            <Leaf size={10} className="text-lime-700" />
            <span className="text-[10px] text-lime-700 font-semibold">{t("savings.africaGrowth")}</span>
          </div>
        </div>
      </motion.div>

      {/* Hero summary card */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-2xl bg-card border border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-lime-500/6 pointer-events-none" />
        <div className="relative p-5">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t("savings.totalSaved")}</div>
              <div className="text-2xl font-black font-mono text-foreground tracking-tight">{currency} {(totalSaved / 1000).toFixed(0)}K</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t("savings.ofTarget", { amount: `${currency} ${(totalTarget / 1000).toFixed(0)}K` })}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t("savings.interestThisMonth")}</div>
              <div className="text-2xl font-black font-mono text-primary tracking-tight">+{currency} {totalInterest.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t("savings.yieldRate", { rate: "5.2" })}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t("savings.activePots")}</div>
              <div className="text-2xl font-black font-mono text-foreground tracking-tight">{displayPots.length}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t("savings.goalsReached", { count: displayPots.filter(p => p.current >= p.target).length })}</div>
            </div>
          </div>
          <div className="px-0 pt-0 -mx-1">
            <ResponsiveContainer width="100%" height={72}>
              <AreaChart data={growthData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.66 0.20 138)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="oklch(0.66 0.20 138)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="v" stroke="oklch(0.66 0.20 138)" strokeWidth={2} fill="url(#sg2)" dot={false} activeDot={{ r: 3, fill: "oklch(0.66 0.20 138)", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CTA banner */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/15 to-lime-500/10 border border-primary/25">
            <Sparkles size={16} className="text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-bold text-foreground">{t("savings.startSaving", { amount: "XAF 500" })}</div>
              <div className="text-[10px] text-muted-foreground">{t("savings.everyStepCounts")}</div>
            </div>
            <button onClick={() => setNewPotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground text-xs font-bold shrink-0 cursor-pointer hover:shadow-lg hover:shadow-primary/25 transition-all">
              <Plus size={12} /> {t("savings.create")}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Trust badges */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { icon: Shield, label: t("savings.insuredSavings"), sub: t("savings.insuredSub", { amount: "XAF 5M" }), color: "text-primary" },
          { icon: Zap, label: t("savings.dailyInterest"), sub: t("savings.dailyInterestSub"), color: "text-amber-700" },
          { icon: Globe, label: t("savings.africanCountries"), sub: t("savings.payrusNetwork"), color: "text-accent" },
          { icon: BookOpen, label: t("savings.shariaCompliant"), sub: t("savings.optionsAvailable"), color: "text-lime-700" },
        ].map((b) => (
          <div key={b.label} className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border">
            <b.icon size={13} className={b.color} />
            <div>
              <div className="text-[10px] font-semibold text-foreground whitespace-nowrap">{b.label}</div>
              <div className="text-[9px] text-muted-foreground whitespace-nowrap">{b.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        {tabs.map((tabItem) => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              tab === tabItem.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <tabItem.icon size={13} />
            <span className="hidden sm:inline">{tabItem.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">

        {/* ── SAVINGS POTS ── */}
        {tab === "savings" && (
          <motion.div key="savings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">{t("savings.myPots", { count: displayPots.length })}</h2>
              <button onClick={() => setNewPotOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary cursor-pointer hover:bg-primary/15 transition-colors">
                <Plus size={12} /> {t("savings.newPotTitle")}
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {displayPots.map((pot, i) => <PotCard key={pot.id} pot={pot} index={i} onFund={(p) => setContributing({ kind: "pot", item: p })} />)}
            </div>

            {/* Saving tips */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-primary" />
                <span className="text-xs font-bold text-foreground">{t("savings.savingTips")}</span>
              </div>
              <div className="space-y-2">
                {[
                  { tip: t("savings.tipAutomate"), icon: Zap, color: "text-primary" },
                  { tip: t("savings.tipSplitGoals"), icon: Target, color: "text-accent" },
                  { tip: t("savings.tipInviteFamily"), icon: Users, color: "text-lime-700" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-secondary/50">
                    <item.icon size={13} className={cn("mt-0.5 shrink-0", item.color)} />
                    <span className="text-[11px] text-muted-foreground">{item.tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TONTINES ── */}
        {tab === "tontines" && (
          <motion.div key="tontines" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">{t("savings.savingsCircles", { count: displayTontines.length })}</h2>
                <p className="text-[10px] text-muted-foreground">{t("savings.tontineSubtitle")}</p>
              </div>
              <button onClick={() => setNewCircleOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary cursor-pointer hover:bg-primary/15 transition-colors">
                <Plus size={12} /> {t("savings.createCircle")}
              </button>
            </div>

            {displayTontines.map((tontine, i) => <TontineCard key={tontine.id} t={tontine} index={i} onContribute={(c) => setContributing({ kind: "tontine", item: c })} />)}

            {/* How it works */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="text-xs font-bold text-foreground mb-3">{t("savings.howTontineWorks")}</div>
              <div className="space-y-2.5">
                {[
                  { n: "1", text: t("savings.tontineStep1"), color: "bg-primary" },
                  { n: "2", text: t("savings.tontineStep2"), color: "bg-accent" },
                  { n: "3", text: t("savings.tontineStep3"), color: "bg-amber-500" },
                  { n: "4", text: t("savings.tontineStep4"), color: "bg-primary" },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3">
                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5", s.color)}>{s.n}</div>
                    <span className="text-[11px] text-muted-foreground">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── INVESTMENTS ── */}
        {tab === "investments" && (
          <motion.div key="investments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">{t("savings.investProducts")}</h2>
                <p className="text-[10px] text-muted-foreground">{t("savings.investSubtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompare((v) => !v)} aria-expanded={showCompare}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary border border-border text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                <BarChart3 size={11} /> {t("savings.compare")} <ChevronDown size={11} className={cn("transition-transform", showCompare && "rotate-180")} />
              </button>
            </div>

            {/* Best rate highlight */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-lime-500/10 to-primary/8 border border-lime-200">
              <div className="w-9 h-9 rounded-xl bg-lime-50 flex items-center justify-center shrink-0">
                <Trophy size={15} className="text-lime-700" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-foreground">{t("savings.bestRateNow")}</div>
                <div className="text-[11px] text-muted-foreground">Micro-Equity Agricole · <span className="text-lime-700 font-bold">{t("savings.185Apy")}</span> · {t("savings.investInFarmers")}</div>
              </div>
              <ChevronRight size={13} className="text-muted-foreground" />
            </div>

            {showCompare && (
              <div className="rounded-2xl border border-border bg-card overflow-x-auto" data-testid="compare-products">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] text-muted-foreground border-b border-border">
                      <th className="px-3 py-2 font-semibold">{t("savings.investProducts")}</th>
                      <th className="px-3 py-2 font-semibold">{t("savings.apyReturn")}</th>
                      <th className="px-3 py-2 font-semibold">{t("savings.minimum")}</th>
                      <th className="px-3 py-2 font-semibold">{t("savings.duration")}</th>
                      <th className="px-3 py-2 font-semibold">{t("savings.compareRisk")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...displayProducts].sort((a, b) => b.apy - a.apy).map((p, i) => (
                      <tr key={p.id} className={cn("border-b border-border/50 last:border-0 cursor-pointer hover:bg-secondary/40", i === 0 && "bg-lime-500/5")} onClick={() => setContributing({ kind: "product", item: p })}>
                        <td className="px-3 py-2 font-semibold">{p.flag} {t(p.name)}</td>
                        <td className="px-3 py-2 font-mono font-bold">{p.apy}%</td>
                        <td className="px-3 py-2 font-mono">{p.currency} {p.minAmount.toLocaleString()}</td>
                        <td className="px-3 py-2">{p.duration}</td>
                        <td className="px-3 py-2">{t(p.risk === "low" ? "savings.riskLow" : p.risk === "medium" ? "savings.riskMedium" : "savings.riskHigh")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {displayProducts.map((prod, i) => <InvestCard key={prod.id} prod={prod} index={i} onInvest={(p) => setContributing({ kind: "product", item: p })} />)}
            </div>

            {/* Risk disclaimer */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-secondary/60 border border-border">
              <Shield size={13} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {t("savings.riskDisclaimer")}
              </p>
            </div>

            {/* Impact counter */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Leaf size={14} className="text-lime-700" />
                <span className="text-xs font-bold text-foreground">{t("savings.communityImpact")}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { v: "14,200", label: t("savings.farmersFunded"), color: "text-lime-700" },
                  { v: "XAF 4.2B", label: t("savings.loansGranted"), color: "text-primary" },
                  { v: "94.8%", label: t("savings.repaymentRate"), color: "text-accent" },
                ].map((s) => (
                  <div key={s.label} className="bg-secondary/50 rounded-xl p-2.5">
                    <div className={cn("text-base font-black font-mono", s.color)}>{s.v}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── LOYALTY POTS ── */}
        {tab === "loyalty" && (
          <motion.div key="loyalty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t("savings.totalPoints"), value: totalLoyaltyPoints.toLocaleString(), color: "text-amber-700" },
                { label: t("savings.cashValue"), value: `XAF ${totalLoyaltyCash.toLocaleString()}`, color: "text-primary" },
                { label: t("savings.establishments"), value: t("savings.venuesLinked", { count: LOYALTY_POTS.length }), color: "text-foreground" },
              ].map(s => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                  <div className={cn("text-sm font-black font-mono", s.color)}>{s.value}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-400/5 border border-amber-200">
              <Gift size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-foreground mb-1">{t("savings.loyaltyProgram")}</div>
                <div className="text-[10px] text-muted-foreground leading-relaxed">
                  {t("savings.loyaltyExplainer")}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">{t("savings.myVenues", { count: displayLoyalty.length })}</h2>
              <button
                onClick={() => setLinkVenueOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary cursor-pointer hover:bg-primary/15 transition-colors"
              >
                <Plus size={12} /> {t("savings.linkVenue")}
              </button>
            </div>

            {displayLoyalty.map((pot, i) => (
              <LoyaltyCard key={pot.id} pot={pot} index={i} isReal={hasRealLoyalty} onSpend={(p) => setSpendingAt(p)} onRedeem={handleRedeem} onEditLimit={(p) => setEditingLimit(p)} />
            ))}

            {/* Tip */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={13} className="text-primary" />
                <span className="text-xs font-bold">{t("savings.spendingTip")}</span>
              </div>
              {[
                { icon: Shield, color: "text-primary", text: t("savings.tipSetCap") },
                { icon: Wallet, color: "text-amber-700", text: t("savings.tipConvertPoints") },
                { icon: Clock, color: "text-accent", text: t("savings.tipPointsExpire") },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-secondary/50">
                  <tip.icon size={12} className={cn("mt-0.5 shrink-0", tip.color)} />
                  <span className="text-[10px] text-muted-foreground">{tip.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── CORPORATE T&E ── */}
        {tab === "corporate" && (
          <motion.div key="corporate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

            {/* Header banner */}
            <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-4">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/6 via-transparent to-primary/4 pointer-events-none" />
              <div className="relative flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-sky-400 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-black text-foreground">{t("savings.corporateTitle")}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{t("savings.corporateSubtitle")}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: t("savings.expensesSubmitted"), value: `XAF ${(totalExpenses / 1000).toFixed(0)}K`, color: "text-foreground" },
                  { label: t("savings.pending"), value: `XAF ${(pendingExpenses / 1000).toFixed(0)}K`, color: "text-amber-700" },
                  { label: t("savings.activeCards"), value: `${CORPORATE_CARDS.length}`, color: "text-primary" },
                ].map(s => (
                  <div key={s.label} className="bg-secondary/60 rounded-xl p-2.5 text-center">
                    <div className={cn("text-sm font-black font-mono", s.color)}>{s.value}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Corporate cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">{t("savings.employeeCards", { count: displayCards.length })}</h3>
                <button
                  onClick={() => setNewCardOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary cursor-pointer hover:bg-primary/15 transition-colors"
                >
                  <Plus size={12} /> {t("savings.newCard")}
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {displayCards.map((card, i) => <CorporateCardWidget key={card.id} card={card} index={i} />)}
              </div>
            </div>

            {/* Expense categories summary */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="text-xs font-bold mb-3">{t("savings.expensesByCategory")}</div>
              <div className="flex flex-wrap gap-2">
                {(["transport", "meals", "hotel", "fuel"] as ExpenseReport["category"][]).map(cat => {
                  const c = EXPENSE_CATEGORIES[cat];
                  const CatIcon = c.icon;
                  const total = EXPENSE_REPORTS.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
                  return (
                    <div key={cat} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/60 border border-border">
                      <CatIcon size={12} className={c.color} />
                      <div>
                        <div className="text-[10px] text-muted-foreground">{t(c.labelKey)}</div>
                        <div className="text-xs font-bold font-mono">{t("fundraise.xaf")} {total.toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expense reports */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">{t("savings.recentReports")}</h3>
                <button
                  onClick={() => setSubmitExpenseOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary cursor-pointer hover:bg-primary/15 transition-colors"
                >
                  <Plus size={12} /> {t("savings.submit")}
                </button>
              </div>
              {displayExpenses.map(exp => <ExpenseRow key={exp.id} exp={exp} />)}
            </div>

            {/* Policy info */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-secondary/60 border border-border">
              <Shield size={13} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {t("savings.expensePolicy")}
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      <NewPotModal open={newPotOpen} onClose={() => setNewPotOpen(false)} onCreate={handleCreatePot} />

      {contributing && (
        <ContributeModal
          title={contributing.kind === "product" ? `${t("savings.invest")} — ${t(contributing.item.name)}` : `${t("savings.fund")} — ${t(contributing.item.name)}`}
          currency={contributing.item.currency}
          minAmount={contributing.kind === "product" ? (contributing.item as InvestmentProduct).minAmount : undefined}
          presets={presetsFor(contributing.kind === "product" ? (contributing.item as InvestmentProduct).minAmount : undefined)}
          confirming={confirming}
          onConfirm={handleConfirmContribute}
          onClose={() => setContributing(null)}
        />
      )}

      {newCircleOpen && (
        <NewCircleModal currency={currency} creating={creatingCircle} onCreate={handleCreateCircle} onClose={() => setNewCircleOpen(false)} />
      )}

      {linkVenueOpen && (
        <LinkVenueModal creating={linkingVenue} onCreate={handleLinkVenue} onClose={() => setLinkVenueOpen(false)} />
      )}

      {editingLimit && (
        <EditLimitDialog userId={currentUser?.id} accountId={hasRealLoyalty ? editingLimit.id : undefined} venueName={editingLimit.venueName} currency={editingLimit.currency} current={editingLimit.spendLimit} onClose={() => setEditingLimit(null)} />
      )}
      {spendingAt && (
        <ContributeModal
          title={`${t("savings.spendHere")} — ${spendingAt.venueName}`}
          currency={spendingAt.currency}
          presets={presetsFor()}
          confirming={spending}
          onConfirm={handleConfirmSpend}
          onClose={() => setSpendingAt(null)}
        />
      )}

      {newCardOpen && (
        <NewCardModal currency={currency} creating={creatingCard} onCreate={handleCreateCard} onClose={() => setNewCardOpen(false)} />
      )}

      {submitExpenseOpen && (
        <SubmitExpenseModal currency={currency} submitting={submittingExpense} onSubmit={handleSubmitExpense} onClose={() => setSubmitExpenseOpen(false)} />
      )}
    </div>
  );
}
