import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  TrendingUp, TrendingDown, Activity, DollarSign, Zap,
  ArrowUpRight, ArrowDownLeft, RefreshCw, Shield, Globe,
  ChevronRight, BarChart3, Users, Wifi, AlertTriangle,
  CheckCircle2, Clock, Layers, PieChart, Flag, Star,
  MonitorPlay, Building, Landmark, PiggyBank, Send, Plane,
  HandHeart, CreditCard, History, Settings, Wallet, PlugZap, FileDown, UserCog, SlidersHorizontal, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useProfileFeatures, useMyPermissionsQuery } from "@/hooks/use-backend.ts";
import { generateTechAnalysisPDF } from "./_components/tech-analysis-pdf.ts";
import UsersPanel from "./_components/users-panel.tsx";
import TransactionsPanel from "./_components/transactions-panel.tsx";
import StaffPanel from "./_components/staff-panel.tsx";
import EscalationsPanel from "./_components/escalations-panel.tsx";
import OperationsPanel from "./_components/operations-panel.tsx";
import AuditPanel from "./_components/audit-panel.tsx";
import ConfigPanel from "./_components/config-panel.tsx";
import AccessPanel from "./_components/access-panel.tsx";
import OrganisationPanel from "../organisation/_components/organisation-panel.tsx";
import PartnersPanel from "./_components/partners-panel.tsx";
import { useProfile, getDefaultProfile } from "@/contexts/profile-context.tsx";
import type { ProfileType } from "@/contexts/profile-context.tsx";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, LineChart, Line, CartesianGrid, PieChart as RechartsPie, Pie, Cell
} from "recharts";

/* ─── Types ─────────────────────────────────────────────────── */

interface LiveTx {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  corridor: string;
  marginPct: number;
  fxProvider: string;
  fxRate: number;
  fxCost: number;
  profit: number;
  status: "processing" | "completed" | "flagged";
  timestamp: string;
  type: "remittance" | "p2p" | "payment" | "group";
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
}

/* ─── Mock data generators ───────────────────────────────────── */

const CORRIDORS = ["CDF→XAF", "XAF→XOF", "USD→CDF", "EUR→XAF", "GBP→XOF", "USD→XAF"];
const FX_PROVIDERS = ["BIS Marketplace", "Oanda Pro", "Wise FX", "Currencycloud", "OpenFX"];
const NAMES_FROM = ["Amara K.", "Oumar D.", "Fatou B.", "Kofi A.", "Marie L.", "Jean P.", "Ngozi E.", "Samir R."];
const NAMES_TO = ["Mwana S.", "CNSS RDC", "Kivu SARL", "Ubuntu NGO", "Dupont & Fils", "ProCredit", "AfricaRe"];
const TX_TYPES: LiveTx["type"][] = ["remittance", "p2p", "payment", "group"];

let txCounter = 1;
function generateTx(): LiveTx {
  const amount = Math.round((Math.random() * 9500 + 500) * 100) / 100;
  const marginPct = Math.round((5 + Math.random() * 5) * 10) / 10; // 5–10%
  const fxCostPct = Math.round((0.3 + Math.random() * 0.7) * 100) / 100; // 0.3–1%
  const fxCost = Math.round(amount * fxCostPct) / 100;
  const profit = Math.round(amount * (marginPct / 100) * 100) / 100;
  const corridorIdx = Math.floor(Math.random() * CORRIDORS.length);
  const currencies = CORRIDORS[corridorIdx].split("→");
  const statuses: LiveTx["status"][] = ["processing", "completed", "completed", "completed", "flagged"];

  return {
    id: `TX-${String(txCounter++).padStart(5, "0")}`,
    from: NAMES_FROM[Math.floor(Math.random() * NAMES_FROM.length)],
    to: NAMES_TO[Math.floor(Math.random() * NAMES_TO.length)],
    amount,
    currency: currencies[0],
    corridor: CORRIDORS[corridorIdx],
    marginPct,
    fxProvider: FX_PROVIDERS[Math.floor(Math.random() * FX_PROVIDERS.length)],
    fxRate: Math.round((580 + Math.random() * 20) * 100) / 100,
    fxCost,
    profit,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    timestamp: new Date().toISOString(),
    type: TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)],
  };
}

