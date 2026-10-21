import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Bell, CheckCheck, ArrowDownLeft, ArrowUpRight, Shield,
  TrendingUp, Heart, Plane, Sparkles, AlertTriangle,
  Gift, RefreshCw, Info, Clock, X, Zap, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useProfile } from "@/contexts/profile-context.tsx";
import { toast } from "sonner";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useNotificationsForUser, useMarkNotificationReadMutation } from "@/hooks/use-backend.ts";
import { localizeNotification } from "@/lib/db-notifications.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifCategory = "all" | "transactions" | "security" | "updates" | "promotions";

type NotifType = "credit" | "debit" | "security" | "campaign" | "travel" | "system" | "promo" | "alert";

interface Notification {
  id: string;
  type: NotifType;
  titleKey: string;
  bodyKey: string;
  minutesAgo: number;
  read: boolean;
  amount?: number;
  currency?: string;
  category: NotifCategory;
  emoji: string;
  /** Text written by the database (already in sentence form): shown as is, never looked up as a translation key. */
  literal?: boolean;
}

// ── Mock data (profile-adaptive) ──────────────────────────────────────────────

const SHARED_NOTIFS: Notification[] = [
  {
    id: "n1", type: "credit", category: "transactions",
    titleKey: "notifications.n1Title", bodyKey: "notifications.n1Body",
    minutesAgo: 3, read: false, amount: 75000, currency: "XAF", emoji: "💸",
  },
  {
    id: "n2", type: "security", category: "security",
    titleKey: "notifications.n2Title", bodyKey: "notifications.n2Body",
    minutesAgo: 12, read: false, emoji: "🔐",
  },
  {
    id: "n3", type: "credit", category: "transactions",
    titleKey: "notifications.n3Title", bodyKey: "notifications.n3Body",
    minutesAgo: 28, read: false, amount: 1200000, currency: "CDF", emoji: "🌍",
  },
  {
    id: "n4", type: "campaign", category: "transactions",
    titleKey: "notifications.n4Title", bodyKey: "notifications.n4Body",
    minutesAgo: 60, read: true, amount: 10000, currency: "XAF", emoji: "❤️",
  },
  {
    id: "n5", type: "travel", category: "promotions",
    titleKey: "notifications.n5Title", bodyKey: "notifications.n5Body",
    minutesAgo: 120, read: true, emoji: "✈️",
  },
  {
    id: "n6", type: "alert", category: "security",
    titleKey: "notifications.n6Title", bodyKey: "notifications.n6Body",
    minutesAgo: 180, read: true, emoji: "📊",
  },
  {
    id: "n7", type: "debit", category: "transactions",
    titleKey: "notifications.n7Title", bodyKey: "notifications.n7Body",
    minutesAgo: 300, read: true, amount: -5000, currency: "XAF", emoji: "📱",
  },
  {
    id: "n8", type: "promo", category: "promotions",
    titleKey: "notifications.n8Title", bodyKey: "notifications.n8Body",
    minutesAgo: 1440, read: true, emoji: "🏨",
  },
  {
    id: "n9", type: "system", category: "updates",
    titleKey: "notifications.n9Title", bodyKey: "notifications.n9Body",
    minutesAgo: 1500, read: true, emoji: "🚀",
  },
  {
    id: "n10", type: "alert", category: "security",
    titleKey: "notifications.n10Title", bodyKey: "notifications.n10Body",
    minutesAgo: 2880, read: true, emoji: "✅",
  },
  {
    id: "n11", type: "credit", category: "transactions",
    titleKey: "notifications.n11Title", bodyKey: "notifications.n11Body",
    minutesAgo: 4320, read: true, amount: 612, currency: "USD", emoji: "💰",
  },
  {
    id: "n12", type: "promo", category: "promotions",
    titleKey: "notifications.n12Title", bodyKey: "notifications.n12Body",
    minutesAgo: 4400, read: true, emoji: "🐷",
  },
];

