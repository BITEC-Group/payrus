import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFeatureAccess } from "@/hooks/use-feature-access.ts";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { useAddLinkedPaymentMethodMutation, useCardsForUser, useLinkedPaymentMethods, useSeedDefaultLinkedPaymentMethodsMutation, useSetCardLockedMutation, useWalletViewsForUser } from "@/hooks/use-backend.ts";
import { CardDetailsDialog, CardSettingsDialog, IssueCardDialog, LinkedAccountDialog } from "./card-dialogs.tsx";
import type { LinkedPaymentMethod } from "@/lib/backend.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import CapabilityBadge from "@/components/ui/capability-badge.tsx";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Eye, EyeOff, Lock, Unlock, Settings2, Plus, Wifi, Shield,
  Copy, RefreshCw, ArrowUpRight, ArrowDownLeft, ChevronRight,
  Nfc, Zap, Star, Globe, CreditCard, BadgeCheck
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { getAnonId } from "@/lib/anon-id.ts";
import { PayRusLogo } from "@/pages/layout/AppLayout.tsx";
import AddPaymentMethodSheet, { PAYMENT_PROVIDERS, type LinkedMethodProvider } from "@/components/ui/add-payment-method-sheet.tsx";

/* ─── Card data ─────────────────────────────────────────── */
const CARDS = [
  {
    id: 1,
    tier: "Prime",
    brand: "Visa",
    last4: "4821",
    holder: "JEAN DUPONT",
    expiry: "09/27",
    cvv: "***",
    balance: 12485.50,
    currency: "USD",
    type: "Virtual",
    network: "Visa Infinite",
    contactless: true,
    // Gradient: deep navy → teal (Visa Prime)
    gradient: "from-[#0d1b4b] via-[#1a3a6b] to-[#0e5c7e]",
    shimmer: "from-white/0 via-white/10 to-white/0",
    accentColor: "#4fc3f7",
    locked: false,
    monthlySpend: 320,
    monthlyLimit: 5000,
  },
  {
    id: 2,
    tier: "Platinum",
    brand: "Mastercard",
    last4: "9302",
    holder: "JEAN DUPONT",
    expiry: "03/26",
    cvv: "***",
    balance: 3820.00,
    currency: "USD",
    type: "Physical",
    network: "Mastercard World Elite",
    contactless: true,
    // Gradient: near-black → charcoal → dark gold (Platinum MC)
    gradient: "from-[#1a1a1a] via-[#2a2a2a] to-[#3d2f0f]",
    shimmer: "from-white/0 via-yellow-200/10 to-white/0",
    accentColor: "#fbbf24",
    locked: false,
    monthlySpend: 1200,
    monthlyLimit: 10000,
  },
  {
    id: 3,
    tier: "Business",
    brand: "Visa",
    last4: "7701",
    holder: "PAYRUS SARL",
    expiry: "12/28",
    cvv: "***",
    balance: 55000.00,
    currency: "XAF",
    type: "Corporate",
    network: "Visa Business",
    contactless: true,
    // Gradient: forest green → emerald (Business)
    gradient: "from-[#064e3b] via-[#065f46] to-[#047857]",
    shimmer: "from-white/0 via-green-200/10 to-white/0",
    accentColor: "#6ee7b7",
    locked: false,
    monthlySpend: 8500,
    monthlyLimit: 50000,
  },
  {
    id: 4,
    tier: "Diaspora",
    brand: "Mastercard",
    last4: "5510",
    holder: "JEAN DUPONT",
    expiry: "06/29",
    cvv: "***",
    balance: 2100.00,
    currency: "EUR",
    type: "Virtual",
    network: "Mastercard Standard",
    contactless: true,
    // Gradient: deep purple → violet (Diaspora)
    gradient: "from-[#2e1065] via-[#4c1d95] to-[#6d28d9]",
    shimmer: "from-white/0 via-purple-200/10 to-white/0",
    accentColor: "#c4b5fd",
    locked: false,
    monthlySpend: 450,
    monthlyLimit: 3000,
  },
] as const;

type CardData = {
  id: number;
  /** Database id of a real (signed-in) card; the demo deck has none. */
  realId?: string;
  tier: string;
  brand: string;
  last4: string;
  holder: string;
  expiry: string;
  cvv: string;
  balance: number;
  currency: string;
  type: string;
  network: string;
  contactless: boolean;
  gradient: string;
  shimmer: string;
  accentColor: string;
  locked: boolean;
  monthlySpend: number;
  monthlyLimit: number;
};

