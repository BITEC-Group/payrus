import { formatCompact } from "@/lib/format-compact.ts";
import { useState } from "react";
import { localizeTransferNote } from "@/lib/db-notifications.ts";
import { txTypeLabel } from "@/lib/i18n-labels.ts";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Landmark, Shield, CheckCircle2, AlertCircle, Clock, Wifi, WifiOff,
  ChevronRight, ChevronDown, RefreshCw, Download, Upload, Zap,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Building2,
  Globe, Database, FileText, Users, Plus, Settings, Search
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useProfile } from "@/contexts/profile-context.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useRecentTransfersForUser, useWalletViewsForUser } from "@/hooks/use-backend.ts";

// Real institutional ProfileTypes (src/contexts/profile-context.tsx) this
// page is evidently meant for — it previously had no access gate at all
// (any profile could view government treasury data), fixed alongside the
// same audit that wired BALANCES/RECENT_TRANSACTIONS to real data.
const GOV_PROFILES = new Set(["government", "state_entity", "admin"]);

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "pending" | "error" | "inactive";
type Currency = "CDF" | "USD" | "EUR" | "XAF" | "XOF" | "GBP" | "AOA" | "AED" | "CNY";

interface Integration {
  id: string;
  key: string;
  category: "tax" | "customs" | "treasury" | "payroll" | "fx" | "social";
  status: IntegrationStatus;
  lastSync: string;
  transactionsToday: number;
  volumeUSD: number;
  endpoint: string;
}

interface MultiCurrencyBalance {
  currency: Currency;
  balance: number;
  change: number;
  flag: string;
}