// Add profile-specific notifications at the top
function getProfileNotifs(profileType: string): Notification[] {
  const base = [...SHARED_NOTIFS];

  const profileSpecific: Partial<Record<string, Notification[]>> = {
    group: [
      { id: "pf1", type: "alert", category: "transactions", titleKey: "notifications.pf1Title", bodyKey: "notifications.pf1Body", minutesAgo: 5, read: false, emoji: "⚠️" },
      { id: "pf2", type: "credit", category: "transactions", titleKey: "notifications.pf2Title", bodyKey: "notifications.pf2Body", minutesAgo: 60, read: false, amount: 840000000, currency: "CDF", emoji: "🏛️" },
    ],
    agent: [
      { id: "mf1", type: "alert", category: "security", titleKey: "notifications.mf1Title", bodyKey: "notifications.mf1Body", minutesAgo: 8, read: false, emoji: "🔴" },
      { id: "mf2", type: "credit", category: "transactions", titleKey: "notifications.mf2Title", bodyKey: "notifications.mf2Body", minutesAgo: 30, read: false, amount: 680000, currency: "CDF", emoji: "✅" },
    ],
    merchant: [
      { id: "ins1", type: "alert", category: "transactions", titleKey: "notifications.ins1Title", bodyKey: "notifications.ins1Body", minutesAgo: 10, read: false, emoji: "📋" },
    ],
    public_institution: [
      { id: "gov1", type: "credit", category: "transactions", titleKey: "notifications.gov1Title", bodyKey: "notifications.gov1Body", minutesAgo: 2, read: false, amount: 420000, currency: "USD", emoji: "🏛️" },
    ],
    treasury: [
      { id: "inv1", type: "alert", category: "transactions", titleKey: "notifications.inv1Title", bodyKey: "notifications.inv1Body", minutesAgo: 15, read: false, emoji: "📊" },
    ],
  };

  const specific = profileSpecific[profileType] ?? [];
  return [...specific, ...base];
}

// ── Real notifications (supabase/migrations/0015) ────────────────────────────
// Generated server-side by deposit_to_wallet/apply_wallet_transfer/
// convert_between_wallets/redeem_payment_link with plain-text title/body
// (not i18n keys) — reused here via titleKey/bodyKey since i18next's t()
// returns an unrecognized key as-is, same fallback dashboard/page.tsx and
// wallet-history-sheet.tsx already rely on for real transaction labels.
const REAL_NOTIF_TYPE: Record<string, NotifType> = {
  deposit: "credit", transfer: "debit", payment: "debit", remittance: "debit", convert: "system", payment_link: "credit",
};
const REAL_NOTIF_EMOJI: Record<string, string> = {
  deposit: "➕", transfer: "↔️", payment: "💳", remittance: "🌍", convert: "🔁", payment_link: "🔗",
  welcome: "👋", wallet: "👛", card: "💳",
};

function toDisplayNotification(n: { id: string; kind: string; title: string; body: string; read: boolean; createdAt: string }, t: TFunction): Notification {
  const localized = localizeNotification(n, t);
  return {
    id: n.id,
    type: REAL_NOTIF_TYPE[n.kind] ?? "system",
    category: "transactions",
    titleKey: localized.title,
    bodyKey: localized.body,
    minutesAgo: Math.max(0, Math.round((Date.now() - new Date(n.createdAt).getTime()) / 60000)),
    read: n.read,
    emoji: REAL_NOTIF_EMOJI[n.kind] ?? "🔔",
    literal: true,
  };
}

// ── Relative time formatting ─────────────────────────────────────────────────

function formatRelativeTime(minutesAgo: number, tItem: TFunction): string {
  if (minutesAgo < 60) return tItem("notifications.timeMinutesAgo", { count: minutesAgo });
  if (minutesAgo < 60 * 24) return tItem("notifications.timeHoursAgo", { count: Math.floor(minutesAgo / 60) });
  if (minutesAgo < 60 * 24 * 2) return tItem("common.yesterday");
  return tItem("notifications.timeDaysAgo", { count: Math.floor(minutesAgo / (60 * 24)) });
}

// ── Notif type styling ────────────────────────────────────────────────────────

