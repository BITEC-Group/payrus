import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  User, Shield, Bell, Globe, CreditCard, Smartphone, Key,
  ChevronRight, Check, LogOut, Moon, Volume2, Eye,
  Mail, Phone, Building2, Camera, Edit2, Save, X,
  Fingerprint, AlertTriangle, Download, Trash2, ExternalLink,
  Languages, Palette, Lock, RefreshCw, QrCode, Copy
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { PayRusLogo } from "@/pages/layout/AppLayout.tsx";
import { useProfile } from "@/contexts/profile-context.tsx";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { changeLocale, setLocaleInPath, SUPPORTED_LOCALES, SUPPORTED_LOCALES_ARRAY, type SupportedLocale } from "@/i18n.ts";
import { getAnonId } from "@/lib/anon-id.ts";
import { useAddLinkedPaymentMethodMutation, useLinkedPaymentMethods, useSeedDefaultLinkedPaymentMethodsMutation, useCurrenciesByCode } from "@/hooks/use-backend.ts";
import { getPreferredFxCurrency, setPreferredFxCurrency } from "@/hooks/use-fx-pill.ts";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useLocationCurrency } from "@/hooks/use-location-currency.ts";
import { getLocationFollow, setLocationFollow } from "@/lib/location.ts";
import { clearMyLocation } from "@/lib/backend.ts";
import { useQueryClient } from "@tanstack/react-query";
import { getLastFxRateUpdate, type FxRateUpdate } from "@/lib/backend.ts";
import { useQuery as useReactQuery } from "@tanstack/react-query";
import { MfaSettingsCard } from "@/components/mfa/mfa-ui.tsx";
import AddPaymentMethodSheet, { PAYMENT_PROVIDERS, type LinkedMethodProvider } from "@/components/ui/add-payment-method-sheet.tsx";

// ── Types ─────────────────────────────────────────────────────────────────────
type SettingsSection = "profile" | "security" | "notifications" | "appearance" | "payments" | "privacy" | "about";

interface Toggle {
  id: string;
  label: string;
  description: string;
  value: boolean;
}

// ── Toggle Component ──────────────────────────────────────────────────────────
function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "w-10 h-5.5 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer",
        value ? "bg-primary" : "bg-secondary border border-border"
      )}
      style={{ height: "22px" }}
    >
      <div className={cn(
        "w-4 h-4 rounded-full bg-white shadow absolute transition-transform",
        value ? "translate-x-5" : "translate-x-0.5"
      )} />
    </button>
  );
}

// ── Section Row ───────────────────────────────────────────────────────────────
function SettingRow({
  icon: Icon, label, description, right, onClick, danger = false
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/60 transition-colors text-left cursor-pointer group",
        !onClick && "cursor-default"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
        danger ? "bg-destructive/10" : "bg-secondary"
      )}>
        <Icon size={15} className={danger ? "text-destructive" : "text-muted-foreground group-hover:text-foreground transition-colors"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium", danger ? "text-destructive" : "text-foreground")}>{label}</div>
        {description && <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>}
      </div>
      {right ?? (onClick && <ChevronRight size={14} className="text-muted-foreground shrink-0" />)}
    </div>
  );
}

