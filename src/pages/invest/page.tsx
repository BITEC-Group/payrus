import { useState, useEffect, useRef } from "react";
import type { TFunction } from "i18next";
import { labelWithPercent } from "@/lib/i18n-labels.ts";
import { Trans, useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  TrendingUp, Search, ArrowLeft, ChevronRight, CheckCircle,
  Clock, Users, BadgeCheck, Zap, Sprout, ShoppingBag, Cpu,
  Factory, Building2, Bolt, Star, Filter, Plus, X,
  BarChart3, CalendarDays, CircleDollarSign, Percent,
  AlertCircle, ArrowUpRight, Wallet, Trophy, Target,
  ChevronDown, ChevronUp, Shield, ShieldAlert, ShieldCheck,
  Leaf, Heart, Briefcase, Activity, Award, Globe, TrendingDown,
  MapPin, Lock, Unlock, FlameKindling,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { cn } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import {
  usePitches, usePitchInvestmentsForUser, usePitchRepayments, useInvestInPitchMutation, useCreatePitchMutation,
  useInvestorLeaderboard, useSectorPopularity, usePlatformImpact,
} from "@/hooks/use-backend.ts";
import type { AppPitch, AppPitchInvestment, AppLeaderboardRow, AppSectorPopularity, AppPlatformImpact } from "@/lib/backend.ts";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type PitchCategory = "all" | "agriculture" | "retail" | "tech" | "manufacturing" | "real_estate" | "energy";
type InvestTab = "browse" | "portfolio" | "leaderboard" | "submit";
type RepayStatus = "current" | "late" | "completed" | "upcoming";
type RiskLevel = "low" | "medium" | "high";

interface Milestone { title: string; date: string; done: boolean }

interface Pitch {
  id: number | string;
  title: string;
  description: string;
  founder: string;
  founderVerified: boolean;
  category: PitchCategory;
  goal: number;
  raised: number;
  backers: number;
  daysLeft: number;
  currency: string;
  location: string;
  country: string;
  returnPct: number;
  timelineMonths: number;
  useOfFunds: string[];
  impact: { jobs: number; households: number; co2Saved?: number; detail: string };
  risk: RiskLevel;
  riskNote: string;
  milestones: Milestone[];
  featured?: boolean;
  hot?: boolean;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
}

interface Repayment {
  month: string;
  amount: number;
  currency: string;
  status: RepayStatus;
}

interface Investment {
  id: number | string;
  pitchId: number | string;
  pitchTitle: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  amountInvested: number;
  currency: string;
  returnPct: number;
  timelineMonths: number;
  investedDate: string;
  repayments: Repayment[];
  totalRepaid: number;
  totalExpected: number;
  status: "active" | "completed" | "delayed";
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const PITCHES: Pitch[] = [
  {
    id: 1,
    title: "AgroTech Precision Farming — Kivu",
    description: "Drone-assisted crop monitoring and soil analysis for 350 smallholder farms in North Kivu. Our platform reduces input costs by 40% and boosts yields by 60%, with offtake contracts already signed with 3 regional supermarkets.",
    founder: "KivuFarm Technologies",
    founderVerified: true,
    category: "agriculture",
    goal: 25000000,
    raised: 17800000,
    backers: 234,
    daysLeft: 18,
    currency: "XAF",
    location: "North Kivu, DRC",
    country: "🇨🇩",
    returnPct: 18,
    timelineMonths: 24,
    useOfFunds: ["6 agricultural drones (40%)", "Soil sensor network (25%)", "Processing software (20%)", "Working capital (15%)"],
    impact: { jobs: 420, households: 1750, co2Saved: 180, detail: "350 smallholder farms empowered, 1,750 families with reliable food income" },
    risk: "medium",
    riskNote: "Weather and commodity price exposure. Offtake contracts reduce revenue risk significantly.",
    milestones: [
      { title: "Equipment procurement", date: "Sep 2026", done: true },
      { title: "First 100 farms onboarded", date: "Nov 2026", done: true },
      { title: "Full 350-farm deployment", date: "Feb 2027", done: false },
      { title: "Supermarket distribution active", date: "Jun 2027", done: false },
    ],
    featured: true,
    emoji: "🌿",
    gradientFrom: "from-emerald-900/70",
    gradientTo: "to-emerald-600/30",
  },
  {
    id: 2,
    title: "Douala Cold Chain Logistics Hub",
    description: "A 500-ton cold storage facility serving fresh produce exporters, pharmaceutical distributors, and seafood processors in the Littoral region. Leases already signed for 60% of capacity.",
    founder: "FrozenPath SARL",
    founderVerified: true,
    category: "manufacturing",
    goal: 80000000,
    raised: 54000000,
    backers: 127,
    daysLeft: 31,
    currency: "XAF",
    location: "Douala, Cameroon",
    country: "🇨🇲",
    returnPct: 22,
    timelineMonths: 36,
    useOfFunds: ["Refrigeration units (50%)", "Building renovation (30%)", "Equipment (12%)", "Ops reserve (8%)"],
    impact: { jobs: 85, households: 340, co2Saved: 95, detail: "Reduces post-harvest food loss by 65%, enabling 20+ SME exporters" },
    risk: "low",
    riskNote: "60% of capacity pre-leased before funding closed. Infrastructure asset with stable recurring revenue.",
    milestones: [
      { title: "Site secured & permits issued", date: "Jun 2026", done: true },
      { title: "Refrigeration units installed", date: "Oct 2026", done: true },
      { title: "Soft launch — Phase 1 (200t)", date: "Jan 2027", done: false },
      { title: "Full 500t capacity live", date: "Jun 2027", done: false },
    ],
    hot: true,
    emoji: "❄️",
    gradientFrom: "from-sky-900/70",
    gradientTo: "to-sky-600/30",
  },
  {
    id: 3,
    title: "Kinshasa Solar Mini-Grid — 3 Communes",
    description: "Deploying 3 off-grid solar mini-grids (200 kW each) supplying 2,400 households and 180 SMEs in underserved Kinshasa communes. Revenue from monthly subscriptions.",
    founder: "LumiCongo Energy",
    founderVerified: true,
    category: "energy",
    goal: 120000000,
    raised: 88000000,
    backers: 512,
    daysLeft: 22,
    currency: "CDF",
    location: "Kinshasa, DRC",
    country: "🇨🇩",
    returnPct: 16,
    timelineMonths: 48,
    useOfFunds: ["Solar panels & batteries (55%)", "Grid infrastructure (25%)", "Installation labor (12%)", "Contingency (8%)"],
    impact: { jobs: 120, households: 2400, co2Saved: 1200, detail: "2,400 households + 180 SMEs gain reliable electricity for the first time" },
    risk: "low",
    riskNote: "Subscription revenue model. Grid assets secured. Regulatory approval in place under DRC ANSER licence.",
    milestones: [
      { title: "ANSER licence obtained", date: "Apr 2026", done: true },
      { title: "Grid 1 (Ndjili) live", date: "Aug 2026", done: true },
      { title: "Grids 2 & 3 construction", date: "Dec 2026", done: false },
      { title: "All 3 grids operational", date: "Apr 2027", done: false },
    ],
    featured: true,
    emoji: "⚡",
    gradientFrom: "from-amber-900/70",
    gradientTo: "to-amber-500/30",
  },
  {
    id: 4,
    title: "Yaoundé Tech Hub — Co-working & Incubation",
    description: "A 1,200 m² tech co-working space + startup incubator in central Yaoundé with 80 desks, 6 meeting rooms, fast fiber, and a 4-month accelerator program for African startups.",
    founder: "CamerTech Ventures",
    founderVerified: false,
    category: "real_estate",
    goal: 45000000,
    raised: 12500000,
    backers: 89,
    daysLeft: 55,
    currency: "XAF",
    location: "Yaoundé, Cameroon",
    country: "🇨🇲",
    returnPct: 14,
    timelineMonths: 30,
    useOfFunds: ["Fit-out & furniture (45%)", "Fiber & AV equipment (20%)", "Marketing & launch (15%)", "Working capital (20%)"],
    impact: { jobs: 35, households: 0, detail: "Supports 50+ startups per cohort, catalyses Cameroonian tech ecosystem" },
    risk: "medium",
    riskNote: "Founder not yet verified. Occupancy risk in early months. Yaoundé tech community is growing but smaller than Douala.",
    milestones: [
      { title: "Lease signed & fit-out started", date: "Oct 2026", done: false },
      { title: "Beta launch — 20 members", date: "Jan 2027", done: false },
      { title: "Accelerator cohort 1", date: "Mar 2027", done: false },
      { title: "Full 80-desk capacity", date: "Jun 2027", done: false },
    ],
    emoji: "💡",
    gradientFrom: "from-violet-900/70",
    gradientTo: "to-violet-600/30",
  },
  {
    id: 5,
    title: "Abidjan Fashion E-Commerce Platform",
    description: "An app connecting 2,000+ West African fashion designers to consumers across ECOWAS. Market validated: 12,000 waitlist signups. Launch Q3 2026.",
    founder: "AfriStyle Tech",
    founderVerified: false,
    category: "tech",
    goal: 18000000,
    raised: 6800000,
    backers: 143,
    daysLeft: 40,
    currency: "XOF",
    location: "Abidjan, Côte d'Ivoire",
    country: "🇨🇮",
    returnPct: 25,
    timelineMonths: 18,
    useOfFunds: ["App development (40%)", "Designer onboarding (20%)", "Marketing (25%)", "Infrastructure (15%)"],
    impact: { jobs: 2100, households: 2100, detail: "Formalises income for 2,000+ artisan designers across ECOWAS" },
    risk: "high",
    riskNote: "Early-stage, unverified founder. High return reflects high risk. No revenue yet. Waitlist is promising but conversion unproven.",
    milestones: [
      { title: "MVP app completed", date: "Oct 2026", done: false },
      { title: "1,000 designers onboarded", date: "Jan 2027", done: false },
      { title: "ECOWAS expansion (5 countries)", date: "Apr 2027", done: false },
    ],
    hot: true,
    emoji: "👗",
    gradientFrom: "from-pink-900/70",
    gradientTo: "to-pink-600/30",
  },
  {
    id: 6,
    title: "Bamboo Furniture Export Workshop — Bamenda",
    description: "Expanding a 10-artisan bamboo furniture workshop to 40 craftsmen and exporting to Europe via PayRus trade partners. Eco-certified products for premium markets.",
    founder: "GreenCraft Cameroon",
    founderVerified: true,
    category: "retail",
    goal: 12000000,
    raised: 4200000,
    backers: 67,
    daysLeft: 44,
    currency: "XAF",
    location: "Bamenda, Cameroon",
    country: "🇨🇲",
    returnPct: 20,
    timelineMonths: 20,
    useOfFunds: ["Workshop expansion (35%)", "Equipment (30%)", "Certification & export (20%)", "Training (15%)"],
    impact: { jobs: 40, households: 160, co2Saved: 320, detail: "40 artisan jobs in conflict-affected NW Cameroon. FSC-certified bamboo = carbon sequestration" },
    risk: "medium",
    riskNote: "Export partnerships confirmed with 2 European buyers. Bamenda security situation monitored closely.",
    milestones: [
      { title: "FSC certification obtained", date: "Sep 2026", done: true },
      { title: "Workshop expansion complete", date: "Nov 2026", done: false },
      { title: "First EU export shipment", date: "Feb 2027", done: false },
    ],
    emoji: "🪵",
    gradientFrom: "from-orange-900/70",
    gradientTo: "to-orange-600/30",
  },
  {
    id: 7,
    title: "Luanda Logistics Last-Mile — Angola",
    description: "Motorbike delivery fleet of 200 riders covering 15 Luanda districts. B2B clients include 4 supermarket chains and 2 pharmaceutical distributors. 70% capacity contracted.",
    founder: "RapidMoto Angola",
    founderVerified: true,
    category: "retail",
    goal: 35000000,
    raised: 8500000,
    backers: 58,
    daysLeft: 60,
    currency: "AOA",
    location: "Luanda, Angola",
    country: "🇦🇴",
    returnPct: 19,
    timelineMonths: 28,
    useOfFunds: ["Motorbike fleet (55%)", "GPS & tracking tech (20%)", "Rider training (15%)", "Ops reserve (10%)"],
    impact: { jobs: 200, households: 800, detail: "200 rider jobs created. 15 districts served including Cazenga and Sambizanga" },
    risk: "medium",
    riskNote: "Angola AOA exposure. B2B contracts de-risk revenue. Fuel cost volatility managed via contract escalation clauses.",
    milestones: [
      { title: "Company registered & licensed", date: "Aug 2026", done: true },
      { title: "Fleet of 80 bikes deployed", date: "Nov 2026", done: false },
      { title: "Full 200-bike fleet", date: "Mar 2027", done: false },
    ],
    emoji: "🏍️",
    gradientFrom: "from-red-900/70",
    gradientTo: "to-red-600/30",
  },
  {
    id: 8,
    title: "Nairobi EdTech — STEM Tablets for Schools",
    description: "Supplying offline-capable STEM tablets pre-loaded with Kenyan curriculum content to 120 rural primary schools. Government-backed programme. Already piloted in 8 schools.",
    founder: "EduBridge Kenya",
    founderVerified: true,
    category: "tech",
    goal: 22000000,
    raised: 19100000,
    backers: 398,
    daysLeft: 9,
    currency: "KES",
    location: "Nairobi + Rift Valley, Kenya",
    country: "🇰🇪",
    returnPct: 15,
    timelineMonths: 30,
    useOfFunds: ["Tablet procurement (65%)", "Content licensing (15%)", "School setup & training (12%)", "Support ops (8%)"],
    impact: { jobs: 55, households: 36000, detail: "36,000 children gain STEM education access. 120 schools equipped." },
    risk: "low",
    riskNote: "Government-backed purchase order in place. KES stable. Pilot proved delivery model.",
    milestones: [
      { title: "Pilot (8 schools) completed", date: "Jun 2026", done: true },
      { title: "MoE purchase order signed", date: "Aug 2026", done: true },
      { title: "60 schools deployed", date: "Dec 2026", done: false },
      { title: "All 120 schools live", date: "May 2027", done: false },
    ],
    featured: true,
    hot: true,
    emoji: "📚",
    gradientFrom: "from-teal-900/70",
    gradientTo: "to-teal-600/30",
  },
  {
    id: 9,
    title: "Kigali Coffee Export Co-op — 600 Farmers",
    description: "Aggregating 600 smallholder coffee farmers under a co-op with direct export lines to specialty roasters in Europe and Japan. Certified Fairtrade + Rainforest Alliance.",
    founder: "KigaliCaféCo",
    founderVerified: true,
    category: "agriculture",
    goal: 15000000,
    raised: 11200000,
    backers: 281,
    daysLeft: 26,
    currency: "RWF",
    location: "Huye, Rwanda",
    country: "🇷🇼",
    returnPct: 17,
    timelineMonths: 24,
    useOfFunds: ["Washing station upgrade (40%)", "Farmer training & inputs (30%)", "Certification costs (15%)", "Export logistics (15%)"],
    impact: { jobs: 600, households: 2400, co2Saved: 210, detail: "600 farmers earn 35% more via direct export vs local middlemen" },
    risk: "low",
    riskNote: "Fairtrade & Rainforest Alliance certification secures premium price floors. Multiple buyer contracts.",
    milestones: [
      { title: "Fairtrade certification", date: "Jul 2026", done: true },
      { title: "Washing station upgraded", date: "Oct 2026", done: false },
      { title: "First EU export shipment", date: "Jan 2027", done: false },
    ],
    emoji: "☕",
    gradientFrom: "from-brown-900/70 from-amber-950/80",
    gradientTo: "to-amber-800/40",
  },
];

const PITCH_CATEGORY_KEYS: PitchCategory[] = ["agriculture", "retail", "tech", "manufacturing", "real_estate", "energy"];

// Real pitches (supabase/migrations/0018) map into the same rich local
// interface the existing UI already renders — real rows don't carry a
// specific emoji/gradient/backer-count/milestones, so generic defaults
// are used, same toDisplayX() pattern as the other Phase 3 pages.
function toDisplayPitch(p: AppPitch): Pitch {
  const catKey = (p.category ?? "").toLowerCase();
  const category = (PITCH_CATEGORY_KEYS as string[]).includes(catKey) ? (catKey as PitchCategory) : "retail";
  return {
    id: p.id, title: p.title, description: p.description ?? "", founder: p.founder ?? "PayRus Ventures",
    founderVerified: true, category, goal: p.goal, raised: p.raised, backers: 0, daysLeft: 30,
    currency: p.currency, location: p.location ?? "", country: "🌍", returnPct: p.returnPct, timelineMonths: p.timelineMonths,
    useOfFunds: [], impact: { jobs: p.impactJobs ?? 0, households: p.impactHouseholds ?? 0, co2Saved: p.impactCo2 ?? undefined, detail: "" }, risk: p.risk, riskNote: "",
    milestones: [], emoji: "💼", gradientFrom: "from-primary/70", gradientTo: "to-emerald-600/40",
  };
}

const MY_INVESTMENTS: Investment[] = [
  {
    id: 1,
    pitchId: 1,
    pitchTitle: "AgroTech Precision Farming — Kivu",
    emoji: "🌿",
    gradientFrom: "from-emerald-900/70",
    gradientTo: "to-emerald-600/30",
    amountInvested: 50000,
    currency: "XAF",
    returnPct: 18,
    timelineMonths: 24,
    investedDate: "Mar 2026",
    totalRepaid: 12500,
    totalExpected: 59000,
    status: "active",
    repayments: [
      { month: "Apr 2026", amount: 2500, currency: "XAF", status: "completed" },
      { month: "May 2026", amount: 2500, currency: "XAF", status: "completed" },
      { month: "Jun 2026", amount: 2500, currency: "XAF", status: "completed" },
      { month: "Jul 2026", amount: 2500, currency: "XAF", status: "completed" },
      { month: "Aug 2026", amount: 2500, currency: "XAF", status: "current" },
      { month: "Sep 2026", amount: 2500, currency: "XAF", status: "upcoming" },
      { month: "Oct 2026", amount: 2500, currency: "XAF", status: "upcoming" },
    ],
  },
  {
    id: 2,
    pitchId: 3,
    pitchTitle: "Kinshasa Solar Mini-Grid — 3 Communes",
    emoji: "⚡",
    gradientFrom: "from-amber-900/70",
    gradientTo: "to-amber-500/30",
    amountInvested: 100000,
    currency: "CDF",
    returnPct: 16,
    timelineMonths: 48,
    investedDate: "Jan 2026",
    totalRepaid: 14000,
    totalExpected: 116000,
    status: "delayed",
    repayments: [
      { month: "Feb 2026", amount: 2000, currency: "CDF", status: "completed" },
      { month: "Mar 2026", amount: 2000, currency: "CDF", status: "completed" },
      { month: "Apr 2026", amount: 2000, currency: "CDF", status: "completed" },
      { month: "May 2026", amount: 2000, currency: "CDF", status: "completed" },
      { month: "Jun 2026", amount: 2000, currency: "CDF", status: "completed" },
      { month: "Jul 2026", amount: 2000, currency: "CDF", status: "completed" },
      { month: "Aug 2026", amount: 2000, currency: "CDF", status: "late" },
      { month: "Sep 2026", amount: 2000, currency: "CDF", status: "upcoming" },
    ],
  },
];

// Portfolio growth chart data
const PORTFOLIO_CHART = [
  { month: "Jan", value: 150000 },
  { month: "Feb", value: 152000 },
  { month: "Mar", value: 200000 },
  { month: "Apr", value: 202500 },
  { month: "May", value: 205000 },
  { month: "Jun", value: 207500 },
  { month: "Jul", value: 210000 },
  { month: "Aug", value: 212500 },
];

// Category distribution for portfolio donut
const PORTFOLIO_CATEGORIES = [
  { name: "Agriculture", value: 50000, color: "oklch(0.66 0.20 138)" },
  { name: "Energy", value: 100000, color: "oklch(0.70 0.16 85)" },
];

// Leaderboard
const LEADERBOARD = [
  { rank: 1, name: "Diallo K.", country: "🇫🇷", badge: "🏆", total: "12.4M XAF", pitches: 8, avgReturn: "19%", level: "Anchor" },
  { rank: 2, name: "Nkemdirim A.", country: "🇧🇪", badge: "🥈", total: "8.1M XAF", pitches: 5, avgReturn: "21%", level: "Senior" },
  { rank: 3, name: "Biyogo M.", country: "🇨🇲", badge: "🥉", total: "6.8M XAF", pitches: 11, avgReturn: "18%", level: "Senior" },
  { rank: 4, name: "Ouédraogo F.", country: "🇨🇮", badge: "⭐", total: "4.2M XAF", pitches: 4, avgReturn: "22%", level: "Growth" },
  { rank: 5, name: "Keza I.", country: "🇷🇼", badge: "⭐", total: "3.9M XAF", pitches: 7, avgReturn: "16%", level: "Growth" },
  { rank: 6, name: "Mensah B.", country: "🇬🇧", badge: "⭐", total: "3.1M XAF", pitches: 3, avgReturn: "20%", level: "Growth" },
  { rank: 7, name: "You", country: "🌍", badge: "👤", total: "150K XAF", pitches: 2, avgReturn: "17%", level: "Starter" },
];

// Live activity ticker items
const TICKER_EVENTS = [
  "🌿 KivuFarm — 5,000 XAF invested by Diallo K. · just now",
  "⚡ LumiCongo — Milestone 1 completed ✓ · 2 min ago",
  "☕ KigaliCaféCo — New backer from Brussels · 5 min ago",
  "📚 EduBridge Kenya — 87% funded! · 8 min ago",
  "❄️ FrozenPath — 22,000 XAF invested · 12 min ago",
  "🏍️ RapidMoto Angola — New pitch live · 15 min ago",
  "🌿 KivuFarm — 10,000 XAF invested by Nkemdirim A. · 18 min ago",
  "⚡ LumiCongo — Repayment Aug 2026 received · 21 min ago",
];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: PitchCategory; label: string; icon: React.ElementType; color: string }[] = [
  { key: "all", label: "All", icon: TrendingUp, color: "text-foreground" },
  { key: "agriculture", label: "Agriculture", icon: Sprout, color: "text-emerald-700" },
  { key: "retail", label: "Retail", icon: ShoppingBag, color: "text-amber-700" },
  { key: "tech", label: "Tech", icon: Cpu, color: "text-blue-700" },
  { key: "manufacturing", label: "Manufacturing", icon: Factory, color: "text-slate-700" },
  { key: "real_estate", label: "Real Estate", icon: Building2, color: "text-violet-700" },
  { key: "energy", label: "Energy", icon: Bolt, color: "text-yellow-700" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function pct(raised: number, goal: number) {
  return Math.min(100, Math.round((raised / goal) * 100));
}

function fmt(n: number, currency: string) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ${currency}`;
  return `${n.toLocaleString()} ${currency}`;
}

function catLabel(t: TFunction, cat: PitchCategory) {
  return t(CATEGORIES.find(c => c.key === cat)?.label ?? cat);
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const { t } = useTranslation("common");
  const cfg = {
    low: { icon: ShieldCheck, label: "Low Risk", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    medium: { icon: Shield, label: "Medium Risk", cls: "text-amber-700 bg-amber-50 border-amber-200" },
    high: { icon: ShieldAlert, label: "High Risk", cls: "text-destructive bg-destructive/10 border-destructive/30" },
  }[risk];
  return (
    <span className={cn("flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border", cfg.cls)}>
      <cfg.icon size={9} />
      {t(cfg.label)}
    </span>
  );
}

// ─── LIVE TICKER ──────────────────────────────────────────────────────────────

function LiveTicker() {
  const { t } = useTranslation("common");
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % TICKER_EVENTS.length), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-[11px] text-primary font-medium"
        >
          <span className="text-[9px] font-black uppercase tracking-widest text-primary/60 mr-2">{t("invest.live")}</span>
          {TICKER_EVENTS[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ─── PITCH CARD ───────────────────────────────────────────────────────────────

function PitchCard({ pitch, onSelect, onInvest }: {
  pitch: Pitch;
  onSelect: (p: Pitch) => void;
  onInvest: (p: Pitch) => void;
}) {
  const { t } = useTranslation("common");
  const progress = pct(pitch.raised, pitch.goal);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col cursor-pointer group hover:border-primary/30 transition-colors"
      onClick={() => onSelect(pitch)}
    >
      {/* Banner */}
      <div className={cn("relative h-28 bg-gradient-to-br flex items-center justify-center text-5xl", pitch.gradientFrom, pitch.gradientTo)}>
        <span>{pitch.emoji}</span>
        <div className="absolute top-2 left-2 flex gap-1">
          {pitch.featured && (
            <span className="flex items-center gap-0.5 text-[9px] font-black bg-amber-400/20 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-full">
              <Star size={9} /> {t("fundraise.featured")}
            </span>
          )}
          {pitch.hot && (
            <span className="flex items-center gap-0.5 text-[9px] font-black bg-rose-400/20 border border-rose-400/40 text-rose-300 px-2 py-0.5 rounded-full">
              <FlameKindling size={9} /> {t("invest.hot")}
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2 text-[9px] font-black bg-black/40 backdrop-blur-sm border border-white/10 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
          {catLabel(t, pitch.category)}
        </div>
        {/* Return badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-primary/90 text-primary-foreground text-[10px] font-black px-2.5 py-1 rounded-xl">
          <Percent size={9} />
          {pitch.returnPct}{t("invest.yr")}
        </div>
        {/* Country */}
        <div className="absolute bottom-2 left-2 text-base">{pitch.country}</div>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="flex items-start gap-1.5">
          <h3 className="font-bold text-sm leading-snug flex-1">{t(pitch.title)}</h3>
          {pitch.founderVerified && <BadgeCheck size={14} className="text-primary shrink-0 mt-0.5" />}
        </div>

        <div className="text-[10px] text-muted-foreground">
          {pitch.founder} · {pitch.location}
        </div>

        {/* Stats row */}
        <div className="flex gap-2 text-[10px] flex-wrap">
          <span className="flex items-center gap-1 text-muted-foreground"><CalendarDays size={9} />{pitch.timelineMonths}{t("invest.mo")}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Users size={9} />{pitch.backers} {t("invest.backers")}</span>
          <span className="flex items-center gap-1 text-amber-700 font-bold"><Clock size={9} />{pitch.daysLeft}{t("fundraise.dLeft")}</span>
        </div>

        {/* Risk & impact */}
        <div className="flex items-center gap-2">
          <RiskBadge risk={pitch.risk} />
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <Briefcase size={9} />{pitch.impact.jobs} {t("invest.jobs")}
          </span>
        </div>

        {/* Progress */}
        <div className="space-y-1 mt-auto pt-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-primary font-bold font-mono">{fmt(pitch.raised, pitch.currency)}</span>
            <span className="text-muted-foreground">{progress}{t("invest.of")} {fmt(pitch.goal, pitch.currency)}</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" as const }}
            />
          </div>
        </div>

        <Button
          size="sm"
          className="w-full mt-1 text-xs font-bold"
          onClick={(e) => { e.stopPropagation(); onInvest(pitch); }}
        >
          <CircleDollarSign size={12} className="mr-1" /> {t("invest.investNow")}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── INVEST MODAL ─────────────────────────────────────────────────────────────

function InvestModal({ pitch, currentUserId, onInvest, onClose }: {
  pitch: Pitch; currentUserId: string | undefined; onInvest: (args: { userId: string; pitchId: string; amount: number }) => Promise<unknown>; onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const [investing, setInvesting] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const presets = [5000, 10000, 25000, 50000, 100000];

  const numAmount = Number(amount);
  const projectedReturn = numAmount > 0
    ? numAmount * (1 + (pitch.returnPct / 100) * (pitch.timelineMonths / 12))
    : 0;

  async function handleInvest() {
    if (!amount || isNaN(numAmount) || numAmount < 5000) {
      toast.error("Minimum investment is 5,000 " + pitch.currency);
      return;
    }
    if (!riskAccepted) {
      toast.error(t("invest.pleaseAcceptTheRisk"));
      return;
    }
    if (!currentUserId || typeof pitch.id !== "string") {
      // Anonymous preview, or a demo (non-real) pitch — keep the
      // existing mock success path unchanged.
      setDone(true);
      toast.success(`Investment of ${numAmount.toLocaleString()} ${pitch.currency} confirmed!`);
      return;
    }
    setInvesting(true);
    try {
      await onInvest({ userId: currentUserId, pitchId: pitch.id, amount: numAmount });
      setDone(true);
      toast.success(`Investment of ${numAmount.toLocaleString()} ${pitch.currency} confirmed!`);
    } catch {
      toast.error(t("invest.couldnTProcessThe"));
    } finally {
      setInvesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" as const }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {!done ? (
          <>
            <div className={cn("relative h-20 bg-gradient-to-br flex items-center justify-center text-4xl", pitch.gradientFrom, pitch.gradientTo)}>
              <span>{pitch.emoji}</span>
              <button className="absolute top-3 right-3 text-white/70 hover:text-white cursor-pointer" onClick={onClose}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm">{t(pitch.title)}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[11px] text-muted-foreground">{t("invest.annualReturnMonths", { returnPct: pitch.returnPct, timelineMonths: pitch.timelineMonths })}</p>
                  <RiskBadge risk={pitch.risk} />
                </div>
              </div>

              {/* Presets */}
              <div className="flex gap-2 flex-wrap">
                {presets.map(p => (
                  <button
                    key={p}
                    onClick={() => setAmount(String(p))}
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer",
                      amount === String(p)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.toLocaleString()}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("invest.amountMin5000", { currency: pitch.currency })}</label>
                <Input
                  type="number"
                  placeholder={t("fundraise.enterAmount")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-mono text-base"
                />
              </div>

              <label className="flex items-start gap-2 text-[11px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={riskAccepted} onChange={(e) => setRiskAccepted(e.target.checked)} className="mt-0.5" />
                <span>{t("invest.iUnderstandMyCapital")}</span>
              </label>

              {/* Return projection */}
              {numAmount >= 5000 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2"
                >
                  <div className="text-[11px] font-bold text-primary uppercase tracking-wider">{t("invest.projectedReturn")}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground text-[10px]">{t("invest.youInvest")}</div>
                      <div className="font-black font-mono">{numAmount.toLocaleString()} {pitch.currency}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px]">{t("invest.expectedBack")}</div>
                      <div className="font-black font-mono text-primary">{Math.round(projectedReturn).toLocaleString()} {pitch.currency}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px]">{t("invest.netGain")}</div>
                      <div className="font-black font-mono text-emerald-700">+{Math.round(projectedReturn - numAmount).toLocaleString()} {pitch.currency}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px]">{t("invest.timeline")}</div>
                      <div className="font-black">{pitch.timelineMonths} {t("invest.months")}</div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex gap-2.5 bg-muted/30 border border-border rounded-xl p-3">
                <AlertCircle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {t("invest.investmentsAreHeldIn")}
                </p>
              </div>

              <Button className="w-full font-bold" onClick={handleInvest} disabled={investing}>
                <CircleDollarSign size={14} className="mr-2" />
                {investing ? t("invest.processing") : t("invest.confirmInvestment")}
              </Button>
            </div>
          </>
        ) : (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 300 }}>
              <CheckCircle size={56} className="text-primary" />
            </motion.div>
            <h3 className="font-black text-lg">{t("invest.investmentConfirmed")}</h3>
            <p className="text-sm text-muted-foreground">
              <Trans i18nKey="invest.investmentLive" values={{ title: t(pitch.title) }} components={{ b: <span className="text-foreground font-semibold" /> }} />
            </p>
            <Button className="w-full" onClick={onClose}>{t("invest.viewPortfolio")}</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── PITCH DETAIL ─────────────────────────────────────────────────────────────

function PitchDetail({ pitch, onBack, onInvest }: {
  pitch: Pitch;
  onBack: () => void;
  onInvest: (p: Pitch) => void;
}) {
  const { t } = useTranslation("common");
  const progress = pct(pitch.raised, pitch.goal);
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22, ease: "easeOut" as const }}
      className="flex flex-col h-full"
    >
      <div className={cn("relative h-44 bg-gradient-to-br flex items-center justify-center text-7xl shrink-0", pitch.gradientFrom, pitch.gradientTo)}>
        <span>{pitch.emoji}</span>
        <button
          onClick={onBack}
          className="absolute top-3 left-3 flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-semibold bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <ArrowLeft size={14} /> {t("payments.back")}
        </button>
        <div className="absolute top-3 right-3">{pitch.country}</div>
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-primary text-primary-foreground text-xs font-black px-3 py-1.5 rounded-xl shadow-lg">
          <Percent size={11} />{pitch.returnPct}{t("invest.yrExpectedReturn")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Title */}
        <div>
          <div className="flex items-start gap-2 mb-1">
            <h2 className="font-black text-xl leading-snug flex-1">{t(pitch.title)}</h2>
            {pitch.founderVerified && <BadgeCheck size={18} className="text-primary shrink-0 mt-1" />}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
            <span>{pitch.founder}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><MapPin size={10} />{pitch.location}</span>
            <span className="uppercase text-[9px] font-black bg-secondary px-2 py-0.5 rounded-full border border-border">{catLabel(t, pitch.category)}</span>
            <RiskBadge risk={pitch.risk} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Goal", value: fmt(pitch.goal, pitch.currency), icon: Target, color: "text-foreground" },
            { label: "Raised", value: fmt(pitch.raised, pitch.currency), icon: TrendingUp, color: "text-primary" },
            { label: "Backers", value: pitch.backers.toLocaleString(), icon: Users, color: "text-foreground" },
            { label: "Days left", value: `${pitch.daysLeft}d`, icon: Clock, color: "text-amber-700" },
            { label: "Return", value: t("invest.pctPerYear", { pct: pitch.returnPct }), icon: Percent, color: "text-emerald-700" },
            { label: "Timeline", value: `${pitch.timelineMonths} months`, icon: CalendarDays, color: "text-foreground" },
          ].map(s => (
            <div key={s.label} className="bg-secondary/40 border border-border rounded-xl p-3 flex items-center gap-2.5">
              <s.icon size={15} className={s.color} />
              <div>
                <div className="text-[10px] text-muted-foreground">{t(s.label)}</div>
                <div className={cn("font-black text-sm font-mono", s.color)}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Funding progress */}
        <div className="bg-secondary/40 border border-border rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-primary">{progress}{t("fundraise.funded")}</span>
            <span className="text-muted-foreground">{t("fundraise.goal")} {fmt(pitch.goal, pitch.currency)}</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" as const }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground text-right">
            {fmt(pitch.goal - pitch.raised, pitch.currency)} {t("invest.stillNeeded")}
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="font-bold text-sm mb-2">{t("invest.aboutThisVenture")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{t(pitch.description)}</p>
        </div>

        {/* Milestone timeline */}
        <div>
          <h3 className="font-bold text-sm mb-3">{t("invest.milestoneTimeline")}</h3>
          <div className="space-y-2.5">
            {pitch.milestones.map((ms, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                  ms.done ? "bg-primary border-primary" : "border-border bg-secondary"
                )}>
                  {ms.done ? <CheckCircle size={11} className="text-primary-foreground" /> : <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />}
                </div>
                <div className="flex-1 flex items-start justify-between gap-2">
                  <span className={cn("text-xs leading-relaxed", ms.done ? "text-foreground font-medium" : "text-muted-foreground")}>{t(ms.title)}</span>
                  <span className={cn("text-[10px] font-mono shrink-0", ms.done ? "text-primary" : "text-muted-foreground")}>{ms.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Use of funds */}
        <div>
          <h3 className="font-bold text-sm mb-2.5">{t("invest.useOfFunds")}</h3>
          <div className="space-y-2">
            {pitch.useOfFunds.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-[10px] font-black text-primary shrink-0">{i + 1}</div>
                <span className="text-muted-foreground">{labelWithPercent(t, item)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Impact */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Leaf size={14} className="text-emerald-700" />
            <h3 className="font-bold text-sm text-emerald-700">{t("invest.socialImpact")}</h3>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{pitch.impact.detail}</p>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-emerald-50 rounded-xl px-3 py-2">
              <div className="text-[10px] text-emerald-700/70">{t("invest.jobsCreated")}</div>
              <div className="font-black text-emerald-700 font-mono">{pitch.impact.jobs.toLocaleString()}</div>
            </div>
            {pitch.impact.households > 0 && (
              <div className="bg-emerald-50 rounded-xl px-3 py-2">
                <div className="text-[10px] text-emerald-700/70">{t("invest.householdsImpacted")}</div>
                <div className="font-black text-emerald-700 font-mono">{pitch.impact.households.toLocaleString()}</div>
              </div>
            )}
            {pitch.impact.co2Saved && (
              <div className="bg-emerald-50 rounded-xl px-3 py-2">
                <div className="text-[10px] text-emerald-700/70">{t("invest.coSavedTYr")}</div>
                <div className="font-black text-emerald-700 font-mono">{pitch.impact.co2Saved}</div>
              </div>
            )}
          </div>
        </div>

        {/* Risk */}
        <div className={cn(
          "flex gap-2.5 border rounded-xl p-3.5",
          pitch.risk === "low" ? "bg-emerald-50 border-emerald-200" :
          pitch.risk === "medium" ? "bg-amber-50 border-amber-200" :
          "bg-destructive/5 border-destructive/20"
        )}>
          {pitch.risk === "low" ? <ShieldCheck size={15} className="text-emerald-700 shrink-0 mt-0.5" /> :
           pitch.risk === "medium" ? <Shield size={15} className="text-amber-700 shrink-0 mt-0.5" /> :
           <ShieldAlert size={15} className="text-destructive shrink-0 mt-0.5" />}
          <div>
            <div className={cn("text-[11px] font-bold mb-0.5",
              pitch.risk === "low" ? "text-emerald-700" : pitch.risk === "medium" ? "text-amber-700" : "text-destructive"
            )}>{t("invest.riskAssessment")}</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{pitch.riskNote}</p>
          </div>
        </div>

        <div className="flex gap-2.5 bg-muted/30 border border-border rounded-xl p-3">
          <Lock size={14} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {t("invest.investmentsAreHeldIn2")}
          </p>
        </div>

        <Button className="w-full font-bold text-base py-6" onClick={() => onInvest(pitch)}>
          <CircleDollarSign size={17} className="mr-2" />
          {t("invest.investInThisVenture")}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── PORTFOLIO ────────────────────────────────────────────────────────────────

function statusColor(s: RepayStatus) {
  if (s === "completed") return "text-emerald-700";
  if (s === "current") return "text-primary";
  if (s === "late") return "text-destructive";
  return "text-muted-foreground";
}

function statusBg(s: RepayStatus) {
  if (s === "completed") return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (s === "current") return "bg-primary/10 border-primary/30 text-primary";
  if (s === "late") return "bg-destructive/10 border-destructive/30 text-destructive";
  return "bg-secondary border-border text-muted-foreground";
}

function investmentStatusBadge(s: Investment["status"]) {
  if (s === "active") return "bg-primary/10 border-primary/30 text-primary";
  if (s === "completed") return "bg-emerald-50 border-emerald-200 text-emerald-700";
  return "bg-amber-50 border-amber-200 text-amber-700";
}

// A real investment's repayment schedule is fetched lazily, one row at a
// time (only when expanded) — pulling every investment's schedule up
// front just to render a collapsed list isn't worth the extra queries.
function RealInvestmentRow({ inv, pitchTitle, isOpen, onToggle }: {
  inv: AppPitchInvestment; pitchTitle: string; isOpen: boolean; onToggle: () => void;
}) {
  const { t } = useTranslation("common");
  const repayments = usePitchRepayments(inv.id);
  const today = new Date();
  const rows: Repayment[] = (repayments ?? []).map((r) => ({
    month: `Month ${r.month}`, amount: r.amount, currency: r.currency,
    status: r.status === "paid" ? "completed" : new Date(r.dueDate) < today ? "late" : "upcoming",
  }));
  const firstPendingIdx = rows.findIndex((r) => r.status === "upcoming");
  if (firstPendingIdx !== -1) rows[firstPendingIdx] = { ...rows[firstPendingIdx], status: "current" };

  const totalExpected = inv.amount * (1 + (inv.returnPct / 100) * (inv.timelineMonths / 12));
  const totalRepaid = rows.filter((r) => r.status === "completed").reduce((s, r) => s + r.amount, 0);
  const repayProgress = totalExpected > 0 ? Math.round((totalRepaid / totalExpected) * 100) : 0;
  const status: Investment["status"] = rows.length > 0 && rows.every((r) => r.status === "completed")
    ? "completed" : rows.some((r) => r.status === "late") ? "delayed" : "active";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button className="w-full text-left cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/70 to-emerald-600/40 flex items-center justify-center text-xl shrink-0">
            💼
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{pitchTitle}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>{fmt(inv.amount, inv.currency)} {t("invest.invested")}</span>
              <span>·</span>
              <span className={cn("font-bold", status === "delayed" ? "text-amber-700" : "text-primary")}>{inv.returnPct}{t("invest.yr2")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-[9px] font-black border px-2 py-0.5 rounded-full capitalize", investmentStatusBadge(status))}>
              {status}
            </span>
            {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{t("invest.repaymentProgress")}</span>
            <span className="font-mono">{repayProgress}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", status === "delayed" ? "bg-amber-400" : "bg-primary")} style={{ width: `${repayProgress}%` }} />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-border px-4 py-3 space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("invest.repaymentSchedule")}</div>
              {rows.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-6 h-6 rounded-full border flex items-center justify-center", statusBg(r.status))}>
                      {r.status === "completed" && <CheckCircle size={12} />}
                      {r.status === "current" && <Clock size={11} />}
                      {r.status === "late" && <AlertCircle size={11} />}
                      {r.status === "upcoming" && <ChevronRight size={11} />}
                    </div>
                    <span className="text-xs text-muted-foreground">{r.month}</span>
                  </div>
                  <span className={cn("text-xs font-bold font-mono", statusColor(r.status))}>{fmt(r.amount, r.currency)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between text-xs">
                <span className="text-muted-foreground">{t("invest.totalRepaid")}</span>
                <span className="font-black font-mono text-emerald-700">{fmt(totalRepaid, inv.currency)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("invest.totalExpected")}</span>
                <span className="font-black font-mono text-primary">{fmt(Math.round(totalExpected), inv.currency)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PortfolioView({ onBrowse, currentUserId, realInvestments, realPitches }: {
  onBrowse: () => void; currentUserId: string | undefined; realInvestments: AppPitchInvestment[] | undefined; realPitches: AppPitch[] | undefined;
}) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState<number | string | null>(null);

  const hasRealInvestments = !!currentUserId && !!realInvestments && realInvestments.length > 0;

  const totalInvested = hasRealInvestments ? realInvestments.reduce((s, i) => s + i.amount, 0) : MY_INVESTMENTS.reduce((s, i) => s + i.amountInvested, 0);
  // Real repayments only ever advance to "paid" via a manual/admin action
  // (see supabase/migrations/0018) — no such action exists in this phase,
  // so a signed-in user's real total-repaid is always genuinely zero.
  const totalRepaid = hasRealInvestments ? 0 : MY_INVESTMENTS.reduce((s, i) => s + i.totalRepaid, 0);
  const totalExpected = hasRealInvestments
    ? realInvestments.reduce((s, i) => s + i.amount * (1 + (i.returnPct / 100) * (i.timelineMonths / 12)), 0)
    : MY_INVESTMENTS.reduce((s, i) => s + i.totalExpected, 0);
  const currentValue = PORTFOLIO_CHART[PORTFOLIO_CHART.length - 1].value;
  const prevValue = PORTFOLIO_CHART[PORTFOLIO_CHART.length - 2].value;
  const growthPct = (((currentValue - prevValue) / prevValue) * 100).toFixed(1);

  return (
    <div className="p-5 space-y-5">

      {/* Portfolio value header */}
      <div className="bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 rounded-2xl p-5">
        <div className="text-xs text-muted-foreground mb-1">{t("invest.totalPortfolioValue")}</div>
        <div className="text-3xl font-black font-mono text-foreground">{currentValue.toLocaleString()} <span className="text-base text-muted-foreground">{t("fundraise.xaf")}</span></div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-emerald-700 flex items-center gap-1 font-bold">
            <ArrowUpRight size={12} />{t("invest.growthThisMonth", { pct: growthPct })}
          </span>
          <span className="text-[10px] text-muted-foreground">{t("invest.vsLastMonth")}</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Invested", value: `${(totalInvested / 1000).toFixed(0)}K`, icon: Wallet, color: "text-foreground" },
          { label: "Repaid", value: `${(totalRepaid / 1000).toFixed(0)}K`, icon: ArrowUpRight, color: "text-emerald-700" },
          { label: "Expected", value: `${(totalExpected / 1000).toFixed(0)}K`, icon: Trophy, color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-3 text-center">
            <s.icon size={16} className={cn("mx-auto mb-1", s.color)} />
            <div className={cn("text-base font-black font-mono", s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{t(s.label)}</div>
          </div>
        ))}
      </div>

      {/* Growth chart */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="text-xs font-bold text-muted-foreground mb-3">{t("invest.portfolioValueJanAug")}</div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={PORTFOLIO_CHART}>
            <defs>
              <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.66 0.20 138)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.66 0.20 138)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "oklch(0.60 0.01 240)" }} axisLine={false} tickLine={false} />
            <ChartTooltip formatter={(v) => [`${Number(v).toLocaleString()} XAF`, "Value"]} contentStyle={{ backgroundColor: "oklch(0.14 0.018 240)", border: "1px solid oklch(0.22 0.02 240)", borderRadius: "0.75rem", fontSize: "11px" }} />
            <Area type="monotone" dataKey="value" stroke="oklch(0.66 0.20 138)" strokeWidth={2} fill="url(#portGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Category donut */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="text-xs font-bold text-muted-foreground mb-3">{t("invest.allocationBySector")}</div>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={80} height={80}>
            <PieChart>
              <Pie data={PORTFOLIO_CATEGORIES} cx="50%" cy="50%" innerRadius={22} outerRadius={38} dataKey="value" strokeWidth={0}>
                {PORTFOLIO_CATEGORIES.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5">
            {PORTFOLIO_CATEGORIES.map(c => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="text-[11px] text-muted-foreground">{c.name}</span>
                <span className="text-[11px] font-bold font-mono">{(c.value / 1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h3 className="font-bold text-sm">{t("invest.myInvestments")}</h3>

      {hasRealInvestments ? realInvestments.map((inv) => (
        <RealInvestmentRow
          key={inv.id}
          inv={inv}
          pitchTitle={realPitches?.find((p) => p.id === inv.pitchId)?.title ?? t("invest.investment")}
          isOpen={expanded === inv.id}
          onToggle={() => setExpanded(expanded === inv.id ? null : inv.id)}
        />
      )) : MY_INVESTMENTS.map(inv => {
        const isOpen = expanded === inv.id;
        const repayProgress = Math.round((inv.totalRepaid / inv.totalExpected) * 100);
        return (
          <div key={inv.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              className="w-full text-left cursor-pointer"
              onClick={() => setExpanded(isOpen ? null : inv.id)}
            >
              <div className="flex items-center gap-3 p-4">
                <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl shrink-0", inv.gradientFrom, inv.gradientTo)}>
                  {inv.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{inv.pitchTitle}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{fmt(inv.amountInvested, inv.currency)} {t("invest.invested")}</span>
                    <span>·</span>
                    <span className={cn("font-bold", inv.status === "delayed" ? "text-amber-700" : "text-primary")}>{inv.returnPct}{t("invest.yr2")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[9px] font-black border px-2 py-0.5 rounded-full capitalize", investmentStatusBadge(inv.status))}>
                    {inv.status}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </div>
              </div>
              <div className="px-4 pb-3">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{t("invest.repaymentProgress")}</span>
                  <span className="font-mono">{repayProgress}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", inv.status === "delayed" ? "bg-amber-400" : "bg-primary")}
                    style={{ width: `${repayProgress}%` }}
                  />
                </div>
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("invest.repaymentSchedule")}</div>
                    {inv.repayments.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-6 h-6 rounded-full border flex items-center justify-center", statusBg(r.status))}>
                            {r.status === "completed" && <CheckCircle size={12} />}
                            {r.status === "current" && <Clock size={11} />}
                            {r.status === "late" && <AlertCircle size={11} />}
                            {r.status === "upcoming" && <ChevronRight size={11} />}
                          </div>
                          <span className="text-xs text-muted-foreground">{r.month}</span>
                        </div>
                        <span className={cn("text-xs font-bold font-mono", statusColor(r.status))}>
                          {fmt(r.amount, r.currency)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border flex justify-between text-xs">
                      <span className="text-muted-foreground">{t("invest.totalRepaid")}</span>
                      <span className="font-black font-mono text-emerald-700">{fmt(inv.totalRepaid, inv.currency)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t("invest.totalExpected")}</span>
                      <span className="font-black font-mono text-primary">{fmt(inv.totalExpected, inv.currency)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {(hasRealInvestments ? realInvestments.length === 0 : MY_INVESTMENTS.length === 0) && (
        <div className="text-center py-16 space-y-3">
          <BarChart3 size={40} className="text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{t("invest.noInvestmentsYet")}</p>
          <Button size="sm" onClick={onBrowse}>{t("invest.browsePitches")}</Button>
        </div>
      )}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

function formatXafTotal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M XAF`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K XAF`;
  return `${n.toLocaleString()} XAF`;
}

// Same thresholds the "Investor Levels" card below already states in XAF.
function levelForXaf(n: number): string {
  if (n >= 10_000_000) return "Anchor";
  if (n >= 5_000_000) return "Senior";
  if (n >= 500_000) return "Growth";
  return "Starter";
}

const MOCK_SECTOR_DATA = [
  { sector: "Agriculture", total: 42 },
  { sector: "Energy", total: 38 },
  { sector: "Tech", total: 27 },
  { sector: "Retail", total: 19 },
  { sector: "Manufacturing", total: 15 },
  { sector: "Real Estate", total: 11 },
];

function LeaderboardView({ realLeaderboard, currentUserId, realSectorPopularity, realPlatformImpact }: {
  realLeaderboard: AppLeaderboardRow[] | undefined; currentUserId: string | undefined;
  realSectorPopularity: AppSectorPopularity[] | undefined; realPlatformImpact: AppPlatformImpact | undefined;
}) {
  const { t } = useTranslation("common");
  const levelColor: Record<string, string> = {
    "Anchor": "text-amber-700 bg-amber-50 border-amber-200",
    "Senior": "text-accent-foreground bg-accent/10 border-accent/30",
    "Growth": "text-primary bg-primary/10 border-primary/30",
    "Starter": "text-muted-foreground bg-muted border-border",
  };

  // Real ranking once signed in with at least one real investment on the
  // books — normalized into XAF via get_investor_leaderboard (0019), same
  // cross-currency rate formula create_quote() uses.
  const hasRealLeaderboard = !!currentUserId && !!realLeaderboard && realLeaderboard.length > 0;
  const displayRows = hasRealLeaderboard
    ? realLeaderboard.map((r, i) => ({
        rank: i + 1, name: r.username ?? "Investor", country: r.userId === currentUserId ? "🌍" : "🌍",
        badge: r.userId === currentUserId ? "👤" : i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "⭐",
        total: formatXafTotal(r.totalXaf), pitches: r.pitchesCount, avgReturn: `${r.avgReturnPct}%`, level: levelForXaf(r.totalXaf),
        isYou: r.userId === currentUserId,
      }))
    : LEADERBOARD.map(r => ({ ...r, isYou: r.name === "You" }));

  // Real distinct-backer counts per sector (0020's get_sector_popularity),
  // whatever category values actually exist in the data — not forced
  // into the mock's fixed 6-category list.
  const hasRealSectors = !!currentUserId && !!realSectorPopularity && realSectorPopularity.length > 0;
  const sectorData = hasRealSectors ? realSectorPopularity.map(s => ({ sector: s.sector, total: s.backers })) : MOCK_SECTOR_DATA;

  // Real platform-wide totals (0020's get_platform_impact) — sourced from
  // pitches' own impact_jobs/impact_households/impact_co2 columns, only
  // summed across pitches that have actually been funded.
  const hasRealImpact = !!currentUserId && !!realPlatformImpact && realPlatformImpact.totalBackers > 0;
  const impactStats = hasRealImpact
    ? [
        { label: "Total raised", value: formatXafTotal(realPlatformImpact.totalRaised), icon: CircleDollarSign },
        { label: "Jobs created", value: realPlatformImpact.totalJobs.toLocaleString(), icon: Briefcase },
        { label: "Households", value: realPlatformImpact.totalHouseholds.toLocaleString(), icon: Heart },
        { label: "CO₂ saved", value: `${realPlatformImpact.totalCo2.toLocaleString()}t/yr`, icon: Leaf },
      ]
    : [
        { label: "Total raised", value: "183.3M XAF", icon: CircleDollarSign },
        { label: "Jobs created", value: "3,655", icon: Briefcase },
        { label: "Households", value: "42,750", icon: Heart },
        { label: "CO₂ saved", value: "1,805t/yr", icon: Leaf },
      ];

  return (
    <div className="p-5 space-y-5">
      {/* Season header */}
      <div className="bg-gradient-to-r from-amber-400/10 to-primary/10 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] text-amber-700 font-black uppercase tracking-widest">{t("invest.season1Aug2026")}</div>
            <h2 className="font-black text-lg">{t("invest.topPayrusInvestors")}</h2>
          </div>
          <Trophy size={28} className="text-amber-700" />
        </div>
        <p className="text-[11px] text-muted-foreground">{t("invest.rankingsBasedOnTotal")}</p>
      </div>

      {/* Leaderboard table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {displayRows.map((inv, i) => (
          <div
            key={inv.rank}
            className={cn(
              "flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0",
              inv.isYou ? "bg-primary/5" : i < 3 ? "bg-amber-50" : ""
            )}
          >
            <div className="w-8 text-center text-sm font-black">{inv.badge}</div>
            <div className="flex-1 min-w-0">
              <div className={cn("font-bold text-sm", inv.isYou ? "text-primary" : "text-foreground")}>
                {inv.name} <span className="text-base">{inv.country}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{t("invest.venturesBackedAvgReturn", { pitches: inv.pitches, avgReturn: inv.avgReturn })}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-black text-sm font-mono text-foreground">{inv.total}</div>
              <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border", levelColor[inv.level] ?? "")}>
                {inv.level}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Sector popularity chart */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="text-xs font-bold text-muted-foreground mb-3">{t("invest.mostBackedSectorsOf")}</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={sectorData} barCategoryGap="30%">
            <XAxis dataKey="sector" tick={{ fontSize: 9, fill: "oklch(0.60 0.01 240)" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <ChartTooltip formatter={(v) => [Number(v), "backers"]} contentStyle={{ backgroundColor: "oklch(0.14 0.018 240)", border: "1px solid oklch(0.22 0.02 240)", borderRadius: "0.75rem", fontSize: "11px" }} />
            <Bar dataKey="total" fill="oklch(0.66 0.20 138)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Platform impact */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={16} className="text-emerald-700" />
          <h3 className="font-bold text-sm text-emerald-700">{t("invest.collectiveImpactAllInvestors")}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {impactStats.map(s => (
            <div key={s.label} className="bg-emerald-50 rounded-xl px-3 py-2.5">
              <s.icon size={13} className="text-emerald-700 mb-1" />
              <div className="font-black text-sm text-emerald-700 font-mono">{s.value}</div>
              <div className="text-[10px] text-emerald-700/70">{t(s.label)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Level up guide */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Award size={14} className="text-primary" /> {t("invest.investorLevels")}</h3>
        <div className="space-y-2">
          {[
            { level: "Starter", req: "< 500K XAF deployed", color: "text-muted-foreground" },
            { level: "Growth", req: "500K – 5M XAF deployed", color: "text-primary" },
            { level: "Senior", req: "5M – 10M XAF deployed", color: "text-accent-foreground" },
            { level: "Anchor", req: "10M+ XAF deployed", color: "text-amber-700" },
          ].map(l => (
            <div key={l.level} className="flex items-center justify-between text-xs">
              <span className={cn("font-bold", l.color)}>{l.level}</span>
              <span className="text-muted-foreground">{l.req}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SUBMIT PITCH ─────────────────────────────────────────────────────────────

type SubmitCategory = "agriculture" | "retail" | "tech" | "manufacturing" | "real_estate" | "energy";

const SUBMIT_CATEGORIES: { value: SubmitCategory; label: string }[] = [
  { value: "agriculture", label: "Agriculture" },
  { value: "retail", label: "Retail" },
  { value: "tech", label: "Tech" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "real_estate", label: "Real Estate" },
  { value: "energy", label: "Energy" },
];

function SubmitPitch({ onBack, currentUserId, onSubmit }: {
  onBack: () => void; currentUserId: string | undefined;
  onSubmit: (args: {
    ownerUserId: string; title: string; description: string; founder: string; category: string; goal: number; currency: string;
    returnPct: number; timelineMonths: number; location?: string; impactJobs?: number; impactHouseholds?: number; impactCo2?: number;
  }) => Promise<unknown>;
}) {
  const { t } = useTranslation("common");
  const [form, setForm] = useState({
    title: "",
    description: "",
    goal: "",
    returnPct: "",
    timelineMonths: "",
    category: "agriculture" as SubmitCategory,
    org: "",
    location: "",
    impact: "",
    impactJobs: "",
    impactHouseholds: "",
    impactCo2: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isReal = !!currentUserId;

  async function handleSubmit() {
    if (!form.title || !form.description || !form.goal || !form.returnPct || !form.timelineMonths) {
      toast.error(t("fundraise.pleaseFillInAll"));
      return;
    }
    if (!isReal || !currentUserId) {
      setSubmitted(true);
      toast.success(t("invest.pitchSubmittedForReview"));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        ownerUserId: currentUserId, title: form.title,
        description: form.impact ? `${form.description}\n\nImpact: ${form.impact}` : form.description,
        founder: form.org || "Independent founder", category: form.category, goal: Number(form.goal), currency: "XAF",
        returnPct: Number(form.returnPct), timelineMonths: Number(form.timelineMonths), location: form.location || undefined,
        impactJobs: form.impactJobs ? Number(form.impactJobs) : undefined,
        impactHouseholds: form.impactHouseholds ? Number(form.impactHouseholds) : undefined,
        impactCo2: form.impactCo2 ? Number(form.impactCo2) : undefined,
      });
      setSubmitted(true);
      toast.success(t("invest.pitchSubmitted"));
    } catch {
      toast.error(t("invest.couldnTSubmitThe"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full text-center gap-5 p-8"
      >
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 300, delay: 0.1 }}>
          <CheckCircle size={64} className="text-primary" />
        </motion.div>
        <h2 className="font-black text-xl">{isReal ? t("invest.pitchLive") : t("invest.pitchSubmitted2")}</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          {isReal
            ? t("invest.yourVentureIsNow")
            : t("invest.yourInvestmentPitchIs")}
        </p>
        <div className="bg-secondary/50 border border-border rounded-2xl p-4 text-left w-full max-w-xs space-y-2">
          <div className="text-xs text-muted-foreground">{t("invest.venture")}</div>
          <div className="font-bold text-sm">{t(form.title)}</div>
          <div className="text-xs text-muted-foreground">{t("invest.targetRaise")}</div>
          <div className="font-black font-mono text-primary text-sm">{Number(form.goal).toLocaleString()} {t("fundraise.xaf")}</div>
          <div className="text-xs text-muted-foreground">{t("invest.offeredReturn")}</div>
          <div className="font-black text-sm">{form.returnPct}{t("invest.year")}</div>
        </div>
        <Button className="w-full max-w-xs" onClick={onBack}>{t("fundraise.backToBrowse")}</Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" as const }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-3 p-5 border-b border-border shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="font-black text-base">{t("invest.postAnInvestmentPitch")}</h2>
          <p className="text-xs text-muted-foreground">{t("invest.raiseCapitalFromPayrus")}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex gap-2.5">
          <Activity size={14} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <Trans i18nKey="invest.aboutNote" values={{ amount: t("invest.28mXaf") }} components={{ b: <span className="text-foreground font-bold" /> }} />
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("invest.ventureProjectTitle")}</label>
          <Input
            placeholder={t("invest.eGKinshasaSolar")}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("invest.descriptionBusinessCase")}</label>
          <textarea
            className="w-full min-h-[100px] bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t("invest.describeYourVentureMarket")}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t("invest.fundingGoalXaf")}</label>
            <div className="relative">
              <CircleDollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="number" className="pl-8 font-mono" placeholder="25000000" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t("invest.timelineMonths")}</label>
            <div className="relative">
              <CalendarDays size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="number" className="pl-8" placeholder="24" value={form.timelineMonths} onChange={e => setForm(f => ({ ...f, timelineMonths: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("invest.offeredAnnualReturn")}</label>
          <div className="relative">
            <Percent size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input type="number" className="pl-8 font-mono" placeholder={t("invest.eG18")} value={form.returnPct} onChange={e => setForm(f => ({ ...f, returnPct: e.target.value }))} />
          </div>
          <p className="text-[10px] text-muted-foreground">{t("invest.platformAverage1425")}</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("invest.locationCountry")}</label>
          <div className="relative">
            <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder={t("invest.eGDoualaCameroon")} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("invest.sectorCategory")}</label>
          <div className="flex gap-2 flex-wrap">
            {SUBMIT_CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setForm(f => ({ ...f, category: c.value }))}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer",
                  form.category === c.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("invest.socialImpactOptional")}</label>
          <Input placeholder={t("invest.eGDirectExport")} value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))} />
          <p className="text-[10px] text-muted-foreground">{t("invest.venturesWithClearSocial")}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t("invest.jobsCreated")}</label>
            <Input type="number" className="font-mono" placeholder="0" value={form.impactJobs} onChange={e => setForm(f => ({ ...f, impactJobs: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t("invest.households")}</label>
            <Input type="number" className="font-mono" placeholder="0" value={form.impactHouseholds} onChange={e => setForm(f => ({ ...f, impactHouseholds: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t("invest.coSavedTYr")}</label>
            <Input type="number" className="font-mono" placeholder="0" value={form.impactCo2} onChange={e => setForm(f => ({ ...f, impactCo2: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("invest.organisationCompanyName")}</label>
          <Input placeholder={t("invest.eGLumicongoEnergy")} value={form.org} onChange={e => setForm(f => ({ ...f, org: e.target.value }))} />
          <p className="text-[10px] text-muted-foreground">{t("invest.registeredEntitiesReceiveA")}</p>
        </div>

        <div className="flex gap-2.5 bg-primary/5 border border-primary/20 rounded-xl p-3.5">
          <Target size={14} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <Trans i18nKey="invest.pitchReviewNote" values={{ fee: t("invest.3SuccessFee") }} components={{ b: <span className="text-foreground font-semibold" /> }} />
          </p>
        </div>

        <Button className="w-full font-bold" onClick={handleSubmit} disabled={submitting}>
          <Plus size={15} className="mr-2" /> {submitting ? t("invest.submitting") : t("invest.submitPitchForReview")}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function InvestPage() {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<InvestTab>("browse");
  const [category, setCategory] = useState<PitchCategory>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Pitch | null>(null);
  const [investing, setInvesting] = useState<Pitch | null>(null);
  const [sortBy, setSortBy] = useState<"return" | "progress" | "new" | "risk">("return");

  const currentUser = useCurrentAppUser();
  const realPitches = usePitches();
  const realInvestments = usePitchInvestmentsForUser(currentUser?.id);
  const investInPitchMutation = useInvestInPitchMutation();
  const createPitchMutation = useCreatePitchMutation();
  const realLeaderboard = useInvestorLeaderboard();
  const realSectorPopularity = useSectorPopularity();
  const realPlatformImpact = usePlatformImpact();

  // Real catalog once signed in with data to show; anonymous/no-data
  // visitors keep the existing rich mock catalog — same fallback
  // convention used throughout this migration (see fundraise/travel).
  const hasRealPitches = !!currentUser && !!realPitches && realPitches.length > 0;
  const displayPitches: Pitch[] = hasRealPitches ? realPitches.map(toDisplayPitch) : PITCHES;

  const filtered = displayPitches
    .filter(p => {
      const matchCat = category === "all" || p.category === category;
      const matchSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.founder.toLowerCase().includes(search.toLowerCase()) ||
        p.location.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === "return") return b.returnPct - a.returnPct;
      if (sortBy === "progress") return pct(b.raised, b.goal) - pct(a.raised, a.goal);
      if (sortBy === "risk") {
        const order: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
        return order[a.risk] - order[b.risk];
      }
      return String(b.id).localeCompare(String(a.id));
    });

  const featured = displayPitches.filter(p => p.featured);
  const totalRaised = displayPitches.reduce((s, p) => s + p.raised, 0);
  const totalBackers = displayPitches.reduce((s, p) => s + p.backers, 0);

  const TABS: { key: InvestTab; label: string; icon: React.ElementType }[] = [
    { key: "browse", label: t("invest.tabBrowse"), icon: TrendingUp },
    { key: "portfolio", label: t("invest.tabPortfolio"), icon: BarChart3 },
    { key: "leaderboard", label: t("invest.tabRankings"), icon: Trophy },
    { key: "submit", label: t("invest.tabSubmit"), icon: Plus },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Page header with back */}
      <div className="px-5 pt-5 pb-0 shrink-0">
        <PageHeader title={t("invest.title")} className="mb-4 md:mb-6" />
      </div>
      {/* Header */}
      <div className="px-5 pt-0 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black">{t("games.payrusInvest")}</h1>
              <span className="text-[9px] font-black bg-primary/15 border border-primary/30 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t("invest.africaSMarketplace")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("invest.directInvestmentInAfrican", { count: displayPitches.length })}</p>
          </div>
          <Button size="sm" className="font-bold" onClick={() => { setSelected(null); setTab("submit"); }}>
            <Plus size={14} className="mr-1" /> {t("invest.pitch")}
          </Button>
        </div>

        {/* Live ticker */}
        <div className="mt-3 mb-3">
          <LiveTicker />
        </div>

        {/* Stats strip */}
        <div className="flex gap-2 mb-4">
          {[
            { label: "Active pitches", value: `${displayPitches.length}` },
            { label: "Total raised", value: `${(totalRaised / 1_000_000).toFixed(0)}M XAF` },
            { label: "Avg return", value: t("invest.pctPerYear", { pct: Math.round(displayPitches.reduce((s, p) => s + p.returnPct, 0) / displayPitches.length) }) },
            { label: "Total backers", value: totalBackers.toLocaleString() },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-secondary/50 border border-border rounded-xl px-2 py-1.5 min-w-0">
              <div className="text-[9px] text-muted-foreground truncate">{t(s.label)}</div>
              <div className="font-black text-xs font-mono text-primary">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-border overflow-x-auto">
          {TABS.map(tItem => (
            <button
              key={tItem.key}
              onClick={() => { setTab(tItem.key); setSelected(null); }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0",
                tab === tItem.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tItem.icon size={12} />
              {t(tItem.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── BROWSE ── */}
          {tab === "browse" && !selected && (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-5">
              {/* Search & sort */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 text-sm" placeholder={t("invest.searchVenturesFoundersLocations")} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-1 bg-secondary border border-border rounded-xl px-3">
                  <Filter size={12} className="text-muted-foreground" />
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="bg-transparent text-xs text-muted-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="return">{t("invest.topReturn")}</option>
                    <option value="progress">{t("fundraise.trending")}</option>
                    <option value="risk">{t("invest.lowestRisk")}</option>
                    <option value="new">{t("invest.newest")}</option>
                  </select>
                </div>
              </div>

              {/* Category filter */}
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3.5 py-2 rounded-xl border transition-colors cursor-pointer shrink-0",
                      category === cat.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <cat.icon size={12} className={category === cat.key ? "text-primary-foreground" : cat.color} />
                    {t(cat.label)}
                  </button>
                ))}
              </div>

              {/* Featured */}
              {category === "all" && !search && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Star size={13} className="text-amber-700" />
                    <span className="text-xs font-black uppercase tracking-wider">{t("invest.featuredVentures")}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {featured.map(p => <PitchCard key={p.id} pitch={p} onSelect={setSelected} onInvest={setInvesting} />)}
                  </div>
                </div>
              )}

              {/* All pitches */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider">
                    {category === "all" && !search ? t("invest.allPitches") : `Results (${filtered.length})`}
                  </span>
                </div>
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">{t("invest.noPitchesFoundFor")}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(p => <PitchCard key={p.id} pitch={p} onSelect={setSelected} onInvest={setInvesting} />)}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── PITCH DETAIL ── */}
          {tab === "browse" && selected && (
            <motion.div key="detail" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PitchDetail pitch={selected} onBack={() => setSelected(null)} onInvest={setInvesting} />
            </motion.div>
          )}

          {/* ── PORTFOLIO ── */}
          {tab === "portfolio" && (
            <motion.div key="portfolio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PortfolioView onBrowse={() => setTab("browse")} currentUserId={currentUser?.id} realInvestments={realInvestments} realPitches={realPitches} />
            </motion.div>
          )}

          {/* ── LEADERBOARD ── */}
          {tab === "leaderboard" && (
            <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LeaderboardView
                realLeaderboard={realLeaderboard} currentUserId={currentUser?.id}
                realSectorPopularity={realSectorPopularity} realPlatformImpact={realPlatformImpact}
              />
            </motion.div>
          )}

          {/* ── SUBMIT ── */}
          {tab === "submit" && (
            <motion.div key="submit" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SubmitPitch onBack={() => setTab("browse")} currentUserId={currentUser?.id} onSubmit={createPitchMutation} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Invest modal */}
      <AnimatePresence>
        {investing && (
          <InvestModal
            pitch={investing}
            currentUserId={currentUser?.id}
            onInvest={(args) => investInPitchMutation(args)}
            onClose={() => setInvesting(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