function notifStyle(type: NotifType) {
  return {
    credit:   { bg: "bg-emerald-50", icon: ArrowDownLeft, color: "text-emerald-700" },
    debit:    { bg: "bg-amber-50",   icon: ArrowUpRight,  color: "text-amber-700" },
    security: { bg: "bg-red-50",     icon: Shield,        color: "text-red-700" },
    campaign: { bg: "bg-red-50",     icon: Heart,         color: "text-red-700" },
    travel:   { bg: "bg-blue-50",    icon: Plane,         color: "text-blue-700" },
    system:   { bg: "bg-primary/10",     icon: Sparkles,      color: "text-primary" },
    promo:    { bg: "bg-violet-50",  icon: Gift,          color: "text-violet-700" },
    alert:    { bg: "bg-orange-50",  icon: AlertTriangle, color: "text-orange-700" },
  }[type];
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { t } = useTranslation("common");
  const { profile } = useProfile();
  const profileType = profile?.type ?? "personal";
  const [mockNotifs, setMockNotifs] = useState<Notification[]>(() => getProfileNotifs(profileType));
  const [activeCategory, setActiveCategory] = useState<NotifCategory>("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dismissedRealIds, setDismissedRealIds] = useState<Set<string>>(new Set());
  const [realCleared, setRealCleared] = useState(false);

  const currentUser = useCurrentAppUser();
  const realNotifs = useNotificationsForUser(currentUser?.id);
  const markRealRead = useMarkNotificationReadMutation(currentUser?.id);

  // Real notifications when signed in with at least one; anonymous/no-
  // activity-yet visitors keep the existing profile-adaptive mock feed —
  // same fallback convention as dashboard/page.tsx's activity list. Dismiss/
  // clear-all are local-only for real data (no delete RPC exists — out of
  // scope, see the migration plan); markRead goes through the real mutation
  // instead so it actually persists.
  const hasReal = !!realNotifs && realNotifs.length > 0;
  const allNotifs: Notification[] = hasReal
    ? (realCleared ? [] : realNotifs.filter(n => !dismissedRealIds.has(n.id)).map((n) => toDisplayNotification(n, t)))
    : mockNotifs;

  const unreadCount = allNotifs.filter(n => !n.read).length;

  const filtered = allNotifs.filter(n =>
    activeCategory === "all" || n.category === activeCategory
  );

  const markAllRead = () => {
    if (hasReal) {
      allNotifs.filter(n => !n.read).forEach(n => void markRealRead(n.id));
    } else {
      setMockNotifs(prev => prev.map(n => ({ ...n, read: true })));
    }
    toast.success(t("notifications.markedAllRead"));
  };

  const markRead = (id: string) => {
    if (hasReal) {
      void markRealRead(id);
    } else {
      setMockNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const dismiss = (id: string) => {
    if (hasReal) {
      setDismissedRealIds(prev => new Set(prev).add(id));
    } else {
      setMockNotifs(prev => prev.filter(n => n.id !== id));
    }
  };

  const clearAll = () => {
    if (hasReal) {
      setRealCleared(true);
    } else {
      setMockNotifs([]);
    }
    setShowClearConfirm(false);
    toast.success(t("notifications.clearedAll"));
  };

  const CATEGORIES = [
    { id: "all" as const, label: t("notifications.catAll"), count: allNotifs.length },
    { id: "transactions" as const, label: t("notifications.catTransactions"), count: allNotifs.filter(n => n.category === "transactions").length },
    { id: "security" as const, label: t("notifications.catSecurity"), count: allNotifs.filter(n => n.category === "security").length },
    { id: "promotions" as const, label: t("notifications.catOffers"), count: allNotifs.filter(n => n.category === "promotions").length },
    { id: "updates" as const, label: t("notifications.catUpdates"), count: allNotifs.filter(n => n.category === "updates").length },
  ];

  // Group by date
  const grouped: { label: string; items: Notification[] }[] = [];
  const recentItems = filtered.filter(n => n.minutesAgo < 60 * 24);
  const yesterdayItems = filtered.filter(n => n.minutesAgo >= 60 * 24 && n.minutesAgo < 60 * 24 * 2);
  const olderItems = filtered.filter(n => n.minutesAgo >= 60 * 24 * 2);

  if (recentItems.length) grouped.push({ label: t("notifications.today"), items: recentItems });
  if (yesterdayItems.length) grouped.push({ label: t("notifications.yesterday"), items: yesterdayItems });
  if (olderItems.length) grouped.push({ label: t("notifications.older"), items: olderItems });

  return (
    <div className="flex flex-col h-full">
      {/* Back navigation */}
      <div className="px-5 pt-5 pb-0 shrink-0">
        <PageHeader title={t("notifications.title")} className="mb-4 md:mb-6" />
      </div>
      {/* Header */}
      <div className="px-5 pt-0 pb-4 border-b border-border bg-sidebar/40 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Bell size={18} className="text-primary" />
              </div>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                  <span className="text-[10px] text-white font-black">{unreadCount > 9 ? "9+" : unreadCount}</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-base font-black text-foreground">{t("notifications.title")}</h1>
              <p className="text-[11px] text-muted-foreground">{unreadCount > 0 ? t("notifications.unread", { count: unreadCount }) : t("notifications.allCaughtUp")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors">
                <CheckCheck size={12} /> {t("notifications.markAllRead")}
              </button>
            )}
            <button onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground border border-border cursor-pointer hover:bg-secondary transition-colors">
              <X size={12} /> {t("notifications.clearAll")}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shrink-0 cursor-pointer transition-all whitespace-nowrap",
                activeCategory === cat.id ? "bg-primary/15 text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:border-primary/20"
              )}>
              {cat.label}
              {cat.count > 0 && (
                <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-black",
                  activeCategory === cat.id ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground gap-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <Bell size={28} className="opacity-30" />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-foreground">{t("notifications.empty")}</div>
              <div className="text-xs mt-1">{t("notifications.emptySubtitle")}</div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {grouped.map(group => (
              <div key={group.label}>
                <div className="px-5 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-background/50 sticky top-0 backdrop-blur-sm border-b border-border/50">
                  {group.label}
                </div>
                <div className="divide-y divide-border">
                  {group.items.map((notif, i) => {
                    const style = notifStyle(notif.type);
                    const Icon = style.icon;
                    return (
                      <motion.div key={notif.id}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        exit={{ opacity: 0, x: 20, height: 0 }}
                        onClick={() => markRead(notif.id)}
                        className={cn(
                          "flex items-start gap-3 px-4 py-4 cursor-pointer hover:bg-secondary/40 transition-colors relative",
                          !notif.read && "bg-primary/3"
                        )}>
                        {/* Unread dot */}
                        {!notif.read && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}

                        {/* Icon */}
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-lg", style.bg)}>
                          {notif.emoji}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold text-foreground leading-snug">{notif.literal ? notif.titleKey : t(notif.titleKey)}</div>
                            <div className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{formatRelativeTime(notif.minutesAgo, t)}</div>
                          </div>
                          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{notif.literal ? notif.bodyKey : t(notif.bodyKey)}</p>
                          {notif.amount !== undefined && (
                            <div className={cn(
                              "mt-1.5 text-xs font-black font-mono",
                              notif.amount > 0 ? "text-emerald-700" : "text-foreground"
                            )}>
                              {notif.amount > 0 ? "+" : ""}{Math.abs(notif.amount).toLocaleString()} {notif.currency}
                            </div>
                          )}
                        </div>

                        {/* Dismiss */}
                        <button
                          onClick={e => { e.stopPropagation(); dismiss(notif.id); }}
                          className="p-1 rounded-lg hover:bg-secondary cursor-pointer transition-colors shrink-0 opacity-0 group-hover:opacity-100 mt-0.5">
                          <X size={12} className="text-muted-foreground" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Live indicator */}
            <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t("notifications.live")}
            </div>
          </div>
        )}
      </div>

      {/* Clear confirm modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-destructive" />
              </div>
              <div>
                <div className="text-base font-black text-foreground">{t("notifications.clearConfirmTitle")}</div>
                <div className="text-sm text-muted-foreground mt-1">{t("notifications.clearConfirmBody")}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowClearConfirm(false)}
                  className="py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary cursor-pointer transition-colors">
                  {t("common.cancel")}
                </button>
                <button onClick={clearAll}
                  className="py-2.5 rounded-xl bg-destructive text-white text-sm font-bold cursor-pointer hover:bg-destructive/90 transition-colors">
                  {t("notifications.clearConfirmAction")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
