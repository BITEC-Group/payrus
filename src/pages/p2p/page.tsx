"use client";
import { useEffect, useState } from "react";
import { transactionErrorMessage } from "@/lib/transaction-errors.ts";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Search, QrCode, UserPlus, ArrowRight, Star, Clock, Globe, Shield,
  Smartphone, Banknote, ChevronDown, CheckCircle, Send, X, ChevronRight,
  Building2, Users, MapPin, Wifi, BadgeCheck
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { requireStepUp } from "@/lib/mfa.ts";
import NewReceiverFlow from "./_components/new-receiver-flow.tsx";
import PickupCounter from "./_components/pickup-counter.tsx";
import { useProfile } from "@/contexts/profile-context.tsx";
import { useP2pTransferMutation, useWalletViewsForUser, useMyCounterparts } from "@/hooks/use-backend.ts";
import { resolveUserByIdentifier, type Counterpart, type P2pReceipt } from "@/lib/backend.ts";
import { PayRusLogo } from "@/pages/layout/AppLayout.tsx";
import { commissionFor, convertWithMargin, midMarketConvert } from "@/convex/fx.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";

/* ─── Types ───────────────────────────────────────────── */
type Step = "search" | "amount" | "confirm" | "success";

type PayRusUser = {
  id: string;
  name: string;
  username: string;
  country: string;
  countryCode: string;
  flag: string;
  avatar: string;
  currency: string;
  verified: boolean;
  online: boolean;
  role?: string;
  /** Set only for a real registered account (its users.id) — the only kind money can be sent to. */
  realId?: string;
};

/* ─── Mock PayRus network users ────────────────────────── */
const PAYRUS_USERS: PayRusUser[] = [
  { id: "u1", name: "Amara Koné", username: "@amara.kone", country: "p2p.country.cd", countryCode: "CD", flag: "🇨🇩", avatar: "AK", currency: "CDF", verified: true, online: true },
  { id: "u2", name: "Jean Makoko", username: "@jean.makoko", country: "p2p.country.cg", countryCode: "CG", flag: "🇨🇬", avatar: "JM", currency: "XAF", verified: true, online: false },
  { id: "u3", name: "Alice Umuhu", username: "@alice.umuhu", country: "p2p.country.rw", countryCode: "RW", flag: "🇷🇼", avatar: "AU", currency: "RWF", verified: true, online: true },
  { id: "u4", name: "Paulo Damba", username: "@paulo.damba", country: "p2p.country.ao", countryCode: "AO", flag: "🇦🇴", avatar: "PD", currency: "AOA", verified: false, online: true },
  { id: "u5", name: "Fatou Diallo", username: "@fatou.diallo", country: "p2p.country.sn", countryCode: "SN", flag: "🇸🇳", avatar: "FD", currency: "XOF", verified: true, online: false },
  { id: "u6", name: "Chioma Obi", username: "@chioma.obi", country: "p2p.country.ng", countryCode: "NG", flag: "🇳🇬", avatar: "CO", currency: "NGN", verified: true, online: true },
  { id: "u7", name: "Kwame Asante", username: "@kwame.asante", country: "p2p.country.gh", countryCode: "GH", flag: "🇬🇭", avatar: "KA", currency: "GHS", verified: true, online: false },
  { id: "u8", name: "Naledi Dlamini", username: "@naledi.dl", country: "p2p.country.za", countryCode: "ZA", flag: "🇿🇦", avatar: "ND", currency: "ZAR", verified: true, online: false },
  { id: "u9", name: "Yohannes Tesfaye", username: "@yohannes.t", country: "p2p.country.et", countryCode: "ET", flag: "🇪🇹", avatar: "YT", currency: "ETB", verified: false, online: true },
  { id: "u10", name: "Mariame Touré", username: "@mariame.toure", country: "p2p.country.frDiaspora", countryCode: "FR", flag: "🇫🇷", avatar: "MT", currency: "EUR", verified: true, online: true, role: "Diaspora" },
  { id: "u11", name: "Samuel Mensah", username: "@samuel.gh", country: "p2p.country.gb", countryCode: "GB", flag: "🇬🇧", avatar: "SM", currency: "GBP", verified: true, online: false, role: "Diaspora" },
  { id: "u12", name: "Aïcha Ndiaye", username: "@aicha.ndiaye", country: "p2p.country.ca", countryCode: "CA", flag: "🇨🇦", avatar: "AN", currency: "CAD", verified: true, online: true, role: "Diaspora" },
  { id: "u13", name: "Régis Nguimbi", username: "@regis.nguimbi", country: "p2p.country.ga", countryCode: "GA", flag: "🇬🇦", avatar: "RN", currency: "XAF", verified: true, online: true },
  { id: "u14", name: "Solange Bekono", username: "@solange.bekono", country: "p2p.country.cm", countryCode: "CM", flag: "🇨🇲", avatar: "SB", currency: "XAF", verified: true, online: false },
  { id: "u15", name: "Ibrahim Adoum", username: "@ibrahim.adoum", country: "p2p.country.td", countryCode: "TD", flag: "🇹🇩", avatar: "IA", currency: "XAF", verified: false, online: true },
];