// ── Profile Edit Form ─────────────────────────────────────────────────────────
function ProfileSection() {
  const { t } = useTranslation("common");
  const { profile, setProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [email] = useState("contact@payrus.app");
  const [phone] = useState("+243 81 234 5678");

  const save = () => {
    if (profile) {
      setProfile({ ...profile, name });
      toast.success(t("settings.profile.updated"));
      setEditing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Avatar + name */}
      <div className="flex items-center gap-4 px-4 py-4 bg-card border border-border rounded-2xl">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border-2 border-primary/25 flex items-center justify-center text-xl font-black text-primary">
            {(profile?.name ?? "U").slice(0, 1)}
          </div>
          <button
            onClick={() => toast.success(t("settings.profile.uploadPhoto"))}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow">
            <Camera size={11} className="text-primary-foreground" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm font-bold bg-secondary border border-primary/40 rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:border-primary" />
          ) : (
            <div className="text-sm font-bold text-foreground">{profile?.name}</div>
          )}
          <div className="text-[11px] text-muted-foreground mt-0.5">{profile?.tier} · •••• {profile?.accountNumber}</div>
          <div className="flex items-center gap-1 mt-1">
            <Shield size={10} className="text-primary" />
            <span className="text-[10px] text-primary font-medium">{t("settings.profile.verifiedAccount")}</span>
          </div>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={save} className="p-2 rounded-lg bg-primary/15 text-primary cursor-pointer hover:bg-primary/25 transition-colors"><Save size={14} /></button>
            <button onClick={() => setEditing(false)} className="p-2 rounded-lg bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors"><X size={14} className="text-muted-foreground" /></button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="p-2 rounded-lg bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors">
            <Edit2 size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* PayRus QR Code */}
      <div className="px-4 py-4 bg-card border border-border rounded-2xl flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shrink-0 shadow">
          <QrCode size={28} className="text-black" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground">{t("settings.profile.qrTitle")}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{t("settings.profile.qrDesc")}</div>
        </div>
        <button onClick={() => toast.success(t("settings.profile.qrCopied"))} className="p-2 rounded-lg bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors">
          <Copy size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Contact info */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={Mail} label={t("settings.profile.email")} description={email}
          right={<span className="text-[11px] text-muted-foreground">{email}</span>}
          onClick={() => toast.success(t("settings.profile.editEmail"))} />
        <SettingRow icon={Phone} label={t("settings.profile.phone")} description={phone}
          right={<span className="text-[11px] text-muted-foreground">{phone}</span>}
          onClick={() => toast.success(t("settings.profile.editPhone"))} />
        <SettingRow icon={Building2} label={t("settings.profile.accountType")}
          description={profile?.type?.replace(/_/g, " ")}
          onClick={() => toast.info(t("settings.profile.switchProfileHint"))} />
      </div>

      {/* KYC & documents */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={Shield} label={t("settings.profile.kyc")}
          description={t("settings.profile.kycStatus")}
          right={<span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{t("settings.status.verified")}</span>} />
        <SettingRow icon={Download} label={t("settings.profile.downloadStatement")}
          description={t("settings.profile.downloadStatementDesc")}
          onClick={() => toast.success(t("settings.profile.generatingStatement"))} />
      </div>
    </div>
  );
}

// ── Security Section ──────────────────────────────────────────────────────────
function SecuritySection() {
  const { t } = useTranslation("common");
  const { profile } = useProfile();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  return (
    <div className="space-y-4">
      <MfaSettingsCard recommend={profile?.type === "admin"} />
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={Key} label={t("settings.security.changePin")}
          description={t("settings.security.changePinDesc")}
          onClick={() => toast.success(t("settings.security.pinChanged"))} />
        <SettingRow icon={Key} label={t("settings.security.changePassword")}
          description={t("settings.security.changePasswordDesc")}
          onClick={() => toast.success(t("settings.security.passwordChanged"))} />
        <SettingRow icon={Fingerprint} label={t("settings.security.biometric")}
          description={t("settings.security.biometricDesc")}
          right={<ToggleSwitch value={biometricEnabled} onChange={v => { setBiometricEnabled(v); toast.success(v ? t("settings.security.biometricOn") : t("settings.security.biometricOff")); }} />} />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={Bell} label={t("settings.security.loginAlerts")}
          description={t("settings.security.loginAlertsDesc")}
          right={<ToggleSwitch value={loginAlerts} onChange={v => { setLoginAlerts(v); }} />} />
        <SettingRow icon={ExternalLink} label={t("settings.security.activeSessions")}
          description={t("settings.security.activeSessionsDesc")}
          onClick={() => toast.success(t("settings.security.viewSessions"))} />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={AlertTriangle} label={t("settings.security.reportSuspicious")}
          description={t("settings.security.reportSuspiciousDesc")}
          onClick={() => toast.success(t("settings.security.reportSent"))}
          danger />
        <SettingRow icon={Trash2} label={t("settings.security.deleteAccount")}
          description={t("settings.security.deleteAccountDesc")}
          onClick={() => toast.error(t("settings.security.deleteAccountToast"))}
          danger />
      </div>
    </div>
  );
}

