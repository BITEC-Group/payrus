import { useState } from "react";
import SystemStatusPill from "@/components/ui/system-status-pill.tsx";
import { useTranslation } from "react-i18next";
import { useProfile } from "@/contexts/profile-context.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useApiKeysForUser, useCreateApiKeyMutation, useRevokeApiKeyMutation } from "@/hooks/use-backend.ts";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Network, Key, Webhook, Activity, Plus, Copy, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Zap, Globe, Lock,
  ChevronDown, ChevronUp, Eye, EyeOff, Trash2, Edit2,
  ArrowUpRight, ArrowDownRight, BarChart3, Shield, Code2,
  Server, Wifi, WifiOff, PlugZap, BookOpen, Download,
  GitBranch, Database, Terminal, ExternalLink
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

// ── Types ────────────────────────────────────────────────────────────────────

type NetworkStatus = "connected" | "pending" | "inactive" | "error";
type ApiKeyStatus = "active" | "expired" | "revoked";
type WebhookStatus = "active" | "failing" | "paused";

interface PaymentNetwork {
  id: string;
  name: string;
  description: string;
  type: string;
  status: NetworkStatus;
  latency: number;
  uptime: number;
  txToday: number;
  volumeUSD: number;
  icon: string;
}

interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  category: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  status: ApiKeyStatus;
  permissions: string[];
  created: string;
  lastUsed: string;
  requests: number;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: WebhookStatus;
  successRate: number;
  lastDelivery: string;
  deliveries: number;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const NETWORKS: PaymentNetwork[] = [
  { id: "swift", name: "SWIFT", description: "Society for Worldwide Interbank Financial Telecommunication", type: "Interbank", status: "connected", latency: 142, uptime: 99.98, txToday: 1847, volumeUSD: 42_500_000, icon: "🌐" },
  { id: "sepa", name: "SEPA", description: "Single Euro Payments Area — Instant Credit Transfer", type: "Regional", status: "connected", latency: 38, uptime: 99.99, txToday: 6230, volumeUSD: 18_900_000, icon: "🇪🇺" },
  { id: "papss", name: "PAPSS", description: "Pan-African Payment & Settlement System", type: "Continental", status: "connected", latency: 210, uptime: 99.7, txToday: 3412, volumeUSD: 8_150_000, icon: "🌍" },
  { id: "ach", name: "ACH", description: "Automated Clearing House — US Dollar settlement", type: "Clearing", status: "pending", latency: 0, uptime: 0, txToday: 0, volumeUSD: 0, icon: "🇺🇸" },
  { id: "rtgs", name: "RTGS/CEMAC", description: "Real-Time Gross Settlement — BEAC CEMAC zone", type: "RTGS", status: "connected", latency: 65, uptime: 99.95, txToday: 892, volumeUSD: 5_700_000, icon: "⚡" },
  { id: "cips", name: "CIPS", description: "Cross-border Interbank Payment System — CNY corridor", type: "Interbank", status: "inactive", latency: 0, uptime: 0, txToday: 0, volumeUSD: 0, icon: "🇨🇳" },
  { id: "upi", name: "UPI Bridge", description: "India-Africa UPI instant payment corridor", type: "Instant", status: "pending", latency: 0, uptime: 0, txToday: 0, volumeUSD: 0, icon: "🇮🇳" },
  { id: "mobile", name: "Mobile Money Hub", description: "M-PESA · Orange Money · MTN MoMo unified gateway", type: "Mobile", status: "connected", latency: 89, uptime: 99.85, txToday: 22_140, volumeUSD: 3_200_000, icon: "📱" },
];

const VOLUME_DATA = [
  { day: "Mon", swift: 38, sepa: 21, papss: 8, mobile: 4 },
  { day: "Tue", swift: 42, sepa: 17, papss: 11, mobile: 5 },
  { day: "Wed", swift: 35, sepa: 24, papss: 9, mobile: 6 },
  { day: "Thu", swift: 51, sepa: 19, papss: 13, mobile: 3 },
  { day: "Fri", swift: 47, sepa: 28, papss: 10, mobile: 7 },
  { day: "Sat", swift: 29, sepa: 12, papss: 7, mobile: 8 },
  { day: "Sun", swift: 33, sepa: 15, papss: 9, mobile: 9 },
];