/* ─── Chip SVG ─────────────────────────────────────────── */
function ChipSVG({ color = "#d4af37" }: { color?: string }) {
  return (
    <svg width="42" height="32" viewBox="0 0 42 32" fill="none">
      <rect x="0.5" y="0.5" width="41" height="31" rx="4.5" stroke={color} strokeOpacity="0.5" fill={color} fillOpacity="0.18" />
      <rect x="14" y="0.5" width="14" height="31" rx="0" stroke={color} strokeOpacity="0.3" fill="none" />
      <rect x="0.5" y="10" width="41" height="12" rx="0" stroke={color} strokeOpacity="0.3" fill="none" />
      <rect x="14" y="10" width="14" height="12" rx="1" stroke={color} strokeOpacity="0.5" fill={color} fillOpacity="0.2" />
      <line x1="21" y1="0.5" x2="21" y2="10" stroke={color} strokeOpacity="0.3" />
      <line x1="21" y1="22" x2="21" y2="31.5" stroke={color} strokeOpacity="0.3" />
    </svg>
  );
}

/* ─── Visa Logo SVG ────────────────────────────────────── */
function VisaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 26" className={className} fill="none">
      <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="26" fill="white" letterSpacing="-1" opacity="0.95">VISA</text>
    </svg>
  );
}

/* ─── Mastercard Logo SVG ──────────────────────────────── */
function MastercardLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 38" className={className} fill="none">
      <circle cx="20" cy="19" r="18" fill="#EB001B" />
      <circle cx="40" cy="19" r="18" fill="#F79E1B" />
      <path d="M30 5.8C33.8 8.2 36.4 12.3 36.4 19s-2.6 10.8-6.4 13.2C20.2 29.8 17.6 25.7 17.6 19s2.6-10.8 12.4-13.2z" fill="#FF5F00" />
    </svg>
  );
}

/* ─── Contactless Wave SVG ─────────────────────────────── */
function ContactlessIcon({ color = "white" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5C5 8.36 8.36 5 12.5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path d="M7.5 12.5C7.5 9.74 9.74 7.5 12.5 7.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d="M10 12.5C10 11.12 11.12 10 12.5 10" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="12.5" cy="12.5" r="1.5" fill={color} />
    </svg>
  );
}