const INITIAL_TXS: LiveTx[] = Array.from({ length: 12 }, () => {
  const tx = generateTx();
  // Backdate slightly
  const ago = Math.floor(Math.random() * 300000);
  tx.timestamp = new Date(Date.now() - ago).toISOString();
  tx.status = "completed";
  return tx;
});

// Activity chart data (last 24 hours, hourly)
const activityData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  volume: Math.round(8000 + Math.random() * 40000),
  profit: Math.round(400 + Math.random() * 2000),
  txCount: Math.round(20 + Math.random() * 80),
}));

// Daily profit (last 30 days)
const dailyProfitData = Array.from({ length: 30 }, (_, i) => ({
  day: `Aug ${i + 1}`,
  profit: Math.round(12000 + Math.random() * 8000 + i * 200),
  volume: Math.round(120000 + Math.random() * 80000 + i * 1000),
}));

// FX cost by provider
const fxProviderData = [
  { name: "BIS Mkt", cost: 0.38, share: 34, color: "#4ade80" },
  { name: "Oanda Pro", cost: 0.52, share: 24, color: "#60a5fa" },
  { name: "Wise FX", cost: 0.61, share: 18, color: "#a78bfa" },
  { name: "Currencycloud", cost: 0.74, share: 14, color: "#fb923c" },
  { name: "OpenFX", cost: 0.88, share: 10, color: "#f472b6" },
];

// Corridor breakdown
const corridorData = [
  { corridor: "CDF→XAF", volume: 284000, margin: 7.4, txCount: 842 },
  { corridor: "USD→CDF", volume: 196000, margin: 8.1, txCount: 631 },
  { corridor: "XAF→XOF", volume: 147000, margin: 6.8, txCount: 480 },
  { corridor: "EUR→XAF", volume: 98000, margin: 9.2, txCount: 318 },
  { corridor: "GBP→XOF", volume: 72000, margin: 8.7, txCount: 214 },
  { corridor: "USD→XAF", volume: 54000, margin: 7.9, txCount: 163 },
];

/* ─── Pilot countries data ─────────────────────────────────── */

const PILOT_COUNTRIES = [
  {
    flag: "🇨🇫",
    name: "Central African Republic",
    abbr: "RCA",
    currency: "XAF",
    capital: "Bangui",
    population: "5.5M",
    pilotPhase: "Phase 1",
    status: "active",
    features: ["Mobile Money", "P2P Transfers", "Remittance", "Savings Groups"],
    metrics: { users: "12,400", volume: "XAF 1.8B", txMonth: "34,200" },
    color: "from-blue-900/60 to-blue-700/20",
    accent: "text-blue-700",
    borderAccent: "border-blue-200",
    bgAccent: "bg-blue-50",
  },
  {
    flag: "🇨🇬",
    name: "Congo Brazzaville",
    abbr: "Congo-B",
    currency: "XAF",
    capital: "Brazzaville",
    population: "6M",
    pilotPhase: "Phase 1",
    status: "active",
    features: ["Mobile Money", "Business Payments", "Fundraising", "Gov Collections"],
    metrics: { users: "18,750", volume: "XAF 3.1B", txMonth: "51,800" },
    color: "from-emerald-900/60 to-emerald-700/20",
    accent: "text-emerald-700",
    borderAccent: "border-emerald-200",
    bgAccent: "bg-emerald-50",
  },
];