const LATENCY_DATA = [
  { t: "00:00", swift: 155, sepa: 42, papss: 218 },
  { t: "04:00", swift: 138, sepa: 38, papss: 205 },
  { t: "08:00", swift: 162, sepa: 45, papss: 230 },
  { t: "12:00", swift: 148, sepa: 40, papss: 212 },
  { t: "16:00", swift: 142, sepa: 38, papss: 210 },
  { t: "20:00", swift: 150, sepa: 41, papss: 216 },
  { t: "Now", swift: 142, sepa: 38, papss: 210 },
];

const API_CATALOG: ApiEndpoint[] = [
  { method: "POST", path: "/v2/payments/initiate", description: "Initiate a multicurrency payment", category: "Payments" },
  { method: "GET", path: "/v2/payments/{id}/status", description: "Query payment status by ID", category: "Payments" },
  { method: "POST", path: "/v2/payments/bulk", description: "Submit bulk payment batch (up to 5000)", category: "Payments" },
  { method: "POST", path: "/v2/fx/quote", description: "Get real-time FX rate quote", category: "FX" },
  { method: "POST", path: "/v2/fx/convert", description: "Execute currency conversion", category: "FX" },
  { method: "GET", path: "/v2/fx/rates", description: "Live multicurrency rate table", category: "FX" },
  { method: "POST", path: "/v2/accounts/create", description: "Open a virtual sub-account", category: "Accounts" },
  { method: "GET", path: "/v2/accounts/{id}/balance", description: "Query account balance & currency", category: "Accounts" },
  { method: "GET", path: "/v2/accounts/{id}/statement", description: "Paginated transaction statement", category: "Accounts" },
  { method: "POST", path: "/v2/compliance/kyb", description: "Submit KYB verification for entity", category: "Compliance" },
  { method: "GET", path: "/v2/compliance/aml/check/{ref}", description: "AML screening result", category: "Compliance" },
  { method: "POST", path: "/v2/webhooks/register", description: "Register a webhook endpoint", category: "Webhooks" },
  { method: "DELETE", path: "/v2/webhooks/{id}", description: "Remove a webhook subscription", category: "Webhooks" },
  { method: "POST", path: "/v2/network/swift/transfer", description: "Initiate SWIFT MT103 transfer", category: "Networks" },
  { method: "POST", path: "/v2/network/sepa/instant", description: "SEPA Instant Credit Transfer (SCT Inst)", category: "Networks" },
  { method: "POST", path: "/v2/network/papss/remit", description: "Pan-African intra-continental transfer", category: "Networks" },
];

const API_KEYS: ApiKey[] = [
  { id: "k1", name: "Core Banking Production", prefix: "pyr_live_xK9m", status: "active", permissions: ["payments:write", "accounts:read", "fx:write", "webhooks:write"], created: "2024-11-12", lastUsed: "2 min ago", requests: 14_820 },
  { id: "k2", name: "Reporting Integration", prefix: "pyr_live_rA2b", status: "active", permissions: ["accounts:read", "statements:read", "compliance:read"], created: "2025-01-08", lastUsed: "15 min ago", requests: 3_410 },
  { id: "k3", name: "Staging Environment", prefix: "pyr_test_sT7c", status: "active", permissions: ["payments:write", "fx:write", "accounts:write"], created: "2025-03-22", lastUsed: "1 hr ago", requests: 89_204 },
  { id: "k4", name: "Legacy Bridge v1 (deprecated)", prefix: "pyr_live_lG4d", status: "revoked", permissions: ["payments:read"], created: "2023-06-01", lastUsed: "90 days ago", requests: 204 },
];