const RECENT_IDS = ["u1", "u2", "u13", "u14", "u5"];

const CURRENCIES = ["CDF", "XAF", "USD", "EUR", "NGN", "GHS", "KES", "RWF", "XOF"];

const AVATAR_COLORS: Record<string, string> = {
  AK: "bg-purple-600", JM: "bg-teal-600", AU: "bg-pink-600", PD: "bg-orange-600",
  FD: "bg-emerald-600", CO: "bg-rose-600", KA: "bg-blue-600", ND: "bg-indigo-600",
  YT: "bg-amber-600", MT: "bg-cyan-600", SM: "bg-red-600", AN: "bg-green-600",
  RN: "bg-green-700", SB: "bg-fuchsia-600", IA: "bg-sky-700",
};

/* ─── Withdraw methods ─────────────────────────────────── */
const WITHDRAW_METHODS = [
  { id: "mm", labelKey: "p2p.methodMobileMoney", icon: Smartphone, descKey: "p2p.methodMobileMoneyDesc", fee: "0%" },
  { id: "bank", labelKey: "p2p.methodBank", icon: Building2, descKey: "p2p.methodBankDesc", fee: "0.5%" },
  { id: "cash", labelKey: "p2p.methodCash", icon: Banknote, descKey: "p2p.methodCashDesc", fee: "1%" },
  { id: "card", labelKey: "p2p.methodCard", icon: BadgeCheck, descKey: "p2p.methodCardDesc", fee: "0%" },
];

/* ─── Avatar ────────────────────────────────────────────── */
function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", sz, AVATAR_COLORS[initials] ?? "bg-primary")}>
      {initials}
    </div>
  );
}