const DEMO_PROFILES: { type: ProfileType; label: string; desc: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }[] = [
  { type: "personal", label: "Personal", desc: "Personal wallet & transfers", icon: Users, color: "text-emerald-700" },
  { type: "merchant", label: "Merchant", desc: "POS keypad, payment links, invoicing", icon: Building, color: "text-blue-700" },
  { type: "agent", label: "Agent", desc: "Cash-in/out, float, agent network", icon: Wifi, color: "text-orange-700" },
  { type: "treasury", label: "Treasury", desc: "Analytics, mandates, two-sig approvals", icon: TrendingUp, color: "text-primary" },
  { type: "public_institution", label: "Public Institution", desc: "Tax, payroll, sovereign ops", icon: Landmark, color: "text-amber-700" },
  { type: "ngo", label: "NGO / Civil Society", desc: "Donor collection, grants, payouts", icon: HandHeart, color: "text-rose-700" },
  { type: "group", label: "Group", desc: "Group pot, member accounts", icon: PiggyBank, color: "text-violet-700" },
  { type: "starter", label: "Starter", desc: "Quick setup, basic wallet", icon: Star, color: "text-cyan-700" },
];

const DEMO_PAGES = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/payments", label: "Payments", icon: CreditCard },
  { path: "/invest", label: "PayRus Invest", icon: TrendingUp },
  { path: "/fundraise", label: "Fundraising", icon: HandHeart },
  { path: "/savings", label: "Savings", icon: PiggyBank },
  { path: "/remittance", label: "FX & Remittance", icon: Send },
  { path: "/gov", label: "Gov Hub", icon: Landmark },
  { path: "/travel", label: "Travel", icon: Plane },
  { path: "/api-hub", label: "API Hub", icon: PlugZap },
  { path: "/transactions", label: "Transactions", icon: History },
  { path: "/settings", label: "Settings", icon: Settings },
];