const WEBHOOKS: WebhookEndpoint[] = [
  { id: "w1", url: "https://api.yourbank.com/payrus/events", events: ["payment.completed", "payment.failed", "fx.rate.updated"], status: "active", successRate: 99.7, lastDelivery: "1 min ago", deliveries: 8_421 },
  { id: "w2", url: "https://core.yourbank.int/hooks/compliance", events: ["kyb.approved", "aml.flag", "account.frozen"], status: "active", successRate: 100, lastDelivery: "8 min ago", deliveries: 142 },
  { id: "w3", url: "https://legacy-erp.bank.local/notify", events: ["payment.completed"], status: "failing", successRate: 42.1, lastDelivery: "3 hr ago", deliveries: 1_892 },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NetworkStatus | ApiKeyStatus | WebhookStatus }) {
  const { t } = useTranslation("common");
  const map: Record<string, { label: string; className: string; dot: string }> = {
    connected: { label: "Connected", className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400 animate-pulse" },
    active:    { label: "Active",     className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400 animate-pulse" },
    pending:   { label: "Pending",    className: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400" },
    inactive:  { label: "Inactive",   className: "bg-zinc-50 text-zinc-700 border-zinc-200",          dot: "bg-zinc-500" },
    error:     { label: "Error",      className: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400 animate-pulse" },
    expired:   { label: "Expired",    className: "bg-zinc-50 text-zinc-700 border-zinc-200",          dot: "bg-zinc-500" },
    revoked:   { label: "Revoked",    className: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400" },
    failing:   { label: "Failing",    className: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400 animate-pulse" },
    paused:    { label: "Paused",     className: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400" },
  };
  const cfg = map[status] ?? map.inactive;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border", cfg.className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {t(cfg.label)}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const map: Record<string, string> = {
    GET: "bg-blue-50 text-blue-700",
    POST: "bg-emerald-50 text-emerald-700",
    PUT: "bg-amber-50 text-amber-700",
    DELETE: "bg-red-50 text-red-700",
    PATCH: "bg-violet-50 text-violet-700",
  };
  return (
    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded font-mono", map[method] ?? "bg-zinc-50 text-zinc-700")}>
      {method}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = "text-primary" }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-secondary/50 rounded-xl border border-border p-4">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", color === "text-primary" ? "bg-primary/10" : "bg-amber-50")}>
        <Icon size={16} className={color} />
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground/60 mt-1">{sub}</div>}
    </div>
  );
}

// ── Tab: Overview / Networks ───────────────────────────────────────────────────

function NetworksTab() {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState<string | null>(null);

  const connected = NETWORKS.filter(n => n.status === "connected");
  const totalVol = connected.reduce((s, n) => s + n.volumeUSD, 0);
  const totalTx = connected.reduce((s, n) => s + n.txToday, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Network} label={t("apihub.networksConnected")} value={`${connected.length} / ${NETWORKS.length}`} sub={t("apihub.pendingActivation", { n: 2 })} />
        <MetricCard icon={Zap} label={t("apihub.transactionsToday")} value={totalTx.toLocaleString()} sub={t("apihub.acrossAllNetworks")} />
        <MetricCard icon={BarChart3} label={t("apihub.volumeTodayUsd")} value={`$${(totalVol / 1_000_000).toFixed(1)}M`} sub={t("+12.4% vs yesterday")} color="text-amber-700" />
        <MetricCard icon={Activity} label={t("apihub.avgLatency")} value="89 ms" sub="P95: 210 ms" />
      </div>

      {/* Volume chart */}
      <div className="bg-secondary/50 rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("apihub.settlementVolumeByNetwork")}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={VOLUME_DATA} barCategoryGap="30%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="swift" name="SWIFT" fill="#4ade80" radius={[2, 2, 0, 0]} />
            <Bar dataKey="sepa" name="SEPA" fill="#60a5fa" radius={[2, 2, 0, 0]} />
            <Bar dataKey="papss" name="PAPSS" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            <Bar dataKey="mobile" name="Mobile" fill="#a78bfa" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Latency chart */}
      <div className="bg-secondary/50 rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("apihub.networkLatencyMsToday")}</h3>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={LATENCY_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="swift" name="SWIFT" stroke="#4ade80" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sepa" name="SEPA" stroke="#60a5fa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="papss" name="PAPSS" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Network list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">{t("apiHub.tab.networks")}</h3>
          <button
            onClick={() => toast.info(t("apihub.networkConnectionRequestsAre"))}
            className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer"
          >
            <Plus size={13} /> {t("apihub.requestNetworkAccess")}
          </button>
        </div>

        {NETWORKS.map(net => (
          <div key={net.id} className="bg-secondary/40 rounded-xl border border-border overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/60 transition-colors cursor-pointer"
              onClick={() => setExpanded(expanded === net.id ? null : net.id)}
            >
              <span className="text-xl w-8 text-center">{net.icon}</span>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{net.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 border border-border">{t(net.type)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{t(net.description)}</p>
              </div>
              <div className="hidden md:flex items-center gap-4 mr-3">
                {net.status === "connected" && (
                  <>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-foreground">{net.txToday.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">{t("apihub.txToday")}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-foreground">${(net.volumeUSD / 1_000_000).toFixed(1)}M</div>
                      <div className="text-[10px] text-muted-foreground">{t("apihub.volume")}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-emerald-700">{net.latency}{t("apihub.ms")}</div>
                      <div className="text-[10px] text-muted-foreground">{t("apihub.latency")}</div>
                    </div>
                  </>
                )}
              </div>
              <StatusBadge status={net.status} />
              {expanded === net.id ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
            </button>

            <AnimatePresence>
              {expanded === net.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" as const }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-1 border-t border-border bg-secondary/20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("apihub.uptime30d")}</div>
                        <div className="text-sm font-semibold text-foreground">{net.uptime > 0 ? `${net.uptime}%` : "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("apihub.avgLatency2")}</div>
                        <div className="text-sm font-semibold text-foreground">{net.latency > 0 ? `${net.latency} ms` : "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("apihub.todayVol")}</div>
                        <div className="text-sm font-semibold text-foreground">{net.volumeUSD > 0 ? `$${(net.volumeUSD/1_000_000).toFixed(2)}M` : "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("apihub.todayTx")}</div>
                        <div className="text-sm font-semibold text-foreground">{net.txToday > 0 ? net.txToday.toLocaleString() : "—"}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {net.status === "connected" && (
                        <>
                          <button onClick={() => toast.success(`${net.name} test ping successful — ${net.latency}ms`)} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 cursor-pointer flex items-center gap-1.5">
                            <Wifi size={12} /> {t("apihub.testConnection")}
                          </button>
                          <button onClick={() => toast.info(`${net.name} configuration details sent to your admin email.`)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-border cursor-pointer flex items-center gap-1.5">
                            <Edit2 size={12} /> {t("apihub.configure")}
                          </button>
                        </>
                      )}
                      {(net.status === "pending" || net.status === "inactive") && (
                        <button onClick={() => toast.info(`Activation request submitted for ${net.name}. The integration team will contact you within 48h.`)} className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200 cursor-pointer flex items-center gap-1.5">
                          <PlugZap size={12} /> {t("apihub.requestActivation")}
                        </button>
                      )}
                      <button onClick={() => toast.info(`Opening ${net.name} developer documentation…`)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-border cursor-pointer flex items-center gap-1.5">
                        <BookOpen size={12} /> {t("apihub.docs")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: API Catalog ───────────────────────────────────────────────────────────

function ApiCatalogTab() {
  const { t } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const categories = ["All", "Payments", "FX", "Accounts", "Compliance", "Webhooks", "Networks"];

  const filtered = API_CATALOG.filter(ep => {
    const matchCat = filter === "All" || ep.category === filter;
    const q = search.toLowerCase();
    return matchCat && (ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div className="bg-secondary/50 rounded-xl border border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Code2 size={16} className="text-primary" />
          <div>
            <div className="text-sm font-semibold text-foreground">{t("apihub.payrusDistributedApiV2")}</div>
            <div className="text-xs text-muted-foreground">{t("apihub.baseUrl")} <span className="font-mono text-primary">{t("apihub.httpsApiPayrusAfrica")}</span></div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 font-semibold">{t("apihub.restWebhooks")}</span>
            <button onClick={() => toast.info(t("apihub.openapiSpecDownloadWill"))} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer flex items-center gap-1.5">
              <Download size={12} /> {t("apihub.openapiSpec")}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          {[
            { label: "Authentication", value: "Bearer Token / HMAC" },
            { label: "Format", value: "JSON (UTF-8)" },
            { label: "Rate Limit", value: "1000 req/min" },
            { label: "SLA", value: "99.95% uptime" },
          ].map(i => (
            <div key={i.label} className="bg-secondary/80 rounded-lg px-3 py-2 border border-border">
              <div className="text-muted-foreground">{t(i.label)}</div>
              <div className="font-semibold text-foreground mt-0.5">{i.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Terminal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("apihub.searchEndpoints")}
            className="w-full pl-8 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn("text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer", filter === cat ? "bg-primary/15 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border hover:text-foreground")}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoint list */}
      <div className="space-y-1.5">
        {filtered.map((ep, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 bg-secondary/40 rounded-xl border border-border hover:border-primary/30 transition-colors group">
            <MethodBadge method={ep.method} />
            <code className="text-xs font-mono text-foreground flex-1 truncate">{ep.path}</code>
            <span className="hidden md:block text-xs text-muted-foreground truncate max-w-[280px]">{t(ep.description)}</span>
            <span className="text-[10px] text-muted-foreground bg-secondary border border-border rounded px-1.5 py-0.5">{ep.category}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(`https://api.payrus.africa${ep.path}`); toast.success(t("apihub.endpointUrlCopied")); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Copy size={13} className="text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">{t("apihub.noEndpointsMatchYour")}</div>
        )}
      </div>
    </div>
  );
}

// ── Tab: API Keys ──────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const { t } = useTranslation("common");
  const [showKey, setShowKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPerms, setNewKeyPerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [justCreatedPlaintext, setJustCreatedPlaintext] = useState<{ id: string; key: string } | null>(null);

  const currentUser = useCurrentAppUser();
  const realKeys = useApiKeysForUser(currentUser?.id);
  const createApiKey = useCreateApiKeyMutation();
  const revokeApiKey = useRevokeApiKeyMutation();

  const hasReal = !!currentUser && !!realKeys;
  const displayKeys = hasReal
    ? realKeys.map(k => ({ id: k.id, name: k.name, prefix: k.prefix, status: k.status, permissions: k.permissions, created: k.createdAt.slice(0, 10), lastUsed: k.lastUsedAt ?? "Never", requests: 0 }))
    : API_KEYS;

  async function handleCreate() {
    if (!newKeyName.trim()) { toast.error(t("apihub.pleaseEnterAKey")); return; }
    if (!currentUser) {
      toast.success(t("apihub.apiKeyCreatedCopy"));
      setShowCreate(false); setNewKeyName(""); setNewKeyPerms([]);
      return;
    }
    setCreating(true);
    try {
      const key = await createApiKey({ userId: currentUser.id, name: newKeyName.trim(), permissions: newKeyPerms });
      setJustCreatedPlaintext({ id: key.id, key: key.plaintextKey });
      toast.success(t("apihub.apiKeyCreatedCopy"));
      setShowCreate(false); setNewKeyName(""); setNewKeyPerms([]);
    } catch {
      toast.error(t("apihub.couldnTCreateThe"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string, name: string) {
    if (!currentUser) { toast.error(`Key "${name}" revoked. Systems using this key will be denied immediately.`); return; }
    try {
      await revokeApiKey({ keyId, userId: currentUser.id });
      toast.error(`Key "${name}" revoked. Systems using this key will be denied immediately.`);
    } catch {
      toast.error(t("apihub.couldnTRevokeThe"));
    }
  }

  const PERM_OPTIONS = ["payments:write", "payments:read", "fx:write", "fx:read", "accounts:write", "accounts:read", "compliance:read", "webhooks:write", "statements:read"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("apiHub.tab.keys")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("apihub.manageAccessCredentialsFor")}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer font-medium"
        >
          <Plus size={14} /> {t("apihub.createKey")}
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" as const }}
            className="overflow-hidden"
          >
            <div className="bg-secondary/60 rounded-xl border border-primary/20 p-5 space-y-4">
              <h4 className="text-sm font-semibold text-foreground">{t("apihub.newApiKey")}</h4>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("apihub.keyName")}</label>
                <input
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder={t("apihub.eGCoreBanking")}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">{t("apihub.permissions")}</label>
                <div className="flex flex-wrap gap-2">
                  {PERM_OPTIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => setNewKeyPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                      className={cn("text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors", newKeyPerms.includes(p) ? "bg-primary/15 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border hover:text-foreground")}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void handleCreate()}
                  disabled={creating}
                  className="text-sm px-4 py-2 rounded-xl bg-primary text-black font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {creating ? t("apihub.generating") : t("apihub.generateKey")}
                </button>
                <button onClick={() => setShowCreate(false)} className="text-sm px-4 py-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {t("disputes.cancel")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Just-created plaintext — shown once, matches real API-key UX */}
      {justCreatedPlaintext && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-emerald-700 mb-1">{t("apihub.copyThisKeyNow")}</div>
            <code className="text-xs font-mono text-foreground break-all">{justCreatedPlaintext.key}</code>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(justCreatedPlaintext.key); toast.success(t("apihub.keyCopied")); setJustCreatedPlaintext(null); }}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer transition-colors"
          >
            {t("apihub.copyDismiss")}
          </button>
        </div>
      )}

      {/* Keys list */}
      <div className="space-y-3">
        {displayKeys.map(key => (
          <div key={key.id} className={cn("bg-secondary/40 rounded-xl border p-4", key.status === "revoked" ? "border-border opacity-60" : "border-border hover:border-primary/20 transition-colors")}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Key size={13} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">{key.name}</span>
                  <StatusBadge status={key.status} />
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-muted-foreground">
                    {showKey === key.id ? `${key.prefix}••••••••••••••••` : `${key.prefix}${"•".repeat(16)}`}
                  </code>
                  <button onClick={() => setShowKey(showKey === key.id ? null : key.id)} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                    {showKey === key.id ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  {key.status !== "revoked" && (
                    <button onClick={() => { navigator.clipboard.writeText(key.prefix + "••••"); toast.success(t("apihub.keyPrefixCopied")); }} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                      <Copy size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {key.status === "active" && (
                  <button onClick={() => void handleRevoke(key.id, key.name)} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer transition-colors flex items-center gap-1">
                    <Trash2 size={11} /> {t("admin.staffpanel.revoke")}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {key.permissions.map(p => (
                <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary/80 rounded border border-primary/15">{p}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span>{t("remittance.state.quoted")} {key.created}</span>
              <span>{t("apihub.lastUsed")} {key.lastUsed}</span>
              <span>{key.requests.toLocaleString()} {t("apihub.requests")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Security notice */}
      <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Shield size={16} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300/80">
          <strong className="text-amber-700">{t("apihub.securityReminder")}</strong> {t("apihub.storeApiKeysIn")}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Webhooks ──────────────────────────────────────────────────────────────

function WebhooksTab() {
  const { t } = useTranslation("common");
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  const EVENT_TYPES = [
    "payment.completed", "payment.failed", "payment.pending",
    "fx.rate.updated", "fx.conversion.done",
    "account.created", "account.frozen", "account.balance.low",
    "kyb.approved", "kyb.rejected", "aml.flag",
    "network.down", "network.recovered",
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("apihub.webhookEndpoints")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("apihub.receiveRealTimeEvent")}</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer font-medium">
          <Plus size={14} /> {t("apihub.addEndpoint")}
        </button>
      </div>

      {/* Add endpoint form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" as const }} className="overflow-hidden">
            <div className="bg-secondary/60 rounded-xl border border-primary/20 p-5 space-y-4">
              <h4 className="text-sm font-semibold text-foreground">{t("apihub.registerWebhookEndpoint")}</h4>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("apihub.endpointUrlHttpsRequired")}</label>
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://api.yourbank.com/payrus/events" className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">{t("apihub.subscribeToEvents")}</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map(ev => (
                    <span key={ev} className="text-[10px] font-mono px-2 py-0.5 bg-secondary border border-border text-muted-foreground rounded hover:text-foreground hover:border-primary/30 transition-colors">
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { if (!newUrl.startsWith("https://")) { toast.error(t("apihub.urlMustStartWith")); return; } toast.success(t("apihub.webhookRegisteredATest")); setShowAdd(false); setNewUrl(""); }} className="text-sm px-4 py-2 rounded-xl bg-primary text-black font-semibold hover:bg-primary/90 transition-colors cursor-pointer">
                  {t("apihub.registerEndpoint")}
                </button>
                <button onClick={() => setShowAdd(false)} className="text-sm px-4 py-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("disputes.cancel")}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Webhook list */}
      <div className="space-y-3">
        {WEBHOOKS.map(wh => (
          <div key={wh.id} className="bg-secondary/40 rounded-xl border border-border p-4">
            <div className="flex items-start gap-3 justify-between flex-wrap">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Webhook size={14} className="text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono text-foreground truncate">{wh.url}</code>
                    <StatusBadge status={wh.status} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {wh.events.map(ev => (
                      <span key={ev} className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary/80 rounded border border-primary/15">{ev}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span>{t("apihub.successRate")} <strong className={wh.successRate > 95 ? "text-emerald-700" : "text-red-700"}>{wh.successRate}%</strong></span>
              <span>{wh.deliveries.toLocaleString()} {t("apihub.deliveries")}</span>
              <span>{t("apihub.lastDelivery")} {wh.lastDelivery}</span>
            </div>

            {wh.status === "failing" && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                <AlertCircle size={12} />
                {t("apihub.highFailureRateDetected")}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button onClick={() => toast.success(t("apihub.testEventDeliveredTo"))} className="text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer transition-colors flex items-center gap-1">
                <Zap size={11} /> {t("admin.userspanel.test")}
              </button>
              <button onClick={() => toast.info(t("apihub.deliveryLogsOpened"))} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground cursor-pointer transition-colors flex items-center gap-1">
                <Activity size={11} /> {t("apihub.logs")}
              </button>
              {wh.status === "failing" && (
                <button onClick={() => toast.info(t("apihub.reQueuingFailedDeliveries"))} className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer transition-colors flex items-center gap-1">
                  <RefreshCw size={11} /> {t("apihub.retryFailed")}
                </button>
              )}
              <button onClick={() => toast.error(t("apihub.webhookEndpointRemoved"))} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-red-700 cursor-pointer transition-colors ml-auto flex items-center gap-1">
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Architecture note */}
      <div className="bg-secondary/40 rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">{t("apihub.webhookArchitecture")}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {[
            { icon: Lock, title: "Signed Payloads", desc: "HMAC-SHA256 signature on every delivery. Verify with X-PayRus-Signature header." },
            { icon: RefreshCw, title: "Auto-Retry (72h)", desc: "Exponential backoff: 5s → 30s → 5m → 30m → 3h → 24h. Up to 6 attempts." },
            { icon: Database, title: "Event Store (30d)", desc: "All events persisted for 30 days. Re-deliver any event from the logs panel." },
          ].map(item => (
            <div key={item.title} className="flex gap-2">
              <item.icon size={13} className="text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-foreground mb-0.5">{t(item.title)}</div>
                <div className="text-muted-foreground">{t(item.desc)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

// Real ProfileType values for institutional accounts (src/contexts/profile-
// context.tsx) — the previous set ("merchant"/"agent"/"treasury") didn't
// match any real profile type, so this page was effectively admin-only by
// accident. Fixed as part of the same audit that migrated ApiKeysTab.
const FI_PROFILES = new Set([
  "business", "corporate", "development_bank", "investment_fund", "admin",
]);

export default function ApiHub() {
  const { t } = useTranslation("common");
  const { profile } = useProfile();
  const [tab, setTab] = useState<"networks" | "catalog" | "keys" | "webhooks">("networks");

  if (!profile || !FI_PROFILES.has(profile.type)) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <Server size={40} className="text-muted-foreground mx-auto mb-3" />
          <div className="text-base font-semibold text-foreground">{t("apiHub.restricted")}</div>
          <div className="text-sm text-muted-foreground mt-1">{t("apiHub.restrictedDesc")}</div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "networks" as const, label: t("apiHub.tab.networks"), icon: Network },
    { id: "catalog" as const, label: t("apiHub.tab.catalog"), icon: Code2 },
    { id: "keys" as const, label: t("apiHub.tab.keys"), icon: Key },
    { id: "webhooks" as const, label: t("apiHub.tab.webhooks"), icon: Webhook },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader title={t("apiHub.title", { defaultValue: "API Hub" })} className="mb-4 md:mb-6" />
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <PlugZap size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("apiHub.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("apiHub.subtitle")}</p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            <SystemStatusPill label="long" />
            <button onClick={() => toast.info(t("apihub.fullApiDocumentationOpened"))} className="text-xs px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1.5">
              <ExternalLink size={12} /> {t("apiHub.viewDocs")}
            </button>
          </div>
        </div>

        {/* Profile badge */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <Globe size={12} className="text-muted-foreground" />
          <span className="text-muted-foreground">{t("apiHub.connectedAs")}</span>
          <span className="font-semibold text-foreground">{profile.name}</span>
          <span className="bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-medium">{t(`profile.badge.${profile.type}`)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/60 rounded-xl border border-border mb-6 overflow-x-auto">
        {TABS.map(t2 => (
          <button
            key={t2.id}
            onClick={() => setTab(t2.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer flex-1 justify-center",
              tab === t2.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t2.icon size={14} />
            {t(t2.label)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: "easeOut" as const }}
        >
          {tab === "networks" && <NetworksTab />}
          {tab === "catalog" && <ApiCatalogTab />}
          {tab === "keys" && <ApiKeysTab />}
          {tab === "webhooks" && <WebhooksTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