// ── Notification Settings Section ─────────────────────────────────────────────
function NotifSettingsSection() {
  const { t } = useTranslation("common");
  const [toggles, setToggles] = useState<Toggle[]>([
    { id: "tx", label: t("settings.notif.tx"), description: t("settings.notif.txDesc"), value: true },
    { id: "transfers", label: t("settings.notif.transfers"), description: t("settings.notif.transfersDesc"), value: true },
    { id: "promo", label: t("settings.notif.promo"), description: t("settings.notif.promoDesc"), value: false },
    { id: "security", label: t("settings.notif.security"), description: t("settings.notif.securityDesc"), value: true },
    { id: "news", label: t("settings.notif.news"), description: t("settings.notif.newsDesc"), value: false },
    { id: "fund", label: t("settings.notif.fund"), description: t("settings.notif.fundDesc"), value: true },
    { id: "travel", label: t("settings.notif.travel"), description: t("settings.notif.travelDesc"), value: false },
    { id: "rates", label: t("settings.notif.rates"), description: t("settings.notif.ratesDesc"), value: true },
  ]);

  const toggle = (id: string) => {
    setToggles(prev => prev.map(item => item.id === id ? { ...item, value: !item.value } : item));
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {toggles.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{item.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>
            </div>
            <ToggleSwitch value={item.value} onChange={() => toggle(item.id)} />
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={Volume2} label={t("settings.notif.sounds")}
          description={t("settings.notif.soundsDesc")}
          right={<ToggleSwitch value={true} onChange={() => toast.success(t("settings.notif.soundsChanged"))} />} />
        <SettingRow icon={Smartphone} label={t("settings.notif.push")}
          description={t("settings.notif.pushDesc")}
          right={<span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{t("settings.status.active")}</span>} />
      </div>
    </div>
  );
}

// ── Appearance Section ────────────────────────────────────────────────────────
function AppearanceSection() {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  // Persisted choice drives the live FX pill in the header (use-fx-pill.ts).
  const [currency, setCurrency] = useState<string | null>(getPreferredFxCurrency());
  const user = useCurrentAppUser();
  const effectiveCurrency = currency ?? user?.transactionCurrency ?? null;
  const queryClient = useQueryClient();
  const { refresh: refreshLocation } = useLocationCurrency();
  const [followLocation, setFollowLocation] = useState(getLocationFollow() === "on");

  const handleFollowLocation = async (on: boolean) => {
    setFollowLocation(on);
    setLocationFollow(on ? "on" : "off");
    if (on) {
      await refreshLocation(true);
    } else {
      try {
        await clearMyLocation();
        await queryClient.invalidateQueries({ queryKey: ["sessionAppUser"] });
      } catch {
        /* signed out: nothing stored to clear */
      }
    }
  };

  const currencies = ["XAF", "AOA", "CDF", "EUR", "USD", "AED", "CNY", "GBP", "NGN", "KES", "ZAR"];

  const handleChangeLocale = (newLng: SupportedLocale) => {
    const meta = SUPPORTED_LOCALES[newLng];
    // Bind the toast's translator to the target language explicitly — i18n.language
    // (and this component's `t`) hasn't switched yet at this point in the tick, so a
    // plain t() here would render the confirmation in the language being left, not entered.
    const tNext = i18n.getFixedT(newLng);
    void changeLocale(newLng);
    const newPath = setLocaleInPath(newLng, location.pathname, location.search, location.hash);
    navigate(newPath);
    toast.success(tNext("settings.appearance.languageChanged", { language: meta.nativeName }));
  };

  return (
    <div className="space-y-4">
      {/* Language */}
      <div>
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">{t("settings.appearance.languageLabel")}</div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {SUPPORTED_LOCALES_ARRAY.map(lng => {
            const meta = SUPPORTED_LOCALES[lng];
            return (
              <button key={lng} onClick={() => handleChangeLocale(lng)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/60 transition-colors cursor-pointer text-left">
                <span className="text-lg">{meta.emoji}</span>
                <span className="flex-1 text-sm text-foreground font-medium">{meta.nativeName}</span>
                {i18n.language === lng && <Check size={15} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live location → transaction currency */}
      {user && (
        <div>
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">{t("location.settingTitle")}</div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            <SettingRow
              icon={Globe}
              label={t("location.settingTitle")}
              description={`${t("location.settingDesc")}${user.locationCountry ? " " + t("location.settingCountry", { country: user.locationCountry }) : ""}`}
              right={<ToggleSwitch value={followLocation} onChange={(v) => void handleFollowLocation(v)} />}
            />
          </div>
        </div>
      )}

      {/* Currency display */}
      <div>
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">{t("settings.appearance.currencyLabel")}</div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            {currencies.map(c => (
              <button key={c} onClick={() => { setCurrency(c); setPreferredFxCurrency(c); toast.success(t("settings.appearance.currencyChanged", { currency: c })); }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all",
                  effectiveCurrency === c ? "bg-primary/15 text-primary border-primary/35" : "bg-secondary text-muted-foreground border-border hover:border-primary/25"
                )}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Theme */}
      <div>
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">{t("settings.appearance.themeLabel")}</div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <SettingRow icon={Moon} label={t("settings.appearance.darkMode")}
            description={t("settings.appearance.darkModeDesc")}
            right={<span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">{t("settings.status.active")}</span>} />
          <SettingRow icon={Palette} label={t("settings.appearance.accentColor")}
            description={t("settings.appearance.accentColorDesc")}
            right={<div className="w-5 h-5 rounded-full bg-primary border-2 border-primary/40 shrink-0" />} />
        </div>
      </div>
    </div>
  );
}

// ── Payments Section ──────────────────────────────────────────────────────────
function PaymentsSection() {
  const { t } = useTranslation("common");
  const [autoConvert, setAutoConvert] = useState(true);
  const [saveCards, setSaveCards] = useState(true);
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const ownerKey = useState(getAnonId)[0];
  const linkedMethods = useLinkedPaymentMethods(ownerKey);
  const addLinkedMethodMutation = useAddLinkedPaymentMethodMutation();
  const seedDefaults = useSeedDefaultLinkedPaymentMethodsMutation();

  useEffect(() => {
    if (linkedMethods?.length === 0) void seedDefaults(ownerKey);
  }, [linkedMethods, ownerKey, seedDefaults]);

  const addLinkedMethod = (provider: LinkedMethodProvider) => {
    const providerMeta = PAYMENT_PROVIDERS.find(p => p.id === provider)!;
    const label = t(providerMeta.labelKey);
    void addLinkedMethodMutation({ ownerKey, provider, label });
    toast.success(t("settings.payments.methodLinkedToast", { name: label }));
  };

  return (
    <div className="space-y-4">
      {/* Linked accounts */}
      <div>
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">{t("settings.payments.linkedMethods")}</div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {linkedMethods === undefined ? (
            <div className="py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</div>
          ) : (
            linkedMethods.map(acc => {
              const Icon = PAYMENT_PROVIDERS.find(p => p.id === acc.provider)?.icon ?? CreditCard;
              return (
                <div key={acc.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{acc.label}</div>
                  </div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    acc.status === "primary" ? "text-primary bg-primary/10 border-primary/25" : "text-emerald-700 bg-emerald-50 border-emerald-200")}>
                    {acc.status === "primary" ? t("settings.status.primary") : t("settings.status.active")}
                  </span>
                </div>
              );
            })
          )}
          <SettingRow icon={CreditCard} label={t("settings.payments.addMethod")}
            onClick={() => setAddMethodOpen(true)} />
        </div>
      </div>

      <AddPaymentMethodSheet open={addMethodOpen} onOpenChange={setAddMethodOpen} onAdd={addLinkedMethod} />

      {/* Prefs */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={Globe} label={t("settings.payments.autoConvert")}
          description={t("settings.payments.autoConvertDesc")}
          right={<ToggleSwitch value={autoConvert} onChange={v => { setAutoConvert(v); toast.success(v ? t("settings.payments.autoConvertOn") : t("settings.payments.autoConvertOff")); }} />} />
        <SettingRow icon={Lock} label={t("settings.payments.saveCards")}
          description={t("settings.payments.saveCardsDesc")}
          right={<ToggleSwitch value={saveCards} onChange={setSaveCards} />} />
        <SettingRow icon={RefreshCw} label={t("settings.payments.txLimits")}
          description={t("settings.payments.txLimitsDesc")}
          onClick={() => toast.success(t("settings.payments.limitsReviewToast"))} />
      </div>
    </div>
  );
}

// ── Privacy Section ───────────────────────────────────────────────────────────
function PrivacySection() {
  const { t } = useTranslation("common");
  const [analytics, setAnalytics] = useState(true);
  const [profileVisible, setProfileVisible] = useState(true);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={Eye} label={t("settings.privacy.profileVisible")}
          description={t("settings.privacy.profileVisibleDesc")}
          right={<ToggleSwitch value={profileVisible} onChange={setProfileVisible} />} />
        <SettingRow icon={Eye} label={t("settings.privacy.analytics")}
          description={t("settings.privacy.analyticsDesc")}
          right={<ToggleSwitch value={analytics} onChange={setAnalytics} />} />
        <SettingRow icon={Download} label={t("settings.privacy.exportData")}
          description={t("settings.privacy.exportDataDesc")}
          onClick={() => toast.success(t("settings.privacy.exportToast"))} />
        <SettingRow icon={ExternalLink} label={t("settings.privacy.privacyPolicy")}
          onClick={() => toast.info("payrus.app/privacy")} />
        <SettingRow icon={ExternalLink} label={t("settings.privacy.terms")}
          onClick={() => toast.info("payrus.app/terms")} />
      </div>
    </div>
  );
}