interface Transaction {
  id: string;
  type: "collection" | "disbursement" | "transfer";
  description: string;
  amount: number;
  currency: Currency;
  source: string;
  status: "completed" | "pending" | "processing";
  time: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const INTEGRATIONS: Integration[] = [
  { id: "sigtas",  key: "sigtas",  category: "tax",      status: "connected", lastSync: "2 min ago",   transactionsToday: 1842, volumeUSD: 4320000,  endpoint: "https://sigtas.gov/api/v2" },
  { id: "sydonia", key: "sydonia", category: "customs",  status: "connected", lastSync: "5 min ago",   transactionsToday: 634,  volumeUSD: 2180000,  endpoint: "https://sydonia.customs.gov/api" },
  { id: "ifmis",   key: "ifmis",   category: "treasury", status: "connected", lastSync: "1 min ago",   transactionsToday: 287,  volumeUSD: 8900000,  endpoint: "https://ifmis.minfin.gov/api/v3" },
  { id: "ippis",   key: "ippis",   category: "payroll",  status: "connected", lastSync: "12 min ago",  transactionsToday: 96200, volumeUSD: 12400000, endpoint: "https://ippis.gov/payroll/api" },
  { id: "swift",   key: "swift",   category: "fx",       status: "connected", lastSync: "Just now",    transactionsToday: 43,   volumeUSD: 6700000,  endpoint: "swift://BIC.GOVMFCD" },
  { id: "sepa",    key: "sepa",    category: "fx",       status: "pending",   lastSync: "—",           transactionsToday: 0,    volumeUSD: 0,        endpoint: "sepa://pending-verification" },
  { id: "cnss",    key: "cnss",    category: "social",   status: "pending",   lastSync: "—",           transactionsToday: 0,    volumeUSD: 0,        endpoint: "https://cnss.gov/api" },
  { id: "rra",     key: "rra",     category: "tax",      status: "error",     lastSync: "3h ago",      transactionsToday: 0,    volumeUSD: 0,        endpoint: "https://rra.tax.gov/api" },
];

// Launch-phase priority currencies (XAF/AOA) lead the treasury view; AED/CNY are visible
// for completeness but are not launch-priority balances.
const BALANCES: MultiCurrencyBalance[] = [
  { currency: "XAF", balance: 3200000000,  change: +1.1,  flag: "🌍" },
  { currency: "AOA", balance: 1480000000,  change: +1.6,  flag: "🇦🇴" },
  { currency: "CDF", balance: 18500000000, change: +2.3,  flag: "🇨🇩" },
  { currency: "USD", balance: 6607143,     change: +0.8,  flag: "🇺🇸" },
  { currency: "EUR", balance: 2840000,     change: -0.4,  flag: "🇪🇺" },
  { currency: "AED", balance: 940000,      change: +0.2,  flag: "🇦🇪" },
  { currency: "CNY", balance: 5120000,     change: +0.3,  flag: "🇨🇳" },
];

const DAILY_COLLECTIONS = [
  { day: "Mon", tax: 820, customs: 340, other: 190 },
  { day: "Tue", tax: 1100, customs: 420, other: 240 },
  { day: "Wed", tax: 740, customs: 280, other: 150 },
  { day: "Thu", tax: 1380, customs: 510, other: 320 },
  { day: "Fri", tax: 960, customs: 380, other: 210 },
  { day: "Sat", tax: 420, customs: 160, other: 90 },
  { day: "Sun", tax: 1240, customs: 460, other: 280 },
];

const RECENT_TRANSACTIONS: Transaction[] = [
  { id: "t1", type: "collection",   description: "gov.tx.vatCollection",       amount: 420000,  currency: "USD", source: "SIGTAS",  status: "completed",  time: "14:32" },
  { id: "t2", type: "disbursement", description: "gov.tx.civilServantSalaries", amount: 2800000, currency: "CDF", source: "IPPIS",   status: "processing", time: "13:00" },
  { id: "t3", type: "collection",   description: "gov.tx.customsDuties",       amount: 185000,  currency: "USD", source: "SYDONIA", status: "completed",  time: "12:15" },
  { id: "t4", type: "transfer",     description: "gov.tx.treasuryTransfer",    amount: 1500000, currency: "USD", source: "IFMIS",   status: "completed",  time: "11:48" },
  { id: "t5", type: "disbursement", description: "gov.tx.bondRepayment",       amount: 820000,  currency: "EUR", source: "SWIFT",   status: "pending",    time: "10:30" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: IntegrationStatus) {
  return {
    connected: "text-emerald-700",
    pending:   "text-amber-700",
    error:     "text-destructive",
    inactive:  "text-muted-foreground",
  }[s];
}
function statusBg(s: IntegrationStatus) {
  return {
    connected: "bg-emerald-50 border-emerald-200",
    pending:   "bg-amber-50 border-amber-200",
    error:     "bg-destructive/10 border-destructive/25",
    inactive:  "bg-secondary border-border",
  }[s];
}
function statusDot(s: IntegrationStatus) {
  return {
    connected: "bg-emerald-400 animate-pulse",
    pending:   "bg-amber-400",
    error:     "bg-destructive",
    inactive:  "bg-muted-foreground",
  }[s];
}
function categoryIcon(c: Integration["category"]) {
  return {
    tax:      FileText,
    customs:  Globe,
    treasury: Landmark,
    payroll:  Users,
    fx:       ArrowUpRight,
    social:   Shield,
  }[c];
}
function categoryColor(c: Integration["category"]) {
  return {
    tax:      "text-amber-700 bg-amber-50",
    customs:  "text-blue-700 bg-blue-50",
    treasury: "text-violet-700 bg-violet-50",
    payroll:  "text-emerald-700 bg-emerald-50",
    fx:       "text-cyan-700 bg-cyan-50",
    social:   "text-rose-700 bg-rose-50",
  }[c];
}
function compactNumber(n: number) {
  return formatCompact(n, n >= 1_000_000_000 ? 2 : 1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TooltipProps2 { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string; }
function ChartTooltip({ active, payload, label }: TooltipProps2) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs space-y-1">
      <div className="font-semibold text-foreground">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="text-muted-foreground">{p.dataKey}: <span className="text-foreground font-mono">${compactNumber(p.value * 1000)}</span></div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GovHub() {
  const { t } = useTranslation("common");
  const { profile } = useProfile();
  const { lng } = useParams<{ lng: string }>();
  const navigate = useNavigate();
  const requested = (action: string) => toast.success(t("cta.requested", { action }));

  const [activeTab, setActiveTab] = useState<"overview" | "integrations" | "collections" | "disbursements">("overview");
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const currentUser = useCurrentAppUser();
  const realWallets = useWalletViewsForUser(currentUser?.id);
  const realTransfers = useRecentTransfersForUser(currentUser?.id, 5);

  const locale = lng ?? "en";

  if (!profile || !GOV_PROFILES.has(profile.type)) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <Landmark size={40} className="text-muted-foreground mx-auto mb-3" />
          <div className="text-base font-semibold text-foreground">{t("gov.restricted")}</div>
          <div className="text-sm text-muted-foreground mt-1">{t("gov.restrictedDesc")}</div>
        </div>
      </div>
    );
  }

  // Real balances/activity when signed in with real wallets; anonymous/no-
  // wallets-yet visitors keep the existing static demo data — same
  // fallback convention as dashboard/page.tsx.
  const hasReal = !!realWallets && realWallets.length > 0;
  const balancesToShow = hasReal
    ? realWallets.map(w => ({ currency: w.currency as Currency, balance: w.balance, change: 0, flag: w.flag }))
    : BALANCES;
  const REAL_TX_CREDIT_TYPES = new Set(["deposit", "convert_in"]);
  const recentTxToShow = hasReal && realTransfers && realTransfers.length > 0
    ? realTransfers.map(tr => ({
        id: tr.id, type: (REAL_TX_CREDIT_TYPES.has(tr.type) ? "collection" : "disbursement") as Transaction["type"],
        description: tr.note ? localizeTransferNote(tr.note, t) : tr.reference, amount: tr.amount, currency: tr.currency as Currency,
        source: txTypeLabel(t, tr.type), status: "completed" as const, time: new Date(tr.createdAt).toLocaleTimeString(),
      }))
    : RECENT_TRANSACTIONS;

  const connectedCount = INTEGRATIONS.filter(i => i.status === "connected").length;
  const totalVolumeUSD = INTEGRATIONS.reduce((acc, i) => acc + i.volumeUSD, 0);
  const totalTxToday   = INTEGRATIONS.reduce((acc, i) => acc + i.transactionsToday, 0);

  const filteredIntegrations = INTEGRATIONS.filter(i =>
    !searchQuery || t(`gov.sys.${i.key}`).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const TABS = [
    { id: "overview",       label: t("gov.tab.overview"),       icon: LayoutGrid },
    { id: "integrations",   label: t("gov.tab.integrations"),   icon: Database },
    { id: "collections",    label: t("gov.tab.collections"),    icon: ArrowDownLeft },
    { id: "disbursements",  label: t("gov.tab.disbursements"),  icon: ArrowUpRight },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Back navigation */}
      <div className="px-6 pt-6 pb-0 shrink-0">
        <PageHeader title={t("gov.title")} className="mb-4 md:mb-6" />
      </div>
      {/* ── Header ── */}
      <div className="px-6 pt-0 pb-4 border-b border-border bg-sidebar/40">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Landmark size={20} className="text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">{t("gov.title")}</h1>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{profile?.tier}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{profile?.name} · {t("gov.subtitle")}</p>
            </div>
          </div>
          {/* Top KPIs */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700">{connectedCount}/{INTEGRATIONS.length} {t("gov.connected")}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border">
              <Zap size={12} className="text-primary" />
              <span className="text-xs font-medium text-foreground">{totalTxToday.toLocaleString()} {t("gov.txToday")}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border">
              <TrendingUp size={12} className="text-primary" />
              <span className="text-xs font-medium text-foreground">${compactNumber(totalVolumeUSD)} {t("gov.volumeToday")}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

              {/* Multicurrency balances */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">{t("gov.treasuryBalances")}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {balancesToShow.map((b, i) => (
                    <motion.div key={b.currency} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-2xl bg-card border border-border p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl">{b.flag}</span>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                          b.change >= 0 ? "text-emerald-700 bg-emerald-50" : "text-destructive bg-destructive/10")}>
                          {b.change >= 0 ? "+" : ""}{b.change}%
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium">{b.currency}</div>
                      <div className="text-base font-black text-foreground font-mono mt-0.5">{compactNumber(b.balance)}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">{t("gov.quickActions")}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: t("gov.action.collectTax"),       icon: ArrowDownLeft, gradient: "from-amber-500 to-yellow-400", desc: t("gov.action.collectTaxDesc"), go: () => setActiveTab("collections") },
                    { label: t("gov.action.disburse"),         icon: ArrowUpRight,  gradient: "from-primary to-emerald-400", desc: t("gov.action.disburseDesc"), go: () => setActiveTab("disbursements") },
                    { label: t("gov.action.fxTransfer"),       icon: Globe,         gradient: "from-cyan-500 to-blue-400",   desc: t("gov.action.fxTransferDesc"), go: () => navigate(`/${lng}/remittance`) },
                    { label: t("gov.action.report"),           icon: FileText,      gradient: "from-violet-500 to-purple-400", desc: t("gov.action.reportDesc"), go: () => navigate(`/${lng}/transactions`) },
                  ].map(a => (
                    <button key={a.label} type="button" onClick={a.go} className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 text-left cursor-pointer transition-all group hover:scale-[1.02]">
                      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 group-hover:shadow-lg", a.gradient)}>
                        <a.icon size={17} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{a.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{a.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Collection chart */}
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground">{t("gov.dailyCollections")}</h2>
                  <span className="text-[10px] text-muted-foreground">{t("gov.last7days")}</span>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={DAILY_COLLECTIONS} barGap={4}>
                    <XAxis dataKey="day" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="tax"     fill="oklch(0.76 0.17 70)"   radius={[4,4,0,0]} maxBarSize={16} />
                    <Bar dataKey="customs" fill="oklch(0.62 0.19 155)"  radius={[4,4,0,0]} maxBarSize={16} />
                    <Bar dataKey="other"   fill="oklch(0.62 0.19 240)"  radius={[4,4,0,0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-3">
                  {[
                    { label: t("gov.chart.tax"),     color: "bg-amber-400" },
                    { label: t("gov.chart.customs"),  color: "bg-primary" },
                    { label: t("gov.chart.other"),    color: "bg-blue-400" },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", l.color)} />
                      <span className="text-[10px] text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent transactions */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">{t("gov.recentActivity")}</h2>
                <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
                  {recentTxToShow.map((tx, i) => (
                    <motion.div key={tx.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        tx.type === "collection"   ? "bg-emerald-50" :
                        tx.type === "disbursement" ? "bg-amber-50" : "bg-blue-50")}>
                        {tx.type === "collection"   ? <ArrowDownLeft size={15} className="text-emerald-700" /> :
                         tx.type === "disbursement" ? <ArrowUpRight  size={15} className="text-amber-700" /> :
                                                      <ArrowUpRight  size={15} className="text-blue-700" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{t(tx.description)}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{tx.source} · {tx.time}</span>
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border",
                            tx.status === "completed"  ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                            tx.status === "processing" ? "text-amber-700 bg-amber-50 border-amber-200" :
                            "text-muted-foreground bg-secondary border-border")}>
                            {t(`gov.status.${tx.status}`)}
                          </span>
                        </div>
                      </div>
                      <div className={cn("text-sm font-bold font-mono text-right",
                        tx.type === "collection" ? "text-emerald-700" : "text-foreground")}>
                        {tx.type === "collection" ? "+" : "−"}{compactNumber(tx.amount)}
                        <div className="text-[10px] font-normal text-muted-foreground">{tx.currency}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Integrations ── */}
          {activeTab === "integrations" && (
            <motion.div key="integrations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">

              {/* Search + Add */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t("gov.searchSystems")}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90 transition-colors shrink-0"
                >
                  <Plus size={14} /> {t("gov.connectSystem")}
                </button>
              </div>

              {/* Integration cards */}
              <div className="space-y-2">
                {filteredIntegrations.map((integ, i) => {
                  const Icon = categoryIcon(integ.category);
                  const isExpanded = expandedIntegration === integ.id;
                  return (
                    <motion.div key={integ.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="rounded-2xl bg-card border border-border overflow-hidden">
                      <button
                        onClick={() => setExpandedIntegration(isExpanded ? null : integ.id)}
                        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-secondary/40 transition-colors cursor-pointer"
                      >
                        {/* Category icon */}
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", categoryColor(integ.category))}>
                          <Icon size={16} />
                        </div>
                        {/* Name & endpoint */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{t(`gov.sys.${integ.key}`)}</span>
                            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary">{t(`gov.cat.${integ.category}`)}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">{integ.endpoint}</div>
                        </div>
                        {/* Status */}
                        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold shrink-0", statusBg(integ.status), statusColor(integ.status))}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", statusDot(integ.status))} />
                          {t(`gov.intStatus.${integ.status}`)}
                        </div>
                        {/* Stats (desktop only) */}
                        {integ.status === "connected" && (
                          <div className="hidden md:flex items-center gap-4 text-right shrink-0">
                            <div>
                              <div className="text-[10px] text-muted-foreground">{t("gov.txToday")}</div>
                              <div className="text-sm font-bold text-foreground font-mono">{integ.transactionsToday.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground">{t("gov.volumeToday")}</div>
                              <div className="text-sm font-bold text-primary font-mono">${compactNumber(integ.volumeUSD)}</div>
                            </div>
                          </div>
                        )}
                        <ChevronDown size={15} className={cn("text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
                      </button>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                  { label: t("gov.lastSync"),    value: integ.lastSync },
                                  { label: t("gov.txToday"),     value: integ.transactionsToday.toLocaleString() },
                                  { label: t("gov.volumeToday"), value: `$${compactNumber(integ.volumeUSD)}` },
                                  { label: t("gov.protocol"),    value: integ.endpoint.split("://")[0].toUpperCase() },
                                ].map(item => (
                                  <div key={item.label} className="rounded-xl bg-secondary/50 px-3 py-2.5">
                                    <div className="text-[10px] text-muted-foreground">{item.label}</div>
                                    <div className="text-sm font-semibold text-foreground mt-0.5 font-mono">{item.value}</div>
                                  </div>
                                ))}
                              </div>
                              {/* Endpoint */}
                              <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
                                <div>
                                  <div className="text-[10px] text-muted-foreground mb-0.5">{t("gov.endpoint")}</div>
                                  <div className="text-xs text-foreground font-mono break-all">{integ.endpoint}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {integ.status === "connected" && (
                                    <button type="button" onClick={() => requested(`${t("gov.sync")} · ${t(`gov.sys.${integ.key}`)}`)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-[11px] text-primary font-medium cursor-pointer hover:bg-primary/20 transition-colors">
                                      <RefreshCw size={11} /> {t("gov.sync")}
                                    </button>
                                  )}
                                  {integ.status === "pending" && (
                                    <button type="button" onClick={() => requested(`${t("gov.verify")} · ${t(`gov.sys.${integ.key}`)}`)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700 font-medium cursor-pointer hover:bg-amber-50 transition-colors">
                                      <Wifi size={11} /> {t("gov.verify")}
                                    </button>
                                  )}
                                  {integ.status === "error" && (
                                    <button type="button" onClick={() => requested(`${t("gov.reconnect")} · ${t(`gov.sys.${integ.key}`)}`)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/25 text-[11px] text-destructive font-medium cursor-pointer hover:bg-destructive/20 transition-colors">
                                      <WifiOff size={11} /> {t("gov.reconnect")}
                                    </button>
                                  )}
                                  <button type="button" aria-label={t("cta.settings")} title={t("cta.settings")} onClick={() => navigate(`/${lng}/settings`)} className="p-1.5 rounded-lg bg-secondary border border-border cursor-pointer hover:bg-secondary/80 transition-colors">
                                    <Settings size={12} className="text-muted-foreground" />
                                  </button>
                                </div>
                              </div>
                              {integ.status === "error" && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/8 border border-destructive/20">
                                  <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-muted-foreground">{t("gov.errorNotice")}</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Add system modal */}
              <AnimatePresence>
                {showAddModal && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                      <div className="px-5 pt-5 pb-4 border-b border-border">
                        <h3 className="text-base font-bold text-foreground">{t("gov.addSystem.title")}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{t("gov.addSystem.sub")}</p>
                      </div>
                      <div className="p-5 space-y-4">
                        {[
                          { key: "gdt",    label: "gov.addSystem.gdt",    cat: "tax",      color: "text-amber-700 bg-amber-50" },
                          { key: "dgddi",  label: "gov.addSystem.dgddi",  cat: "customs",  color: "text-blue-700 bg-blue-50" },
                          { key: "bcc",    label: "gov.addSystem.bcc",    cat: "treasury", color: "text-violet-700 bg-violet-50" },
                          { key: "inpp",   label: "gov.addSystem.inpp",   cat: "social",   color: "text-rose-700 bg-rose-50" },
                          { key: "custom", label: "gov.addSystem.custom", cat: "fx",       color: "text-cyan-700 bg-cyan-50" },
                        ].map(s => (
                          <button key={s.key} onClick={() => setShowAddModal(false)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-secondary transition-all cursor-pointer text-left">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", s.color)}>
                              <Database size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{t(s.label)}</div>
                              <div className="text-[10px] text-muted-foreground">{s.cat}</div>
                            </div>
                            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </div>
                      <div className="px-5 pb-5">
                        <button onClick={() => setShowAddModal(false)} className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
                          {t("gov.cancel")}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── Collections ── */}
          {activeTab === "collections" && (
            <motion.div key="collections" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: t("gov.col.taxRevenue"),    value: "$4.32M",  change: "+8.4%",  up: true,  icon: FileText,   color: "text-amber-700 bg-amber-50" },
                  { label: t("gov.col.customsDuties"), value: "$2.18M",  change: "+3.1%",  up: true,  icon: Globe,      color: "text-blue-700 bg-blue-50" },
                  { label: t("gov.col.otherRevenue"),  value: "$1.05M",  change: "-1.2%",  up: false, icon: Building2,  color: "text-violet-700 bg-violet-50" },
                ].map((c, i) => (
                  <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="rounded-2xl bg-card border border-border p-4">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", c.color)}>
                      <c.icon size={16} />
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</div>
                    <div className="text-xl font-black text-foreground font-mono mt-1">{c.value}</div>
                    <div className={cn("text-[10px] mt-1 flex items-center gap-0.5 font-medium", c.up ? "text-emerald-700" : "text-destructive")}>
                      {c.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {c.change}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Collection queue */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">{t("gov.pendingCollections")}</h2>
                  <button type="button" onClick={() => requested(t("gov.exportCSV"))} className="flex items-center gap-1.5 text-[11px] text-primary hover:underline cursor-pointer">
                    <Download size={11} /> {t("gov.exportCSV")}
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { entity: "SARL BioPharm Kinshasa",     ref: "TVA-2024-11-0082", amount: 84200,   currency: "USD", due: "Nov 30", type: t("gov.col.vat") },
                    { entity: "Minvielle & Assoc. (Import)", ref: "DD-2024-11-0219", amount: 38500,   currency: "USD", due: "Nov 28", type: t("gov.col.import") },
                    { entity: "Petro Congo SA",              ref: "ROY-2024-11-0041", amount: 520000,  currency: "CDF", due: "Nov 27", type: t("gov.col.royalty") },
                    { entity: "MTN Congo SPRL",              ref: "IS-2024-Q3-0017",  amount: 290000,  currency: "USD", due: "Nov 25", type: t("gov.col.corpTax") },
                    { entity: "AirBelgo Cargo",              ref: "DD-2024-11-0318",  amount: 61000,   currency: "EUR", due: "Nov 24", type: t("gov.col.import") },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{row.entity}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{row.ref} · {row.type}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-foreground font-mono">{row.amount.toLocaleString()} {row.currency}</div>
                        <div className="text-[10px] text-muted-foreground">{t("gov.due")}: {row.due}</div>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 shrink-0">
                        <Clock size={10} className="text-amber-700" />
                        <span className="text-[10px] text-amber-700 font-semibold">{t("gov.status.pending")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Disbursements ── */}
          {activeTab === "disbursements" && (
            <motion.div key="disbursements" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: t("gov.dis.payroll"),   value: "$12.4M", change: "gov.dis.payrollChange", icon: Users,    color: "text-emerald-700 bg-emerald-50" },
                  { label: t("gov.dis.suppliers"), value: "$3.8M",  change: "142 orders",  icon: Building2, color: "text-blue-700 bg-blue-50" },
                  { label: t("gov.dis.grants"),    value: "$0.92M", change: "gov.dis.grantsChange",  icon: Shield,    color: "text-violet-700 bg-violet-50" },
                ].map((d, i) => (
                  <motion.div key={d.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="rounded-2xl bg-card border border-border p-4">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", d.color)}>
                      <d.icon size={16} />
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{d.label}</div>
                    <div className="text-xl font-black text-foreground font-mono mt-1">{d.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{t(d.change)}</div>
                  </motion.div>
                ))}
              </div>

              {/* Disbursement runs */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">{t("gov.disbursementRuns")}</h2>
                  <button type="button" onClick={() => setActiveTab("disbursements")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-[11px] text-primary font-medium cursor-pointer hover:bg-primary/20 transition-colors">
                    <Upload size={11} /> {t("gov.initiateRun")}
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { name: "gov.run.payrollNov",     amount: "12,400,000", currency: "USD", count: "96,200",   status: "processing", date: "Nov 25" },
                    { name: "gov.run.suppliersLot22", amount: "1,840,000",  currency: "USD", count: "87",       status: "completed",  date: "Nov 22" },
                    { name: "gov.run.ngoGrantsQ4",    amount: "920,000",    currency: "USD", count: "28",       status: "pending",    date: "Nov 30" },
                    { name: "gov.run.bondRepayment",  amount: "820,000",    currency: "EUR", count: "1",        status: "pending",    date: "Nov 28" },
                    { name: "gov.run.payrollOct",     amount: "12,100,000", currency: "USD", count: "95,840",   status: "completed",  date: "Oct 25" },
                  ].map((run, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        run.status === "completed" ? "bg-emerald-50" : run.status === "processing" ? "bg-amber-50" : "bg-secondary")}>
                        {run.status === "completed" ? <CheckCircle2 size={14} className="text-emerald-700" /> :
                         run.status === "processing" ? <RefreshCw size={14} className="text-amber-700" /> :
                         <Clock size={14} className="text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{t(run.name)}</div>
                        <div className="text-[10px] text-muted-foreground">{run.count} {t("gov.recipients")} · {run.date}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-foreground font-mono">{run.amount} {run.currency}</div>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border",
                          run.status === "completed"  ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                          run.status === "processing" ? "text-amber-700 bg-amber-50 border-amber-200" :
                          "text-muted-foreground bg-secondary border-border")}>
                          {t(`gov.status.${run.status}`)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// Needed as an icon in tabs
function LayoutGrid({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>;
}