/* ─── Card Face Component ──────────────────────────────── */
function CardFace({
  card,
  showBalances,
  selected,
  onClick,
}: {
  card: CardData;
  showBalances: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const chipColor = card.accentColor;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative shrink-0 w-80 h-48 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 select-none",
        "bg-gradient-to-br", card.gradient,
        selected ? "ring-2 ring-primary shadow-2xl shadow-primary/30 scale-[1.02]" : "opacity-85 hover:opacity-100 hover:scale-[1.01]"
      )}
      style={{ boxShadow: selected ? `0 8px 40px ${card.accentColor}30` : undefined }}
    >
      {/* Locked overlay */}
      {card.locked && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-2xl">
          <div className="flex flex-col items-center gap-2">
            <Lock size={28} className="text-white/90" />
            <span className="text-white/70 text-xs font-medium tracking-wider uppercase">Card Locked</span>
          </div>
        </div>
      )}

      {/* Shimmer overlay */}
      <div className={cn("absolute inset-0 bg-gradient-to-r opacity-0 hover:opacity-100 transition-opacity duration-700 -skew-x-12 translate-x-full hover:translate-x-[-200%]", card.shimmer)} />

      {/* Glossy top strip */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/20" />
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/10 to-transparent" />

      {/* Card body */}
      <div className="relative z-10 h-full flex flex-col justify-between p-5">

        {/* Row 1: PayRus logo + tier badge + contactless */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-white px-2 py-0.5 shadow-sm shadow-black/20">
              <PayRusLogo className="h-4 w-auto" />
            </div>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ backgroundColor: `${card.accentColor}30`, color: card.accentColor, border: `1px solid ${card.accentColor}50` }}
            >
              {card.tier}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {card.contactless && <ContactlessIcon />}
            <Wifi size={14} className="text-white/60" />
          </div>
        </div>

        {/* Row 2: Chip + card type badge */}
        <div className="flex items-center gap-3">
          <ChipSVG color={chipColor} />
          <span className="text-[10px] text-white/50 uppercase tracking-widest font-mono">{card.type}</span>
        </div>

        {/* Row 3: Card number */}
        <div className="font-mono text-[15px] font-bold tracking-[0.2em] text-white/90">
          •••• &nbsp;•••• &nbsp;•••• &nbsp;{card.last4}
        </div>

        {/* Row 4: Holder / Expiry / Network logo */}
        <div className="flex items-end justify-between">
          <div className="flex gap-6">
            <div>
              <div className="text-[9px] text-white/40 uppercase tracking-widest mb-0.5">Card Holder</div>
              <div className="text-[11px] font-semibold text-white/90 font-mono tracking-wider">{card.holder}</div>
            </div>
            <div>
              <div className="text-[9px] text-white/40 uppercase tracking-widest mb-0.5">Expires</div>
              <div className="text-[11px] font-semibold text-white/90 font-mono">{card.expiry}</div>
            </div>
          </div>
          {/* Network logo */}
          <div className="flex items-center">
            {card.brand === "Visa" ? (
              <VisaLogo className="h-6 w-auto" />
            ) : (
              <div className="flex items-center gap-1">
                <MastercardLogo className="h-7 w-auto" />
                <span className="text-[8px] font-bold text-white/70 leading-tight text-left ml-1" style={{ maxWidth: 40 }}>
                  {card.network.replace("Mastercard ", "")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─── Main Page ────────────────────────────────────────── */
export default function Cards() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const access = useFeatureAccess();
  const [cards, setCards] = useState<CardData[]>(CARDS.map(c => ({ ...c })));
  const [showBalances, setShowBalances] = useState(true);
  const [activeCard, setActiveCard] = useState(0);
  const selectedCardId = useRef<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"details" | "linked">("details");
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "details" | "settings" | "issue">(null);
  const [accountDetails, setAccountDetails] = useState<LinkedPaymentMethod | null>(null);
  const ownerKey = useState(getAnonId)[0];
  const linkedAccounts = useLinkedPaymentMethods(ownerKey);
  const addLinkedMethod = useAddLinkedPaymentMethodMutation();
  const seedDefaults = useSeedDefaultLinkedPaymentMethodsMutation();

  // Real per-user cards when signed in — falls back to the shared demo
  // deck above for anonymous/no-account preview visitors.
  const currentUser = useCurrentAppUser();
  const realCards = useCardsForUser(currentUser?.id);
  const setCardLocked = useSetCardLockedMutation();
  const wallets = useWalletViewsForUser(currentUser?.id);

  const card = cards[activeCard];

  useEffect(() => {
    if (linkedAccounts?.length === 0) void seedDefaults(ownerKey);
  }, [linkedAccounts, ownerKey, seedDefaults]);

  useEffect(() => {
    if (realCards && realCards.length > 0) {
      setCards(realCards.map((c, i) => ({
        id: i,
        realId: c.id,
        tier: c.tier, brand: c.brand, last4: c.last4, holder: c.holder, expiry: c.expiry,
        cvv: "***", balance: c.balance, currency: c.currency, type: c.type, network: c.network,
        contactless: c.contactless, gradient: c.gradient, shimmer: c.shimmer, accentColor: c.accentColor,
        locked: c.locked, monthlySpend: c.monthlySpend, monthlyLimit: c.monthlyLimit,
      })));
      // Keep the card the customer is looking at when the list refreshes (after a lock or a settings change): by its id, not its position.
      const keep = realCards.findIndex((c) => c.id === selectedCardId.current);
      setActiveCard((prev) => (keep >= 0 ? keep : Math.min(prev, realCards.length - 1)));
    }
  }, [realCards]);

  const addLinkedAccount = (provider: LinkedMethodProvider) => {
    const providerMeta = PAYMENT_PROVIDERS.find(p => p.id === provider)!;
    const label = t(providerMeta.labelKey);
    void addLinkedMethod({ ownerKey, provider, label });
    toast.success(t("cards.toast.methodLinked", { name: label }));
  };

  // A real card's lock is stored in the database (it used to flip in browser memory only, so a reload put the card back in service).
  const toggleLock = async () => {
    const nextLocked = !card.locked;
    if (card.realId && currentUser) {
      try {
        await setCardLocked({ userId: currentUser.id, cardId: card.realId, locked: nextLocked });
      } catch {
        toast.error(t("cards.toast.lockFailed"));
        return;
      }
    } else {
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, locked: nextLocked } : c));
    }
    toast.success(nextLocked ? t("cards.toast.locked") : t("cards.toast.unlocked"));
  };

  const copyNumber = () => {
    // Only the last four digits exist in the database, so copy the card's identifying details rather than a fake number.
    navigator.clipboard.writeText(`${card.brand} •••• ${card.last4} · ${card.expiry} · ${card.holder}`).catch(() => {});
    toast.success(t("cards.toast.numberCopied"));
  };

  const spendPct = Math.min(100, Math.round((card.monthlySpend / card.monthlyLimit) * 100));

  const PERKS: Record<string, string[]> = {
    Prime: ["cards.perk.primeCashback", "cards.perk.primeAtm", "cards.perk.primeMiles", "cards.perk.primeTravelInsurance"],
    Platinum: ["cards.perk.platinumCashback", "cards.perk.platinumLounge", "cards.perk.platinumConcierge", "cards.perk.platinumPurchaseProtection"],
    Business: ["cards.perk.businessExpenseMgmt", "cards.perk.businessVolumeDiscount", "cards.perk.businessReports", "cards.perk.businessVirtualCard"],
    Diaspora: ["cards.perk.diasporaFreeTransfers", "cards.perk.diasporaFxRate", "cards.perk.diasporaInstallments", "cards.perk.diasporaHealthInsurance"],
  };

  const cardPerks = PERKS[card.tier] ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title={t("cards.title")} className="mb-4 md:mb-6" />
      {/* ── Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="rounded-lg bg-white px-2 py-1 shadow-md shadow-black/30">
              <PayRusLogo className="h-5 w-auto" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">PayRus Card <CapabilityBadge capability="card.issue" /></h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("cards.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowBalances(!showBalances)}
          className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-primary/10 transition-colors cursor-pointer"
        >
          {showBalances ? <Eye size={16} className="text-muted-foreground" /> : <EyeOff size={16} className="text-muted-foreground" />}
        </button>
      </div>

      {/* ── Combined balance banner */}
      <div className="mb-5 rounded-[24px] bg-[linear-gradient(135deg,rgba(10,47,92,0.10),rgba(14,127,176,0.08),rgba(10,47,92,0.04))] border border-primary/20 px-5 py-3 flex items-center justify-between shadow-[0_18px_30px_rgba(15,23,42,0.04)]">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
            <Zap size={10} className="text-primary" /> {t("cards.combinedBalance")}
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-0.5">
            {showBalances ? "$19,460.00" : "•••••••"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {t("cards.activeSourcesSummary", { count: cards.length })}
          </div>
        </div>
        <div className="flex -space-x-1">
          {["🟢","🏦","🏦","🟠","₿"].map((icon, i) => (
            <div key={i} className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-xs">{icon}</div>
          ))}
        </div>
      </div>

      {/* ── Card carousel */}
      <div className="flex gap-4 overflow-x-auto pb-3 mb-5 snap-x snap-mandatory">
        {cards.map((c, i) => (
          <div key={c.id} className="snap-start">
            <CardFace card={c} showBalances={showBalances} selected={activeCard === i} onClick={() => { selectedCardId.current = c.realId; setActiveCard(i); }} />
          </div>
        ))}
        {/* Add card */}
        <button
          onClick={() => setDialog("issue")} data-testid="issue-card-button"
          className="shrink-0 w-40 h-48 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer snap-start"
        >
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <Plus size={20} />
          </div>
          <span className="text-xs font-medium text-center px-2">{t("cards.addCard")}</span>
        </button>
      </div>

      {/* ── Card detail panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCard}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="rounded-[26px] bg-card border border-border/80 overflow-hidden shadow-[0_18px_38px_rgba(15,23,42,0.04)]"
        >
          {/* Tabs */}
          <div className="flex gap-2 border-b border-border bg-secondary/30 p-2">
            {(["details", "linked"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer",
                  activeTab === tab ? "text-primary bg-white shadow-sm border border-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "details" ? t("cards.tabDetails") : `${t("cards.tabLinked")} (${linkedAccounts?.length ?? 0})`}
              </button>
            ))}
          </div>

          {activeTab === "details" && (
            <div className="p-5 space-y-5">
              {/* Status + balance */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{card.brand} •••• {card.last4} · {card.network}</div>
                  <div className="text-2xl font-bold font-mono text-foreground mt-0.5">
                    {showBalances ? `${card.currency} ${card.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "•••••"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", card.locked ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary")}>
                    {card.locked ? t("cards.locked") : t("cards.active")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{card.type}</span>
                </div>
              </div>

              {/* Monthly spend bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{t("cards.spentThisMonth")}</span>
                  <span>${card.monthlySpend} / ${card.monthlyLimit.toLocaleString()}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${spendPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={cn("h-full rounded-full", spendPct > 80 ? "bg-destructive" : "bg-primary")}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{t("cards.pctLimitUsed", { pct: spendPct })}</div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: card.locked ? t("cards.unlock") : t("cards.lock"), icon: card.locked ? Unlock : Lock, action: toggleLock, variant: card.locked ? "destructive" : "secondary" },
                  { label: t("cards.details"), icon: Eye, action: () => setDialog("details"), variant: "secondary" },
                  { label: t("cards.copy"), icon: Copy, action: copyNumber, variant: "secondary" },
                  { label: t("cards.settings"), icon: Settings2, action: () => setDialog("settings"), variant: "secondary" },
                ].map(({ label, icon: Icon, action, variant }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-colors cursor-pointer border",
                      variant === "destructive" ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20" : "bg-secondary text-foreground border-border hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => (access.can("p2p") ? navigate(`/${lng}/p2p`) : toast.info(t("txd.restricted")))} className="flex items-center gap-2 p-3 rounded-2xl bg-secondary border border-border hover:bg-primary/10 transition-colors cursor-pointer text-sm font-medium">
                  <ArrowUpRight size={16} className="text-primary" /> {t("cards.sendMoney")}
                </button>
                <button onClick={() => navigate(`/${lng}/wallet`)} className="flex items-center gap-2 p-3 rounded-2xl bg-secondary border border-border hover:bg-primary/10 transition-colors cursor-pointer text-sm font-medium">
                  <ArrowDownLeft size={16} className="text-accent" /> {t("cards.topUpCard")}
                </button>
              </div>

              {/* Perks */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Star size={11} className="text-primary" /> {t("cards.perksHeading", { tier: card.tier })}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {cardPerks.map(perk => (
                    <div key={perk} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BadgeCheck size={13} className="text-primary shrink-0" />
                      {t(perk)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Security notice */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-secondary/50">
                <Shield size={15} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{t("cards.securedByPayRus")} · </span>
                  {t("cards.securityFeatures")}
                </p>
              </div>
            </div>
          )}

          {activeTab === "linked" && (
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("cards.linkedIntroPrefix")} <span className="text-primary font-semibold">One Limit</span>.{" "}
                {t("cards.linkedIntroSuffix")}
              </p>
              {linkedAccounts === undefined ? (
                <div className="py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</div>
              ) : (
                linkedAccounts.map((acc) => {
                  const Icon = PAYMENT_PROVIDERS.find(p => p.id === acc.provider)?.icon ?? CreditCard;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAccountDetails(acc)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary border border-border hover:bg-primary/5 transition-colors cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{acc.label}</div>
                      </div>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                        acc.status === "primary" ? "text-primary bg-primary/10 border-primary/25" : "text-emerald-700 bg-emerald-50 border-emerald-200")}>
                        {acc.status === "primary" ? t("settings.status.primary") : t("settings.status.active")}
                      </span>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </button>
                  );
                })
              )}
              <button
                onClick={() => setAddMethodOpen(true)}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus size={14} /> {t("cards.linkNewAccount")}
              </button>

              {/* Global acceptance */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-secondary/50 mt-2">
                <Globe size={14} className="text-accent shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{t("cards.globalAcceptanceTitle")} · </span>
                  {t("cards.globalAcceptanceDetails")}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Network acceptance strip */}
      <div className="mt-4 rounded-2xl border border-border bg-card/50 px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <VisaLogo className="h-5 w-auto opacity-80" />
          <div className="h-4 w-px bg-border" />
          <MastercardLogo className="h-6 w-auto opacity-80" />
        </div>
        <button
          onClick={() => setAddMethodOpen(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <Nfc size={12} />
          <span>{t("cards.networkStripAcceptance")}</span>
        </button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CreditCard size={12} className="text-primary" />
          <span className="text-primary font-medium">{t("cards.networkStripCountries")}</span>
        </div>
      </div>

      <AddPaymentMethodSheet open={addMethodOpen} onOpenChange={setAddMethodOpen} onAdd={addLinkedAccount} />
      {dialog === "details" && <CardDetailsDialog card={card} onClose={() => setDialog(null)} />}
      {dialog === "settings" && <CardSettingsDialog card={card} userId={currentUser?.id} onClose={() => setDialog(null)} />}
      {dialog === "issue" && (
        <IssueCardDialog userId={currentUser?.id} currencies={Array.from(new Set((wallets ?? []).map((w) => w.currency)))} defaultCurrency={currentUser?.transactionCurrency ?? "USD"} onClose={() => setDialog(null)} />
      )}
      {accountDetails && (
        <LinkedAccountDialog account={accountDetails} providerLabel={PAYMENT_PROVIDERS.find((p) => p.id === accountDetails.provider) ? t(PAYMENT_PROVIDERS.find((p) => p.id === accountDetails.provider)!.labelKey) : accountDetails.provider} onClose={() => setAccountDetails(null)} />
      )}
    </div>
  );
}