// ── About Section ─────────────────────────────────────────────────────────────
// FX pairs shown in the live-rate ticker below — a fixed spread of majors
// plus the CEMAC/African currencies this app's own domain centers on.
const FX_TICKER_CODES = ["USD", "EUR", "GBP", "XAF", "NGN", "ZAR"];

function LiveFxTicker() {
  const { t } = useTranslation("common");
  const currencies = useCurrenciesByCode(FX_TICKER_CODES);
  const { data: lastUpdate } = useReactQuery<FxRateUpdate | null>({
    queryKey: ["lastFxRateUpdate"],
    queryFn: getLastFxRateUpdate,
  });
  const usd = currencies?.find((c) => c.code === "USD");

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-foreground">{t("settings.about.fxTickerTitle")}</span>
        {lastUpdate && (
          <span className="text-[10px] text-muted-foreground">
            {t("settings.about.fxTickerUpdated", { time: new Date(lastUpdate.fetchedAt).toLocaleString() })}
          </span>
        )}
      </div>
      {!currencies && <div className="text-xs text-muted-foreground py-2">{t("settings.about.fxTickerLoading")}</div>}
      {currencies && usd?.ratePerUsd && (
        <div className="grid grid-cols-3 gap-2">
          {currencies.filter((c) => c.code !== "USD" && c.ratePerUsd != null).map((c) => (
            <div key={c.code} className="rounded-xl bg-secondary/40 px-2.5 py-2">
              <div className="text-[10px] text-muted-foreground">{t("settings.usd")}{c.code}</div>
              <div className="text-xs font-mono font-bold text-foreground">{c.ratePerUsd!.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-[9px] text-muted-foreground mt-3">{t("settings.about.fxTickerAttribution")}</div>
    </div>
  );
}

function AboutSection() {
  const { t } = useTranslation("common");

  const infoRows = [
    { label: t("settings.about.appVersion"), value: "2.1.4 (build 241101)" },
    { label: t("settings.about.environment"), value: "Production · PayRus Cloud" },
    { label: t("settings.about.compliance"), value: "BCC · BEAC · BCEAO · ISO 27001" },
    { label: t("settings.about.encryption"), value: "TLS 1.3 · AES-256" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-6 gap-3">
        <PayRusLogo className="h-12 w-auto" />
        <div className="text-center">
          <div className="text-base font-black text-foreground">{t("landing.Masthead.payrus")}</div>
          <div className="text-xs text-muted-foreground">{t("settings.about.tagline")}</div>
        </div>
      </div>

      <LiveFxTicker />

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {infoRows.map(item => (
          <div key={item.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="text-[11px] font-medium text-foreground font-mono">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <SettingRow icon={ExternalLink} label={t("settings.about.support")}
          description={t("settings.about.supportDesc")}
          onClick={() => toast.success(t("settings.about.supportToast"))} />
        <SettingRow icon={ExternalLink} label={t("settings.about.reportBug")}
          onClick={() => toast.success(t("settings.about.reportBugToast"))} />
        <SettingRow icon={RefreshCw} label={t("settings.about.checkUpdates")}
          onClick={() => toast.success(t("settings.about.upToDate"))} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useTranslation("common");
  const location = useLocation();
  const initialSection = (location.state as { section?: SettingsSection } | null)?.section;
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection ?? "profile");
  const { clearProfile } = useProfile();
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const base = `/${lng ?? "en"}`;

  const SECTIONS: { id: SettingsSection; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; description: string }[] = [
    { id: "profile", label: t("settings.section.profile.label"), icon: User, description: t("settings.section.profile.desc") },
    { id: "security", label: t("settings.section.security.label"), icon: Shield, description: t("settings.section.security.desc") },
    { id: "notifications", label: t("settings.section.notifications.label"), icon: Bell, description: t("settings.section.notifications.desc") },
    { id: "appearance", label: t("settings.section.appearance.label"), icon: Palette, description: t("settings.section.appearance.desc") },
    { id: "payments", label: t("settings.section.payments.label"), icon: CreditCard, description: t("settings.section.payments.desc") },
    { id: "privacy", label: t("settings.section.privacy.label"), icon: Eye, description: t("settings.section.privacy.desc") },
    { id: "about", label: t("settings.section.about.label"), icon: Languages, description: t("settings.section.about.desc") },
  ];

  const handleLogout = () => {
    clearProfile();
    navigate(`${base}/profile`);
    toast.success(t("settings.loggedOut"));
  };

  const activeConfig = SECTIONS.find(s => s.id === activeSection)!;

  return (
    <div className="flex flex-col h-full">
      {/* Back navigation */}
      <div className="px-4 pt-4 pb-0 shrink-0 md:px-6 md:pt-6">
        <PageHeader title={t("nav.settings", { defaultValue: "Settings" })} className="mb-4 md:mb-6" />
      </div>
      <div className="flex flex-1 min-h-0">
      {/* Sidebar nav */}
      <div className="hidden md:flex flex-col w-56 border-r border-border shrink-0 pt-4 pb-3 gap-0.5 px-2 overflow-y-auto bg-sidebar/30">
        <div className="px-2 pb-3">
          <h1 className="text-base font-black text-foreground">{t("settings.heading")}</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("settings.subheading")}</p>
        </div>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left w-full",
              activeSection === s.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}>
            <s.icon size={16} className={activeSection === s.id ? "text-primary" : ""} />
            {s.label}
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-border">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all cursor-pointer w-full">
            <LogOut size={16} />
            {t("settings.logout")}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Mobile section picker */}
        <div className="md:hidden flex items-center gap-2 overflow-x-auto px-4 pt-4 pb-3 border-b border-border">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shrink-0 cursor-pointer transition-all whitespace-nowrap",
                activeSection === s.id ? "bg-primary/15 text-primary border-primary/30" : "bg-card text-muted-foreground border-border"
              )}>
              <s.icon size={11} />
              {s.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6 max-w-2xl">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <activeConfig.icon size={17} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">{activeConfig.label}</h2>
              <p className="text-[11px] text-muted-foreground">{activeConfig.description}</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              {activeSection === "profile"       && <ProfileSection />}
              {activeSection === "security"      && <SecuritySection />}
              {activeSection === "notifications" && <NotifSettingsSection />}
              {activeSection === "appearance"    && <AppearanceSection />}
              {activeSection === "payments"      && <PaymentsSection />}
              {activeSection === "privacy"       && <PrivacySection />}
              {activeSection === "about"         && <AboutSection />}
            </motion.div>
          </AnimatePresence>

          {/* Logout mobile */}
          <div className="md:hidden mt-6">
            <button onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-destructive/30 text-destructive text-sm font-semibold cursor-pointer hover:bg-destructive/10 transition-colors">
              <LogOut size={15} /> {t("settings.logout")}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