/* ─── User Card ─────────────────────────────────────────── */
function UserCard({ user, onSelect }: { user: PayRusUser; onSelect: () => void }) {
  const { t } = useTranslation("common");
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border hover:bg-primary/10 hover:border-primary/30 transition-all cursor-pointer text-left group"
    >
      <div className="relative">
        <Avatar initials={user.avatar} />
        {user.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground truncate">{user.name}</span>
          {user.verified && <BadgeCheck size={12} className="text-accent shrink-0" />}
        </div>
        <div className="text-xs text-muted-foreground">{user.username} · {user.flag} {t(user.country)}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{user.currency}</span>
        {user.role && <span className="text-[9px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">{user.role}</span>}
      </div>
      <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />
    </button>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function P2PTransfer() {
  const { t } = useTranslation("common");
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<PayRusUser | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CDF");
  const [note, setNote] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<string | null>(null);
  const [showCurrencyDrop, setShowCurrencyDrop] = useState(false);
  const [sending, setSending] = useState(false);
  const [realQuery, setRealQuery] = useState("");
  const [realSearching, setRealSearching] = useState(false);

  const currentUser = useCurrentAppUser();
  const { profile } = useProfile();
  const isAgentCounter = profile?.type === "agent" || profile?.type === "admin";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const [mode, setMode] = useState<"member" | "new">(searchParams.get("mode") === "new" || searchParams.get("receiver") ? "new" : "member");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(realQuery.trim()), 200);
    return () => clearTimeout(id);
  }, [realQuery]);
  const contactsQuery = useMyCounterparts(currentUser?.id, debouncedQuery);
  const contacts = contactsQuery.data ?? [];
  const realWallets = useWalletViewsForUser(currentUser?.id);
  const p2pTransfer = useP2pTransferMutation();
  const [committed, setCommitted] = useState<P2pReceipt | null>(null);
  const demoMode = !currentUser;

  // Default a new transaction's currency to the one the user registered
  // with (src/pages/register/page.tsx sets this from their country) rather
  // than a fixed constant, once we know it.
  useEffect(() => {
    if (currentUser?.transactionCurrency) setCurrency(currentUser.transactionCurrency);
  }, [currentUser?.transactionCurrency]);

  const filtered = query.trim().length > 0
    ? PAYRUS_USERS.filter(u =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.username.toLowerCase().includes(query.toLowerCase()) ||
        t(u.country).toLowerCase().includes(query.toLowerCase())
      )
    : PAYRUS_USERS.filter(u => RECENT_IDS.includes(u.id));

  const recentUsers = PAYRUS_USERS.filter(u => RECENT_IDS.includes(u.id));

  const withdrawMethodObj = WITHDRAW_METHODS.find(m => m.id === withdrawMethod);
  const withdrawMethodLabel = withdrawMethodObj ? t(withdrawMethodObj.labelKey) : null;

  const numAmt = parseFloat(amount) || 0;
  const chargingWallet = realWallets?.find((w) => w.currency === currency) ?? realWallets?.[0];
  const commission = commissionFor(numAmt); // flat 3.5% commission, paid by the sender
  const isMulticurrency = !!chargingWallet && chargingWallet.currency !== currency;
  const fxMarginAmount = isMulticurrency
    ? convertWithMargin(numAmt + commission, currency, chargingWallet.currency).fxMargin
    : 0; // 10% FX margin only when the wallet being charged is in a different currency
  const total = numAmt + commission;
  const received = numAmt; // the recipient gets the full stated amount; margin/commission are the sender's cost

  function selectMember(found: { id: string; name: string; username: string | null; defaultCurrency: string | null }) {
    setMode("member");
    handleSelectUser({
      id: found.id, realId: found.id, name: found.name, username: found.username ? `@${found.username}` : "", country: "PayRus network", countryCode: "??",
      flag: "🌐", avatar: found.name.slice(0, 2).toUpperCase(), currency: found.defaultCurrency ?? currency, verified: true, online: false, role: "Real PayRus user",
    });
  }

  function handleSelectContact(c: Counterpart) {
    setShowSuggest(false);
    handleSelectUser({
      id: c.id, realId: c.id, name: c.name, username: c.username ? `@${c.username}` : "", country: "PayRus network", countryCode: "??",
      flag: "🌐", avatar: c.name.slice(0, 2).toUpperCase(), currency: c.lastCurrency ?? c.defaultCurrency ?? currency,
      verified: true, online: false, role: t("p2p.contactBadge"),
    });
  }

  function handleSelectUser(user: PayRusUser) {
    setSelectedUser(user);
    setStep("amount");
  }

  // Real recipient lookup — reuses the same resolve_email_by_identifier RPC
  // the recover/register pages already use, rather than a browsable
  // directory of every registered user (a real privacy concern this demo's
  // fictional PAYRUS_USERS directory never had to consider). Finds an exact
  // match by email/username/phone only; browsing/discovery stays on the
  // existing fictional list below.
  async function handleRealSearch() {
    const query = realQuery.trim();
    if (!query) return;
    setRealSearching(true);
    try {
      const found = await resolveUserByIdentifier(query);
      if (!found) {
        toast.error(t("p2p.noUserFound", { query }));
        return;
      }
      if (found.id === currentUser?.id) {
        toast.error(t("p2p.transferFailed"));
        return;
      }
      handleSelectUser({
        id: found.id,
        realId: found.id,
        name: found.name,
        username: found.username ? `@${found.username}` : "",
        country: "PayRus network",
        countryCode: "??",
        flag: "🌐",
        avatar: found.name.slice(0, 2).toUpperCase(),
        currency: found.defaultCurrency ?? currency,
        verified: true,
        online: false,
        role: "Real PayRus user",
      });
    } finally {
      setRealSearching(false);
    }
  }

  function handleSend() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t("p2p.invalidAmount"));
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm() {
    if (!currentUser) {
      // Anonymous preview — no real wallet to debit, keep the existing demo flow.
      setStep("success");
      toast.success(t("p2p.sendConfirmedToast", { currency, amount: numAmt.toLocaleString() }));
      return;
    }
    if (!selectedUser?.realId) {
      toast.error(t("p2p.transferFailed"));
      return;
    }
    if (!(await requireStepUp())) { toast.error(t("mfa.codeInvalid")); return; }
    setSending(true);
    try {
      const result = await p2pTransfer({ senderId: currentUser.id, recipientId: selectedUser.realId, amount: numAmt, currency, note: note || undefined });
      setCommitted(result);
      setStep("success");
      toast.success(t("p2p.sendConfirmedToast", { currency, amount: numAmt.toLocaleString() }));
    } catch (e) {
      toast.error(transactionErrorMessage(e, t, "p2p.transferFailed"));
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep("search");
    setSelectedUser(null);
    setCommitted(null);
    setAmount("");
    setNote("");
    setWithdrawMethod(null);
  }

  if (mode === "new" && currentUser) {
    return (
      <NewReceiverFlow
        senderId={currentUser.id}
        wallets={(realWallets ?? []).map((w) => ({ currency: w.currency, balance: w.balance }))}
        defaultCurrency={currentUser.transactionCurrency}
        initialReceiverId={searchParams.get("receiver") ?? undefined}
        onExit={() => setMode("member")}
        onSendToMember={selectMember}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title={t("p2p.title")} className="mb-4 md:mb-6" />

      {/* ── Header */}
      <div className="flex items-center gap-3 mb-6">
        <PayRusLogo className="h-5 w-auto" />
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("p2p.heading")}</h1>
          <p className="text-xs text-muted-foreground">{t("p2p.subtitle")}</p>
        </div>
      </div>

      {/* ── Coverage banner */}
      <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3 flex-wrap">
        <Globe size={14} className="text-primary shrink-0" />
        <span className="text-xs text-muted-foreground">
          <span className="text-primary font-semibold">{t("p2p.networkBanner")}</span> —
          {t("p2p.networkDesc")}
        </span>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Step 1: Search ─── */}
        {step === "search" && (
          <motion.div key="search" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

            {/* Search bar */}
            {demoMode && <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t("p2p.searchPlaceholder")}
                className="w-full pl-9 pr-10 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-colors"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>}

            {!demoMode && isAgentCounter && <PickupCounter />}

            {!demoMode && (
              <div className="mb-5 space-y-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
                  <BadgeCheck size={13} className="text-accent shrink-0 mt-0.5" />{t("p2p.memberAdvantage")}
                </div>
                <button onClick={() => setMode("new")} className="w-full text-left rounded-xl border border-border bg-card p-3 hover:border-primary/40 cursor-pointer">
                  <div className="flex items-center gap-2 text-sm font-semibold"><UserPlus size={14} className="text-primary" />{t("p2p.new.cta")}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{t("p2p.new.ctaDesc")}</div>
                </button>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex gap-2 mb-5">
              <button onClick={() => navigate(`/${lng}/scan`)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer">
                <QrCode size={14} /> {t("p2p.scanQr")}
              </button>
              <button onClick={() => { const url = `${window.location.origin}/${lng}/register`; if (navigator.share) { void navigator.share({ title: "PayRus", url }).catch(() => undefined); } else { void navigator.clipboard?.writeText(url).then(() => toast.success(t("txd.copied")), () => toast.error(t("txd.copyFailed"))); } }} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer">
                <UserPlus size={14} /> {t("p2p.inviteFriend")}
              </button>
            </div>

            {/* Real recipient lookup — a registered PayRus account, found by
                exact email/username/phone (not browsable, unlike the
                fictional directory below). */}
            <div className="mb-5 rounded-xl border border-border bg-card p-3">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Globe size={11} className="text-primary" /> {t("p2p.findRealUser")}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={realQuery}
                  onChange={e => { setRealQuery(e.target.value); setShowSuggest(true); }}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                  role="combobox"
                  aria-expanded={showSuggest && contacts.length > 0}
                  aria-autocomplete="list"
                  autoComplete="off"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const first = contacts[0];
                      if (first && realQuery.trim() && first.name.toLowerCase().startsWith(realQuery.trim().toLowerCase().replace(/^@/, ""))) handleSelectContact(first);
                      else void handleRealSearch();
                    }
                    if (e.key === "Escape") setShowSuggest(false);
                  }}
                  placeholder={t("p2p.findRealUserPlaceholder")}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={() => void handleRealSearch()}
                  disabled={realSearching || !realQuery.trim()}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer disabled:opacity-60 shrink-0"
                >
                  {realSearching ? t("signin.checking") : t("p2p.find")}
                </button>
              </div>
              {!demoMode && showSuggest && realQuery.trim() && (
                <ul role="listbox" className="mt-2 rounded-lg border border-border bg-card shadow-sm divide-y divide-border overflow-hidden">
                  {contacts.map(c => (
                    <li key={c.id}>
                      <button type="button" role="option" aria-selected={false} onMouseDown={e => e.preventDefault()} onClick={() => handleSelectContact(c)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-primary/10 cursor-pointer">
                        <Avatar initials={c.name.slice(0, 2).toUpperCase()} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{c.name}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">{c.username ? `@${c.username} · ` : ""}{c.maskedEmail ?? ""}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{t("p2p.sentTimes", { count: c.timesSent })}</span>
                      </button>
                    </li>
                  ))}
                  {contacts.length === 0 && !contactsQuery.isFetching && (
                    <li className="px-3 py-2 text-[11px] text-muted-foreground">{t("p2p.noContactMatch")}</li>
                  )}
                </ul>
              )}
            </div>

            {!demoMode && contacts.length > 0 && !realQuery.trim() && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={11} className="text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("p2p.yourContacts")}</span>
                </div>
                <div className="space-y-2">
                  {contacts.slice(0, 5).map(c => (
                    <button key={c.id} onClick={() => handleSelectContact(c)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border hover:bg-primary/10 hover:border-primary/30 transition-all cursor-pointer text-left">
                      <Avatar initials={c.name.slice(0, 2).toUpperCase()} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.username ? `@${c.username} · ` : ""}{t("p2p.lastSent", { date: new Date(c.lastSentAt).toLocaleDateString() })}</div>
                      </div>
                      {c.lastCurrency && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{c.lastCurrency}</span>}
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent / search results (fictional demo directory — anonymous preview only) */}
            {demoMode && <div>
              <div className="flex items-center gap-2 mb-3">
                {query ? (
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("p2p.resultsCount", { count: filtered.length })}</span>
                ) : (
                  <>
                    <Clock size={11} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("p2p.recent")}</span>
                  </>
                )}
              </div>
              <div className="space-y-2">
                {filtered.map(user => (
                  <UserCard key={user.id} user={user} onSelect={() => handleSelectUser(user)} />
                ))}
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    {t("p2p.noUserFound", { query })}
                  </div>
                )}
              </div>
            </div>}

            {/* All members */}
            {demoMode && !query && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={11} className="text-accent" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("p2p.allMembers")}</span>
                </div>
                <div className="space-y-2">
                  {PAYRUS_USERS.filter(u => !RECENT_IDS.includes(u.id)).map(user => (
                    <UserCard key={user.id} user={user} onSelect={() => handleSelectUser(user)} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Step 2: Amount ─── */}
        {step === "amount" && selectedUser && (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Recipient card */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary border border-border">
              <div className="relative">
                <Avatar initials={selectedUser.avatar} size="lg" />
                {selectedUser.online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-foreground">{selectedUser.name}</span>
                  {selectedUser.verified && <BadgeCheck size={14} className="text-accent" />}
                </div>
                <div className="text-sm text-muted-foreground">{selectedUser.username}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{selectedUser.flag} {t(selectedUser.country)} · {selectedUser.currency}</div>
              </div>
              <button onClick={() => setStep("search")} className="text-muted-foreground hover:text-foreground cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            {/* Amount input */}
            <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("p2p.amountToSend")}</div>

              <div className="flex gap-2">
                {/* Currency selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowCurrencyDrop(!showCurrencyDrop)}
                    className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-secondary border border-border text-sm font-bold text-foreground hover:bg-primary/10 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {currency} <ChevronDown size={12} />
                  </button>
                  {showCurrencyDrop && (
                    <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-xl shadow-xl overflow-hidden w-28">
                      {Array.from(new Set([...CURRENCIES, currency])).map(c => (
                        <button key={c} onClick={() => { setCurrency(c); setShowCurrencyDrop(false); }} className={cn("w-full px-3 py-2 text-sm font-medium text-left hover:bg-primary/10 transition-colors cursor-pointer", c === currency && "text-primary bg-primary/5")}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-4 py-3 rounded-xl bg-secondary border border-border text-xl font-bold font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {numAmt > 0 && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{t("p2p.fee")}</span>
                    <span className="text-foreground font-medium">{currency} {commission.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  {isMulticurrency && (
                    <div className="flex justify-between">
                      <span>{t("p2p.fxMargin")}</span>
                      <span className="text-foreground font-medium">{chargingWallet!.currency} {fxMarginAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t("p2p.totalDebited")}</span>
                    <span className="text-foreground font-semibold">{currency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-primary font-semibold">{t("p2p.receivedBy", { name: selectedUser.name.split(" ")[0] })}</span>
                    <span className="text-primary font-bold">{selectedUser.realId ? `${currency} ${received.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${selectedUser.currency} ${midMarketConvert(received, currency, selectedUser.currency).toLocaleString(undefined, { maximumFractionDigits: 0 })} ≈`}</span>
                  </div>
                </div>
              )}

              {/* Note */}
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t("p2p.notePlaceholder")}
                className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            {/* Withdraw method for recipient */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Banknote size={11} /> {t("p2p.withdrawMethodLabel")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {WITHDRAW_METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setWithdrawMethod(m.id)}
                    className={cn(
                      "flex flex-col gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer",
                      withdrawMethod === m.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <m.icon size={14} />
                      <span className="text-[9px] font-bold bg-primary/10 text-primary px-1 rounded">{m.fee}</span>
                    </div>
                    <div className="text-xs font-semibold text-foreground">{t(m.labelKey)}</div>
                    <div className="text-[10px] text-muted-foreground">{t(m.descKey)}</div>
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full gap-2 py-3 font-bold cursor-pointer" onClick={handleSend}>
              <Send size={16} /> {t("p2p.continueToConfirm")}
            </Button>
          </motion.div>
        )}

        {/* ── Step 3: Confirm ─── */}
        {step === "confirm" && selectedUser && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="bg-gradient-to-r from-primary/20 to-accent/10 px-5 py-4 border-b border-border flex items-center gap-3">
                <div className="rounded-md bg-white px-2 py-0.5">
                  <PayRusLogo className="h-4 w-auto" />
                </div>
                <span className="text-sm font-bold text-foreground">{t("p2p.confirmTransferTitle")}</span>
              </div>
              <div className="p-5 space-y-3">
                {[
                  [t("p2p.confirmFrom"), currentUser ? `${currentUser.name ?? currentUser.email ?? currentUser.username ?? ""} · PayRus Wallet` : "Demo · PayRus Wallet"],
                  [t("p2p.confirmTo"), `${selectedUser.name} (${selectedUser.username})`],
                  [t("p2p.confirmCountry"), `${selectedUser.flag} ${t(selectedUser.country)}`],
                  [t("p2p.amountSent"), `${currency} ${numAmt.toLocaleString()}`],
                  [t("p2p.fee"), `${currency} ${commission.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                  ...(isMulticurrency ? [[t("p2p.fxMargin"), `${chargingWallet!.currency} ${fxMarginAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`] as [string, string]] : []),
                  [t("p2p.totalDebited"), `${currency} ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                  [t("p2p.withdrawMethod"), withdrawMethod ? (withdrawMethodLabel ?? "—") : t("p2p.noneSelected")],
                  ...(note ? [[t("p2p.note"), note] as [string, string]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground text-right max-w-[55%] truncate">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="text-primary font-bold">{t("p2p.estimatedArrival")}</span>
                  <span className="text-primary font-bold">{t("p2p.instant")}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary border border-border">
              <Shield size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {t("p2p.securityDisclaimer")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" className="cursor-pointer" onClick={reset}>{t("common.cancel")}</Button>
              <Button className="gap-2 cursor-pointer font-bold" disabled={sending} onClick={() => void handleConfirm()}>
                <CheckCircle size={15} /> {sending ? t("signin.checking") : t("p2p.confirmSend")}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Success ─── */}
        {step === "success" && selectedUser && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="text-center space-y-5">

            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 flex flex-col items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
              >
                <CheckCircle size={40} className="text-primary" />
              </motion.div>

              <div>
                <div className="text-2xl font-bold text-foreground">{t("p2p.sentSuccess")}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {t("p2p.sentTo", { amount: `${committed?.currency ?? currency} ${(committed?.amount ?? numAmt).toLocaleString()}`, name: committed?.recipientName ?? selectedUser.name })}
                </div>
              </div>

              <div className="rounded-md bg-white px-3 py-1.5 shadow-sm">
                <PayRusLogo className="h-5 w-auto" />
              </div>

              <div className="flex items-center gap-2 text-xs text-primary">
                <Wifi size={12} />
                <span>{t("p2p.instant")} · {selectedUser.flag} {t(selectedUser.country)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-secondary border border-border p-4 text-xs space-y-2">
              <div className="font-semibold text-foreground text-sm mb-1">{t("p2p.transactionReference")}</div>
              <div className="font-mono text-muted-foreground">{committed?.reference ?? `PR-${Date.now().toString(36).toUpperCase()}`}</div>
              {committed && (
                <div className="text-muted-foreground">
                  {t("p2p.confirmFrom")}: {committed.senderName} → {t("p2p.confirmTo")}: {committed.recipientName}
                </div>
              )}
              <div className="text-muted-foreground">
                {t("p2p.withdrawInfo", { name: selectedUser.name, method: withdrawMethod ? withdrawMethodLabel : t("p2p.methodMobileMoney") })}
              </div>
            </div>

            <Button className="w-full gap-2 cursor-pointer" onClick={reset}>
              <ArrowRight size={15} /> {t("p2p.newTransfer")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
