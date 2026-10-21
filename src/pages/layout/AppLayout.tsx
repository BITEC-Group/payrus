import { useEffect, useState } from "react";
import { featureForPath } from "@/lib/feature-routes.ts";
import { Outlet, NavLink, useLocation, useParams, Navigate, useNavigate } from "react-router-dom";
import { LayoutDashboard, CreditCard, ArrowLeftRight, History, Wallet, Bell, Settings, Users, Send, Landmark, ShieldCheck, PlugZap, PiggyBank, Plane, Heart, HandHeart, TrendingUp, Gamepad2, Menu, LogOut, LogIn, User, CircleDollarSign, ScanLine, Receipt, LifeBuoy, Store, Link2, BarChart3, Banknote, ShoppingBag, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import LocaleSwitcher from "@/components/ui/locale-switcher.tsx";
import ProfileSwitcher from "@/components/ui/profile-switcher.tsx";
import { useProfile } from "@/contexts/profile-context.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet.tsx";
import { useCurrentAppUserState } from "@/hooks/use-current-app-user.ts";
import { listUserRolesForUser } from "@/lib/backend.ts";
import { routeAfterIdentity } from "@/lib/post-auth-routing.ts";
import { getDefaultProfile, type ProfileType } from "@/contexts/profile-context.tsx";
import { clearLocalUserId, getLocalUserId } from "@/lib/local-user.ts";
import { useProfileFeatures, useMyPermissions, useMyOrgMemberships } from "@/hooks/use-backend.ts";
import SystemStatusPill from "@/components/ui/system-status-pill.tsx";
import EnvBanner from "@/components/ui/env-banner.tsx";
import { MfaStepUpHost } from "@/components/mfa/mfa-ui.tsx";
import { supabase } from "@/lib/supabase-client.ts";
import FxRatePill from "@/components/ui/fx-rate-pill.tsx";
import LocationConsentBanner from "@/components/ui/location-consent-banner.tsx";
import { useMyModules, useSubProfiles } from "@/hooks/use-institutional.ts";
import { useWorkspaces } from "@/hooks/use-institutional-team.ts";

export function PayRusLogo({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <img
      src={`${import.meta.env.BASE_URL}payrus-logo-lockup.png`}
      alt={t("layout.AppLayout.payrusPaymentSolutionsServices")}
      className={cn("object-contain select-none", className)}
      draggable={false}
    />
  );
}

export function PayRusMark({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}payrus-icon.png`}
      alt=""
      className={cn("object-contain select-none", className)}
      draggable={false}
    />
  );
}

export default function AppLayout() {
  const location = useLocation();
  const { lng } = useParams<{ lng: string }>();
  const { t } = useTranslation("common");
  const { profile, clearProfile, setProfile } = useProfile();
  const navigate = useNavigate();
  const { user: currentUser, isFetched: sessionFetched } = useCurrentAppUserState();
  const [autoRouting, setAutoRouting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const base = `/${lng ?? "en"}`;
  // "Logged in" for navigation purposes means having an active profile.
  const goHome = () => navigate(profile ? base : `${base}/signin`);
  const handleLogout = () => {
    void supabase.auth.signOut();
    clearProfile();
    clearLocalUserId();
    navigate(`${base}/welcome`);
  };

  // One-time-per-load freshness check: App/'s "who's logged in" state is a
  // cached localUserId (src/lib/local-user.ts), resolved once at sign-in and
  // never otherwise re-checked against the Supabase session — unlike
  // ops-console, which re-validates getSession() on every load. If the
  // cached id has no matching live session any more (revoked/expired
  // elsewhere, or a stale id from a wiped browser profile), clear the cache
  // instead of leaving the app silently "logged in" on stale local state.
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const cachedUserId = getLocalUserId();
      if (!cachedUserId) return;
      const sessionUserId = data.session?.user?.id;
      if (!sessionUserId || (currentUser && currentUser.authUserId !== sessionUserId)) {
        clearProfile();
        clearLocalUserId();
        navigate(`${base}/welcome`, { replace: true });
      }
    });
    return () => { cancelled = true; };
    // Runs once per mount, matching this app's "resolve once" identity
    // model rather than continuously re-syncing to auth state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = profile?.type === "admin";

  // Feature visibility is DB-driven (public.profile_features, editable from
  // the admin panel's Roles & Access tab) rather than hardcoded — admin
  // always bypasses so a bad feature-table edit can't lock admins out of
  // their own tools. While loading, gated items stay hidden (fail-closed).
  // Called unconditionally (before the early-return guard below) per the
  // Rules of Hooks.
  const loadedFeatures = useProfileFeatures(profile?.type ?? undefined);
  const features = loadedFeatures ?? [];
  // Real staff roles (superadmin / admin / support_agent, from the database —
  // the same definitions the ops-console uses) also open the Administration page.
  const perms = useMyPermissions();
  const hasStaffAccess = !!perms && (perms.isSuperadmin || perms.users.read || perms.transactions.read);
  const orgMemberships = useMyOrgMemberships().data;
  const hasOrgAccess = !!perms?.isSuperadmin || (orgMemberships ?? []).some((m) => m.status === "active");
  // Sub-profile modules (migrations 0053/0054) are additive: a role with no
  // specialisation and none on offer sees exactly the previous menu.
  const modulesQ = useMyModules(currentUser?.id, profile?.type);
  const subProfileChoices = (useSubProfiles().data ?? []).filter((s) => s.parentRole === profile?.type && s.slug !== "individual");
  const joinedWorkspaces = (useWorkspaces(currentUser?.id).data ?? []).filter((w) => !w.isSelf).length > 0;
  const showModules = (modulesQ.data ?? []).length > 0 || subProfileChoices.length > 0 || joinedWorkspaces;
  const hasFeature = (key: string) => isAdmin || features.includes(key) || (key === "admin_panel" && hasStaffAccess);
  // The page behind a switched-off feature is blocked too, not just its menu entry. Fail closed while the list loads.
  const pageFeature = profile ? featureForPath(location.pathname) : undefined;
  const pageBlocked = !!pageFeature && !isAdmin && loadedFeatures !== undefined && !hasFeature(pageFeature);
  const pageLoading = !!pageFeature && !isAdmin && loadedFeatures === undefined;

  // Guard: send anonymous/no-profile visitors to the welcome screen first
  const publicPaths = ["/welcome", "/profile", "/fundraise", "/savings", "/wallet", "/payments"];
  const isPublicPath = publicPaths.some(p => location.pathname.endsWith(p));

  // A live session without a saved profile (first load on this browser, or the
  // profile was cleared) goes straight in: one role activates it and keeps the
  // requested page, several roles / none go to the role picker. Only a visitor
  // with no session is sent to the welcome screen.
  useEffect(() => {
    if (profile !== null || isPublicPath || !sessionFetched || !currentUser || autoRouting) return;
    setAutoRouting(true);
    void (async () => {
      try {
        const roles = await listUserRolesForUser(currentUser.id);
        if (roles.length === 1) {
          const p = getDefaultProfile(roles[0].role as ProfileType);
          p.name = roles[0].kind === "organisation" && roles[0].orgName ? roles[0].orgName : currentUser.name ?? p.name;
          setProfile(p);
        } else {
          routeAfterIdentity({ userId: currentUser.id, roles, navigate, base, setProfile, displayName: currentUser.name ?? undefined });
        }
      } catch {
        navigate(`${base}/welcome`, { replace: true });
      } finally {
        setAutoRouting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isPublicPath, sessionFetched, currentUser?.id]);

  if (profile === null && !isPublicPath) {
    if (!sessionFetched || currentUser) return null;
    return <Navigate to={`${base}/welcome`} replace />;
  }

  // Build navigation based on profile type
  const navItems = [
    // Common: always visible
    { to: base, icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: `${base}/payments`, icon: CreditCard, label: t("nav.pay") },
    { to: `${base}/wallet`, icon: CircleDollarSign, label: t("nav.wallet") },
    { to: `${base}/remittance`, icon: ArrowLeftRight, label: t("nav.transfer") },
    { to: `${base}/transactions`, icon: History, label: t("nav.history") },
    { to: `${base}/cards`, icon: Wallet, label: t("nav.cards") },
    { to: `${base}/scan`, icon: ScanLine, label: t("nav.scan") },
    { to: `${base}/bills`, icon: Receipt, label: t("nav.bills") },
    { to: `${base}/disputes`, icon: LifeBuoy, label: t("nav.disputes") },

    // Everything below is gated per-item off public.profile_features (see
    // hasFeature above) instead of the grouped isIndividual/isOrganisation/
    // isGovProfile/isFiProfile booleans this used to be — each item now
    // has its own admin-editable feature_key, matching the seed data
    // migration 0014 inserted to reproduce this exact set on day one.
    ...(hasFeature("savings") ? [{ to: `${base}/savings`, icon: PiggyBank, label: t("nav.savings") }] : []),
    ...(hasFeature("p2p") ? [{ to: `${base}/p2p`, icon: Send, label: t("nav.p2p") }] : []),
    ...(hasFeature("games") ? [{ to: `${base}/games`, icon: Gamepad2, label: t("nav.games") }] : []),
    ...(hasFeature("travel") ? [{ to: `${base}/travel`, icon: Plane, label: t("nav.travel") }] : []),
    ...(hasFeature("shop") ? [{ to: `${base}/shop`, icon: ShoppingBag, label: t("nav.shop") }] : []),
    ...(hasFeature("fundraise") ? [{ to: `${base}/fundraise`, icon: HandHeart, label: t("nav.fundraise") }] : []),
    ...(hasFeature("invest") ? [{ to: `${base}/invest`, icon: TrendingUp, label: t("nav.invest") }] : []),
    ...(hasFeature("groups") ? [{ to: `${base}/groups`, icon: Users, label: t("nav.groups") }] : []),
    ...(hasFeature("pos") ? [{ to: `${base}/pos`, icon: Store, label: t("nav.pos") }] : []),
    ...(hasFeature("payment_links") ? [{ to: `${base}/payment-links`, icon: Link2, label: t("nav.links") }] : []),
    ...(hasFeature("payouts") ? [{ to: `${base}/payouts`, icon: Banknote, label: t("nav.payouts") }] : []),
    ...(hasFeature("treasury_hub") ? [{ to: `${base}/treasury`, icon: BarChart3, label: t("nav.treasury") }] : []),
    ...(hasFeature("gov_hub") ? [{ to: `${base}/gov`, icon: Landmark, label: t("nav.govHub"), highlight: true as const }] : []),
    ...(hasFeature("api_hub") ? [{ to: `${base}/api-hub`, icon: PlugZap, label: t("nav.apiHub"), highlight: "fi" as const }] : []),

    // Agent-assisted manual registration — for customers with no
    // smartphone/data to self-register with. Admins already have this via
    // the admin panel's own "Add profile" form, but it's surfaced here too
    // for consistency/discoverability.
    ...(hasFeature("register_customer") ? [{ to: `${base}/register-customer`, icon: UserPlus, label: t("nav.registerCustomer") }] : []),

    // Gated — previously visible to every profile regardless of admin
    // status; now requires the admin_panel feature (admin-only by default,
    // seeded in 0014, adjustable from the Roles & Access tab).
    ...(showModules && hasFeature("modules") ? [{ to: `${base}/modules`, icon: BarChart3, label: t("nav.modules", "Business modules") }] : []),
    ...(!isAdmin && hasFeature("plans") ? [{ to: `${base}/plans`, icon: CircleDollarSign, label: t("nav.plans", "Plans & limits") }] : []),
    ...(hasOrgAccess && hasFeature("organisation") ? [{ to: `${base}/organisation`, icon: Landmark, label: t("nav.organisation", "Organisation") }] : []),
    ...(hasFeature("admin_panel") ? [{ to: `${base}/admin`, icon: ShieldCheck, label: t("nav.admin"), highlight: true as const }] : []),

  ];

  // Mobile bottom nav — context-aware based on profile. Kept as simple
  // hardcoded logic (unlike the desktop/full nav above) — only 4 always-safe
  // items, not part of the admin-editable feature set.
  const isIndividual = profile?.type === "personal" || profile?.type === "starter";
  const mobileNavItems = isIndividual ? [
    { to: base, icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: `${base}/payments`, icon: CreditCard, label: t("nav.pay") },
    { to: `${base}/p2p`, icon: Send, label: t("nav.p2p") },
    { to: `${base}/transactions`, icon: History, label: t("nav.history") },
  ] : [
    { to: base, icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: `${base}/payments`, icon: CreditCard, label: t("nav.pay") },
    { to: `${base}/remittance`, icon: ArrowLeftRight, label: t("nav.transfer") },
    { to: `${base}/transactions`, icon: History, label: t("nav.history") },
  ];

  const isActive = (to: string) =>
    to === base
      ? location.pathname === base || location.pathname === base + "/"
      : location.pathname.startsWith(to);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-[linear-gradient(180deg,#f7fafd_0%,#eef4f9_100%)] shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)] shrink-0">

        {/* Logo section */}
        <div className="px-4 py-4 border-b border-border bg-[radial-gradient(circle_at_top,_rgba(10,47,92,0.04),transparent_60%)]">
          <button
            onClick={goHome}
            className="flex items-center px-1 py-1 cursor-pointer hover:opacity-80 transition-opacity"
            aria-label={t("nav.dashboard")}
          >
            <PayRusLogo className="h-9 w-auto" />
          </button>

        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item, idx) => {
            const active = isActive(item.to);
            const isHighlight = "highlight" in item && item.highlight === true;
            const isFiHighlight = "highlight" in item && item.highlight === "fi";
            return (
              <div key={item.to}>
              <NavLink to={item.to} end={item.to === base}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-[linear-gradient(135deg,rgba(10,47,92,0.10),rgba(14,127,176,0.06))] text-primary shadow-[inset_0_0_0_1px_rgba(10,47,92,0.08)]"
                    : isHighlight
                    ? "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20"
                    : isFiHighlight
                    ? "text-primary hover:bg-primary/5 border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/80"
                )}>
                  <item.icon size={17} className={active ? "text-primary" : isHighlight ? "text-amber-600 dark:text-amber-400" : isFiHighlight ? "text-primary" : ""} />
                  {item.label}
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
              </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Bottom tools */}
        <div className="px-3 pb-3 space-y-1 border-t border-border pt-3 bg-[radial-gradient(circle_at_top,_rgba(14,127,176,0.03),transparent_55%)]">
          <button
            onClick={() => navigate(`${base}/notifications`)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
              location.pathname.startsWith(`${base}/notifications`) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}>
            <Bell size={17} />
            {t("nav.notifications")}
            <span className="ml-auto bg-destructive text-[10px] text-white font-bold rounded-full w-4 h-4 flex items-center justify-center">3</span>
          </button>
          <button
            onClick={() => navigate(`${base}/settings`)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
              location.pathname.startsWith(`${base}/settings`) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}>
            <Settings size={17} />
            {t("nav.settings")}
          </button>
          {/* Language switcher */}
          <div className="px-1 pt-1">
            <LocaleSwitcher />
          </div>
        </div>

        {/* Profile switcher + auth */}
        <div className="px-3 py-3 border-t border-border space-y-2">
          <ProfileSwitcher />
          {currentUser ? (
            <div className="flex items-center gap-2 px-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={12} className="text-primary" />
              </div>
              <span className="text-xs text-muted-foreground truncate flex-1">{currentUser.email ?? currentUser.name ?? ""}</span>
              <button
                onClick={handleLogout}
                aria-label={t("profile.logout")}
                className="h-7 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center cursor-pointer transition-colors"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate(`${base}/signin`)}
              className="w-full h-9 text-sm flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer hover:opacity-90 transition-opacity"
            >
              <LogIn size={15} />
              {t("signin.signIn")}
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <EnvBanner />
        {/* Mobile top bar */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0 safe-area-top">
          <button
            onClick={goHome}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            aria-label={t("nav.dashboard")}
          >
            <PayRusLogo className="h-6 w-auto" />
          </button>
          <div className="flex items-center gap-2">
            {currentUser && (
              <button
                onClick={() => navigate(`${base}/notifications`)}
                className="relative w-9 h-9 rounded-lg bg-secondary flex items-center justify-center cursor-pointer"
              >
                <Bell size={16} className="text-foreground" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full text-[9px] text-white font-bold flex items-center justify-center">3</span>
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center cursor-pointer"
            >
              <Menu size={18} className="text-foreground" />
            </button>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-2.5 border-b border-border bg-background/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString(lng ?? "en", { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FxRatePill />
            <SystemStatusPill />
          </div>
        </header>

        <LocationConsentBanner />

        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" as const }}
            className="h-full"
          >
            {pageBlocked ? (
              <div className="h-full flex items-center justify-center p-6" data-testid="feature-unavailable">
                <div className="max-w-sm text-center space-y-3">
                  <ShieldCheck size={28} className="mx-auto text-muted-foreground" />
                  <h1 className="text-base font-bold text-foreground">{t("feature.unavailable.title")}</h1>
                  <p className="text-sm text-muted-foreground">{t("feature.unavailable.body")}</p>
                  <button type="button" onClick={() => navigate(base)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer">{t("feature.unavailable.back")}</button>
                </div>
              </div>
            ) : pageLoading ? null : <Outlet />}
            <MfaStepUpHost />
          </motion.div>
        </main>

        {/* Mobile bottom nav — 5 items only */}
        <nav className="fixed bottom-0 left-0 right-0 flex justify-around items-center gap-2 border-t border-border/80 bg-white/90 backdrop-blur-xl px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden z-50 shadow-[0_-12px_30px_rgba(15,23,42,0.06)]">
          {mobileNavItems.map((item) => {
            const active = isActive(item.to);
            return (
              <NavLink key={item.to} to={item.to} end={item.to === base} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-medium transition-all duration-200",
                  active ? "bg-primary/8 text-primary shadow-[inset_0_0_0_1px_rgba(10,47,92,0.08)]" : "text-muted-foreground"
                )}>
                  <item.icon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
                  <span>{item.label}</span>
                </div>
              </NavLink>
            );
          })}
          {/* More button to open full menu */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-medium text-muted-foreground cursor-pointer transition-all duration-200 hover:bg-secondary"
          >
            <Menu size={18} />
            <span>{t("nav.more")}</span>
          </button>
        </nav>
      </div>

      {/* Mobile side sheet menu */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-[300px] p-0 flex flex-col">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2">
              <PayRusLogo className="h-7 w-auto" />
            </SheetTitle>
          </SheetHeader>

          {/* User/Auth section */}
          <div className="px-4 py-3 border-b border-border space-y-2">
            <ProfileSwitcher />
            {currentUser ? (
              <div className="flex items-center gap-2 px-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={12} className="text-primary" />
                </div>
                <span className="text-xs text-muted-foreground truncate flex-1">{currentUser.email ?? currentUser.name ?? ""}</span>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="h-7 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <LogOut size={14} />
                  {t("profile.logout")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { navigate(`${base}/signin`); setMobileMenuOpen(false); }}
                className="w-full h-10 text-sm flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer hover:opacity-90 transition-opacity"
              >
                <LogIn size={16} />
                {t("signin.signIn")}
              </button>
            )}
          </div>

          {/* Navigation list */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            {navItems.map((item, idx) => {
              const active = isActive(item.to);
              return (
                <div key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === base}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}>
                    <item.icon size={17} />
                    {item.label}
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                </NavLink>
                </div>
              );
            })}
          </nav>

          {/* Bottom actions */}
          <div className="border-t border-border px-3 py-3 space-y-1">
            <button
              onClick={() => { navigate(`${base}/notifications`); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary cursor-pointer"
            >
              <Bell size={17} />
              {t("nav.notifications")}
              <span className="ml-auto bg-destructive text-[10px] text-white font-bold rounded-full w-4 h-4 flex items-center justify-center">3</span>
            </button>
            <button
              onClick={() => { navigate(`${base}/settings`); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary cursor-pointer"
            >
              <Settings size={17} />
              {t("nav.settings")}
            </button>
            <div className="px-1 pt-1">
              <LocaleSwitcher />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