function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold font-mono" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: LiveTx["status"] }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
      status === "completed" && "bg-primary/15 text-primary",
      status === "processing" && "bg-accent/15 text-accent",
      status === "flagged" && "bg-destructive/15 text-destructive",
    )}>
      {status === "completed" && <CheckCircle2 size={9} />}
      {status === "processing" && <Clock size={9} />}
      {status === "flagged" && <AlertTriangle size={9} />}
      {status}
    </span>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color, trend, delta
}: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; trend?: "up" | "down" | "neutral"; delta?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden">
      <div className={cn("absolute inset-0 opacity-[0.04] bg-gradient-to-br", color)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", color.replace("from-", "bg-").split(" ")[0] + "/15")}>
            <Icon size={15} className={color.includes("primary") ? "text-primary" : color.includes("accent") ? "text-accent" : color.includes("amber") ? "text-amber-700" : color.includes("violet") ? "text-violet-700" : "text-primary"} />
          </div>
        </div>
        <div className="text-2xl font-black font-mono tracking-tight text-foreground">{value}</div>
        <div className="flex items-center gap-1.5 mt-1">
          {trend === "up" && <TrendingUp size={10} className="text-primary" />}
          {trend === "down" && <TrendingDown size={10} className="text-destructive" />}
          {delta && <span className={cn("text-[10px] font-semibold", trend === "up" ? "text-primary" : trend === "down" ? "text-destructive" : "text-muted-foreground")}>{delta}</span>}
          <span className="text-[10px] text-muted-foreground">{sub}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */

export default function AdminDashboard() {
  const [liveTxs, setLiveTxs] = useState<LiveTx[]>(INITIAL_TXS);
  const [pulseCount, setPulseCount] = useState(0);
  const [totalProfit, setTotalProfit] = useState(214840);
  const [totalVolume, setTotalVolume] = useState(3847200);
  const [txCount, setTxCount] = useState(2648);
  const [avgMargin, setAvgMargin] = useState(7.3);
  const [newTxId, setNewTxId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "fx" | "corridors" | "pilot" | "demo" | "users" | "ledger" | "escalations" | "staff" | "operations" | "audit" | "config" | "access" | "organisations" | "partners">("users");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("common");
  const { lng } = useParams<{ lng: string }>();
  const { profile, setProfile } = useProfile();
  const base = `/${lng ?? "en"}`;

  // Feature flag read unconditionally (before any early return) per the
  // Rules of Hooks — the actual gate is applied further below, after every
  // hook in this component has been called.
  const isAdmin = profile?.type === "admin";
  const features = useProfileFeatures(profile?.type ?? undefined) ?? [];
  const permsQuery = useMyPermissionsQuery();
  const perms = permsQuery.data;
  const hasStaffAccess = !!perms && (perms.isSuperadmin || perms.users.read || perms.transactions.read);
  // Staff who reach this page through their database role (not the demo
  // "admin" profile) only get the operational tabs.
  const staffOnly = !isAdmin && !features.includes("admin_panel");

  // Simulate live tx stream
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const tx = generateTx();
      setLiveTxs((prev) => [tx, ...prev.slice(0, 49)]);
      setNewTxId(tx.id);
      setPulseCount((p) => p + 1);
      setTotalProfit((p) => Math.round((p + tx.profit) * 100) / 100);
      setTotalVolume((p) => Math.round((p + tx.amount) * 100) / 100);
      setTxCount((p) => p + 1);
      setAvgMargin((p) => Math.round((p * 0.97 + tx.marginPct * 0.03) * 10) / 10);
      setTimeout(() => setNewTxId(null), 1500);
    }, 2200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Gate: /admin used to have no route-level guard at all — any profile
  // could open the whole panel (list every user, pending profiles, blocked
  // transfers, the current FX margin), even though the mutations inside
  // were already password-gated. Mirrors AppLayout.tsx's own nav-item gate
  // (same public.profile_features / admin_panel key, admin-only by default,
  // adjustable from the Roles & Access tab) — while features are loading,
  // this keeps the panel hidden rather than briefly flashing it open.
  // Placed after every hook above so it stays Rules-of-Hooks-safe.
  if (staffOnly && permsQuery.isLoading) {
    return null;
  }
  if (staffOnly && !hasStaffAccess) {
    return <Navigate to={base} replace />;
  }

  const formatCompact = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  const allTabs = [
    { id: "users", label: "Manage Profiles", icon: UserCog },
    { id: "ledger", label: "Users & Transactions", icon: History },
    { id: "escalations", label: "Escalations", icon: AlertTriangle },
    { id: "staff", label: "Staff & Permissions", icon: Shield },
    { id: "operations", label: "Operations", icon: Layers },
    { id: "audit", label: "Audit Log", icon: History },
    { id: "config", label: "Configuration", icon: SlidersHorizontal },
    { id: "access", label: "Roles & Access", icon: ShieldCheck },
    { id: "organisations", label: "Organisations", icon: Building },
    { id: "partners", label: "Partners & pricing", icon: Landmark },
    { id: "pilot", label: "Pilot Countries", icon: Flag },
    { id: "demo", label: "Demo Access", icon: MonitorPlay },
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "transactions", label: "Live Txns", icon: Activity },
    { id: "fx", label: "FX Costs", icon: Globe },
    { id: "corridors", label: "Corridors", icon: Layers },
  ] as const;
  // Database roles decide what a real staff account sees: support agents get
  // the four operational tabs; admin/superadmin also get Operations, Audit Log,
  // Configuration and Roles & Access — the same set the ops-console offers.
  const STAFF_TABS = ["users", "ledger", "escalations", "staff"];
  const ADMIN_TIER_TABS = [...STAFF_TABS, "operations", "audit", "config", "access", "organisations", "partners"];
  const allowedIds = perms?.isAdmin ? ADMIN_TIER_TABS : STAFF_TABS;
  const tabs = staffOnly ? allTabs.filter((tab) => allowedIds.includes(tab.id)) : allTabs;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader title={t("profile.badge.admin")} className="mb-4 md:mb-6" />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield size={14} className="text-primary" />
            <span className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase">{t("admin.payrusAdmin")}</span>
          </div>
          <h1 className="text-xl font-black text-foreground tracking-tight">{t("admin.businessIntelligence")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] text-primary font-semibold">{t("admin.demo")}</span>
            <span className="text-[11px] text-muted-foreground font-mono">{pulseCount} {t("admin.events")}</span>
          </div>
          <button
            onClick={() => generateTechAnalysisPDF()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-[11px] font-semibold text-violet-700 cursor-pointer hover:bg-violet-100 transition-colors"
          >
            <FileDown size={13} /> {t("admin.techAnalysisPdf")}
          </button>
          <button type="button" aria-label={t("cta.refresh")} title={t("cta.refresh")} onClick={() => { void queryClient.invalidateQueries(); toast.success(t("cta.refreshed")); }} className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center cursor-pointer hover:bg-secondary/80 transition-colors">
            <RefreshCw size={13} className="text-muted-foreground" />
          </button>
        </div>
      </motion.div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Profit Today", value: formatCompact(totalProfit), sub: "net after FX", icon: DollarSign, color: "from-primary to-emerald-400", trend: "up" as const, delta: "+12.4%" },
          { label: "Transaction Volume", value: formatCompact(totalVolume), sub: "gross today", icon: TrendingUp, color: "from-accent to-sky-400", trend: "up" as const, delta: "+8.1%" },
          { label: "Avg Margin", value: `${avgMargin}%`, sub: "per transaction", icon: PieChart, color: "from-amber-400 to-yellow-300", trend: "up" as const, delta: "target 7–10%" },
          { label: "Transactions", value: txCount.toLocaleString(), sub: "total today", icon: Activity, color: "from-violet-500 to-purple-400", trend: "up" as const, delta: `+${Math.round(pulseCount)}` },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <KpiCard {...kpi} />
          </motion.div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon size={13} />
            <span className="hidden sm:inline">{t(tab.label)}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">

        {/* ── MANAGE PROFILES ── */}
        {activeTab === "users" && (
          <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <UsersPanel />
          </motion.div>
        )}

        {/* ── ALL TRANSACTIONS (real ledger) ── */}
        {activeTab === "ledger" && (
          <motion.div key="ledger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <TransactionsPanel />
          </motion.div>
        )}

        {/* ── ESCALATIONS ── */}
        {activeTab === "escalations" && (
          <motion.div key="escalations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <EscalationsPanel />
          </motion.div>
        )}

        {/* ── STAFF ROLES + CRUD MATRIX ── */}
        {activeTab === "staff" && (
          <motion.div key="staff" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <StaffPanel />
          </motion.div>
        )}

        {/* ── OPERATIONS (mirrors ops-console Configuration lists) ── */}
        {activeTab === "operations" && (
          <motion.div key="operations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <OperationsPanel />
          </motion.div>
        )}

        {/* ── AUDIT LOG ── */}
        {activeTab === "audit" && (
          <motion.div key="audit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <AuditPanel />
          </motion.div>
        )}

        {/* ── CONFIGURATION ── */}
        {activeTab === "config" && (
          <motion.div key="config" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ConfigPanel />
          </motion.div>
        )}

        {/* ── ROLES & ACCESS ── */}
        {activeTab === "access" && (
          <motion.div key="access" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <AccessPanel />
          </motion.div>
        )}

        {/* ── PARTNERS (contracts, readiness, integration, pricing policy) ── */}
        {activeTab === "partners" && (
          <motion.div key="partners" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <PartnersPanel />
          </motion.div>
        )}

        {/* ── ORGANISATIONS (tree, scoped roles, cases) ── */}
        {activeTab === "organisations" && (
          <motion.div key="organisations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <OrganisationPanel />
          </motion.div>
        )}

        {/* ── PILOT COUNTRIES ── */}
        {activeTab === "pilot" && (
          <motion.div key="pilot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

            {/* Header banner */}
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <Flag size={22} className="text-primary" />
              </div>
              <div>
                <div className="font-black text-base">{t("admin.pilotProgramCemacZone")}</div>
                <div className="text-xs text-muted-foreground">
                  <Trans i18nKey="admin.pilotingIn" values={{ first: t("admin.centralAfricanRepublic"), second: t("admin.congoBrazzaville") }} components={{ b: <span className="text-foreground font-semibold" /> }} />
                </div>
              </div>
              <div className="ml-auto shrink-0">
                <span className="flex items-center gap-1.5 text-[10px] font-black bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t("admin.2CountriesActive")}
                </span>
              </div>
            </div>

            {/* Country cards */}
            {PILOT_COUNTRIES.map((c, i) => (
              <motion.div key={c.abbr} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Country banner */}
                <div className={cn("bg-gradient-to-br p-5 flex items-start gap-4", c.color)}>
                  <div className="text-5xl leading-none">{c.flag}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-lg">{c.name}</h3>
                      <span className={cn("text-[9px] font-black border px-2 py-0.5 rounded-full uppercase tracking-wider", c.borderAccent, c.bgAccent, c.accent)}>
                        {c.pilotPhase} {t("admin.active")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t("admin.capitalPopulationCurrency", { capital: c.capital, population: c.population, currency: c.currency })}</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                  {[
                    { label: "Registered Users", value: c.metrics.users },
                    { label: "Monthly Volume", value: c.metrics.volume },
                    { label: "Transactions / mo", value: c.metrics.txMonth },
                  ].map(m => (
                    <div key={m.label} className="p-3 text-center">
                      <div className={cn("font-black text-base font-mono", c.accent)}>{m.value}</div>
                      <div className="text-[10px] text-muted-foreground">{t(m.label)}</div>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="p-4">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">{t("admin.activatedFeatures")}</div>
                  <div className="flex flex-wrap gap-2">
                    {c.features.map(f => (
                      <span key={f} className={cn("flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-xl border", c.bgAccent, c.borderAccent, c.accent)}>
                        <CheckCircle2 size={11} />{f}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Roadmap */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="font-bold text-sm">{t("admin.pilotRoadmap")}</div>
              {[
                { phase: "Phase 1 · Q3 2026", label: "RCA & Congo-B launch — Mobile money, P2P, remittance", done: true },
                { phase: "Phase 2 · Q4 2026", label: "Business & Gov accounts — Payroll, tax collection, API Hub", done: false },
                { phase: "Phase 3 · Q1 2027", label: "Full CEMAC rollout — Cameroon, Chad, Gabon, Equatorial Guinea", done: false },
                { phase: "Phase 4 · 2027", label: "ECOWAS expansion — Nigeria, Côte d'Ivoire, Senegal, Ghana", done: false },
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                    r.done ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary border-border text-muted-foreground")}>
                    {r.done ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                  </div>
                  <div>
                    <div className={cn("text-[10px] font-black uppercase tracking-wider", r.done ? "text-primary" : "text-muted-foreground")}>{r.phase}</div>
                    <div className="text-xs text-muted-foreground">{t(r.label)}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── DEMO ACCESS ── */}
        {activeTab === "demo" && (
          <motion.div key="demo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <Star size={16} className="text-amber-700 shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-semibold">{t("admin.systemAdministratorDemoMode")}</span> {t("admin.switchToAnyProfile")}
              </div>
            </div>

            {/* Profile switcher */}
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("admin.switchProfilePreview")}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DEMO_PROFILES.map((p) => (
                  <button
                    key={p.type}
                    onClick={() => {
                      setProfile(getDefaultProfile(p.type));
                      navigate(`${base}/`);
                    }}
                    className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors cursor-pointer text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <p.icon size={18} className={p.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{t(p.label)}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{t(p.desc)}</div>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Direct page navigation */}
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("admin.jumpToAnyPage")}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DEMO_PAGES.map((page) => (
                  <button
                    key={page.path}
                    onClick={() => navigate(`${base}${page.path}`)}
                    className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer text-left group"
                  >
                    <page.icon size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors truncate">{t(page.label)}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

            {/* Profit + Volume chart */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-semibold text-foreground">{t("admin.dailyProfitGrowth")}</div>
                  <div className="text-[10px] text-muted-foreground">{t("admin.last30DaysUsd")}</div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />{t("admin.profit")}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" />{t("admin.volume1k")}</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyProfitData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.66 0.20 138)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="oklch(0.66 0.20 138)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.17 218)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="oklch(0.65 0.17 218)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 8 }} axisLine={false} tickLine={false} interval={4} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="profit" name="Profit $" stroke="oklch(0.66 0.20 138)" strokeWidth={2} fill="url(#gProfit)" dot={false} />
                  <Area type="monotone" dataKey="volume" name="Volume /100" stroke="oklch(0.65 0.17 218)" strokeWidth={1.5} fill="url(#gVolume)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Hourly activity */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-semibold text-foreground">{t("admin.hourlyTransactionActivity")}</div>
                  <div className="text-[10px] text-muted-foreground">{t("admin.last24HoursCount")}</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={activityData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="hour" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 8 }} axisLine={false} tickLine={false} interval={3} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="txCount" name="Transactions" fill="oklch(0.66 0.20 138)" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Mini stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Avg FX Cost", value: "0.52%", icon: Globe, color: "text-accent", sub: "per transaction" },
                { label: "Flagged Txns", value: "14", icon: AlertTriangle, color: "text-destructive", sub: "needs review" },
                { label: "Active Users", value: "1,842", icon: Users, color: "text-primary", sub: "online now" },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-3">
                  <s.icon size={14} className={cn("mb-2", s.color)} />
                  <div className="text-lg font-black font-mono text-foreground">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{t(s.label)}</div>
                  <div className="text-[10px] text-muted-foreground/60">{t(s.sub)}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "transactions" && (
          <motion.div key="transactions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-semibold text-foreground">{t("admin.liveTransactionMonitor")}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{liveTxs.length} {t("admin.recent")}</span>
              </div>

              {/* Header row */}
              <div className="hidden md:grid grid-cols-[1.5fr_1.2fr_0.8fr_0.7fr_0.7fr_0.8fr_0.7fr] gap-2 px-4 py-2 border-b border-border bg-secondary/50">
                {["Transaction", "Corridor / Provider", "Amount", "Margin", "FX Cost", "Profit", "Status"].map((h) => (
                  <span key={h} className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{t(h)}</span>
                ))}
              </div>

              <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {liveTxs.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, backgroundColor: "oklch(0.66 0.20 138 / 0.12)" }}
                      animate={{ opacity: 1, backgroundColor: "oklch(0 0 0 / 0)" }}
                      transition={{ duration: 1.2 }}
                      className={cn(
                        "grid md:grid-cols-[1.5fr_1.2fr_0.8fr_0.7fr_0.7fr_0.8fr_0.7fr] gap-2 px-4 py-3 hover:bg-secondary/30 transition-colors",
                        newTxId === tx.id && "bg-primary/8"
                      )}
                    >
                      {/* Transaction */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {tx.type === "remittance" && <ArrowUpRight size={11} className="text-primary shrink-0" />}
                          {tx.type === "p2p" && <Wifi size={11} className="text-accent shrink-0" />}
                          {tx.type === "payment" && <DollarSign size={11} className="text-amber-700 shrink-0" />}
                          {tx.type === "group" && <Users size={11} className="text-violet-700 shrink-0" />}
                          <span className="text-xs font-mono text-foreground font-semibold truncate">{tx.id}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{tx.from} → {tx.to}</div>
                        <div className="text-[9px] text-muted-foreground/60">{new Date(tx.timestamp).toLocaleTimeString()}</div>
                      </div>
                      {/* Corridor */}
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-accent font-mono">{tx.corridor}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{tx.fxProvider}</div>
                        <div className="text-[9px] text-muted-foreground/60">{t("admin.rate")} {tx.fxRate}</div>
                      </div>
                      {/* Amount */}
                      <div className="font-mono">
                        <div className="text-xs font-bold text-foreground">{tx.amount.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">{tx.currency}</div>
                      </div>
                      {/* Margin */}
                      <div>
                        <div className={cn("text-xs font-bold font-mono", tx.marginPct >= 8 ? "text-primary" : tx.marginPct >= 6 ? "text-amber-700" : "text-muted-foreground")}>
                          {tx.marginPct}%
                        </div>
                        <div className="text-[9px] text-muted-foreground">{t("admin.510Target")}</div>
                      </div>
                      {/* FX Cost */}
                      <div>
                        <div className="text-xs font-mono text-accent">${tx.fxCost.toFixed(2)}</div>
                        <div className="text-[9px] text-muted-foreground">{t("admin.bestRate")}</div>
                      </div>
                      {/* Profit */}
                      <div>
                        <div className="text-xs font-bold font-mono text-primary">+${tx.profit.toFixed(2)}</div>
                        <div className="text-[9px] text-muted-foreground">{t("admin.netProfit")}</div>
                      </div>
                      {/* Status */}
                      <div className="flex items-start">
                        <StatusBadge status={tx.status} />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "fx" && (
          <motion.div key="fx" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="text-xs font-semibold text-foreground mb-1">{t("admin.fxProviderCostComparison")}</div>
              <div className="text-[10px] text-muted-foreground mb-4">{t("admin.averageCostPerTransaction")}</div>
              <div className="space-y-3">
                {fxProviderData.map((p, i) => (
                  <motion.div key={p.name} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-xs font-semibold text-foreground">{p.name}</span>
                        {i === 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">{t("admin.cheapest")}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-foreground">{p.cost}%</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{p.share}{t("admin.share")}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.cost / 1) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.08 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* FX share pie + cost line */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="text-xs font-semibold text-foreground mb-4">{t("admin.providerMarketShare")}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPie>
                    <Pie data={fxProviderData} dataKey="share" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {fxProviderData.map((p) => <Cell key={p.name} fill={p.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {fxProviderData.map((p) => (
                    <span key={p.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="text-xs font-semibold text-foreground mb-4">{t("admin.hourlyFxSavingsVs")}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={activityData.slice(0, 12)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="oklch(0.22 0.02 240)" strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 8 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="profit" name="FX Savings $" stroke="oklch(0.66 0.20 138)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Best rate alert */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary/8 border border-primary/20">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Zap size={14} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground">{t("admin.bisMarketplaceRoutingActive")}</div>
                <div className="text-[11px] text-muted-foreground">{t("admin.allCdfXafCorridors")}</div>
              </div>
              <ChevronRight size={13} className="text-muted-foreground shrink-0" />
            </div>
          </motion.div>
        )}

        {activeTab === "corridors" && (
          <motion.div key="corridors" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs font-semibold text-foreground">{t("admin.corridorPerformance")}</div>
                <div className="text-[10px] text-muted-foreground">{t("admin.volumeMarginAndTransaction")}</div>
              </div>
              <div className="hidden md:grid grid-cols-4 gap-2 px-4 py-2 border-b border-border bg-secondary/50">
                {["Corridor", "Volume (USD)", "Avg Margin", "Tx Count"].map((h) => (
                  <span key={h} className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{t(h)}</span>
                ))}
              </div>
              <div className="divide-y divide-border">
                {corridorData.map((c, i) => (
                  <motion.div key={c.corridor} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="grid md:grid-cols-4 gap-2 px-4 py-3.5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                        <ArrowDownLeft size={13} className="text-accent" />
                      </div>
                      <span className="text-xs font-mono font-bold text-foreground">{c.corridor}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono text-foreground">${c.volume.toLocaleString()}</div>
                      <div className="mt-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${(c.volume / 284000) * 100}%` }} />
                      </div>
                    </div>
                    <div className={cn("text-xs font-bold font-mono", c.margin >= 8.5 ? "text-primary" : c.margin >= 7 ? "text-amber-700" : "text-muted-foreground")}>
                      {c.margin}%
                      <div className="text-[9px] font-normal text-muted-foreground">{t("admin.ofVolume")}</div>
                    </div>
                    <div className="text-xs font-mono text-foreground">
                      {c.txCount.toLocaleString()}
                      <div className="text-[9px] text-muted-foreground">{t("admin.transactions")}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Corridor volume bar chart */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="text-xs font-semibold text-foreground mb-1">{t("admin.volumeByCorridor")}</div>
              <div className="text-[10px] text-muted-foreground mb-4">{t("admin.usdEquivalentToday")}</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={corridorData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} layout="vertical">
                  <XAxis type="number" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="corridor" tick={{ fill: "oklch(0.75 0.01 240)", fontSize: 9 }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="volume" name="Volume $" fill="oklch(0.65 0.17 218)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
