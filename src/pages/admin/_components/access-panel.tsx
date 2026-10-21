import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Repeat, Trash2, Save, ShieldCheck } from "lucide-react";
import {
  useAdminListUsers, useAdminReassignUserRoleMutation, useAdminRemoveUserRoleMutation,
  useProfileFeatures, useAdminSetProfileFeaturesMutation, useAdminSetConsoleRoleTabsMutation,
} from "@/hooks/use-backend.ts";
import { supabase } from "@/lib/supabase-client.ts";
import { useRoleDefinitions } from "@/hooks/use-backend.ts";

// Role list comes from public.role_definitions — the same table the ops-console
// reads — so both apps always offer the same roles (incl. superadmin).
function useRoleSlugs(): string[] {
  const defs = useRoleDefinitions();
  return (defs ?? []).map((d) => d.slug);
}

// The 16 admin-editable nav-item keys AppLayout.tsx now reads from
// public.profile_features (supabase/migrations/0014) instead of its old
// hardcoded isIndividual/isOrganisation/... booleans.
const APP_FEATURES: { key: string; label: string }[] = [
  { key: "savings", label: "Savings" },
  { key: "p2p", label: "P2P" },
  { key: "games", label: "Games" },
  { key: "travel", label: "Travel" },
  { key: "shop", label: "Shop" },
  { key: "fundraise", label: "Fundraise" },
  { key: "invest", label: "Invest" },
  { key: "groups", label: "Groups" },
  { key: "pos", label: "POS" },
  { key: "payment_links", label: "Payment links" },
  { key: "payouts", label: "Payouts" },
  { key: "treasury_hub", label: "Treasury" },
  { key: "gov_hub", label: "Gov Hub" },
  { key: "api_hub", label: "API Hub" },
  { key: "register_customer", label: "Register customer" },
  { key: "admin_panel", label: "Admin panel" },
  { key: "modules", label: "Business modules" },
  { key: "plans", label: "Plans & limits" },
  { key: "organisation", label: "Organisation" },
];

// ops-console's own Role vocabulary (its console_roles/console_role_tabs
// tables use these capitalized values directly, not App/'s lowercase
// user_roles.role slugs — see ops-console/src/lib/roleMapping.ts).
const CONSOLE_ROLES = ["Personal", "Merchant", "Agent", "Treasury", "Institution", "NGO", "Group", "Other"] as const;
const CONSOLE_TABS = ["overview", "transactions", "payouts", "merchants", "agents", "mandates", "grants", "members"];

function ReassignRemoveSection() {
  const { t } = useTranslation("common");
  const rows = useAdminListUsers();
  const roleSlugs = useRoleSlugs();
  const reassignRole = useAdminReassignUserRoleMutation();
  const removeRole = useAdminRemoveUserRoleMutation();
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("personal");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReassign = async (roleId: string) => {
    if (!password) return;
    setSaving(true);
    try {
      await reassignRole({ roleId, newRole, password });
      toast.success(`Role reassigned to ${newRole}`);
      setExpandedRoleId(null);
      setPassword("");
    } catch {
      toast.error(t("admin.accesspanel.couldnTReassignCheck"));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (roleId: string) => {
    if (!password) return;
    setSaving(true);
    try {
      await removeRole({ roleId, password });
      toast.success(t("admin.accesspanel.roleRemoved"));
      setExpandedRoleId(null);
      setPassword("");
    } catch {
      toast.error(t("admin.accesspanel.couldnTRemoveCheck"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="text-sm font-bold text-foreground mb-1">{t("admin.accesspanel.reassignOrRemoveA")}</div>
      <div className="text-xs text-muted-foreground mb-4">
        {t("admin.accesspanel.changeWhichRoleAn")}
      </div>
      {!rows && <div className="text-xs text-muted-foreground py-2">{t("common.loading")}</div>}
      <div className="space-y-3">
        {rows?.map((row) => (
          <div key={row.user.id} className="rounded-xl bg-secondary/30 p-3">
            <div className="text-xs font-semibold text-foreground truncate mb-2">{row.user.name ?? row.user.email ?? row.user.id}</div>
            <div className="space-y-1.5">
              {row.roles.map((role) => (
                <div key={role.id}>
                  <div className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 border border-border/60">
                    <span className="text-xs font-semibold capitalize">{role.role.replace("_", " ")}</span>
                    <button
                      onClick={() => { setExpandedRoleId(expandedRoleId === role.id ? null : role.id); setNewRole(role.role as string); }}
                      className="text-[10px] font-semibold text-primary cursor-pointer shrink-0"
                    >
                      {expandedRoleId === role.id ? t("disputes.cancel") : t("admin.accesspanel.manage")}
                    </button>
                  </div>
                  {expandedRoleId === role.id && (
                    <div className="mt-1.5 pl-1 flex items-center gap-2 flex-wrap">
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as string)}
                        className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
                      >
                        {roleSlugs.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input
                        type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("admin.accesspanel.adminPassword")} className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs flex-1 min-w-[120px]"
                      />
                      <button
                        onClick={() => void handleReassign(role.id)}
                        disabled={saving || !password}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold cursor-pointer disabled:opacity-60"
                      >
                        <Repeat size={11} /> {t("admin.accesspanel.reassign")}
                      </button>
                      <button
                        onClick={() => void handleRemove(role.id)}
                        disabled={saving || !password}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-destructive/30 text-destructive text-[11px] font-semibold cursor-pointer disabled:opacity-60"
                      >
                        <Trash2 size={11} /> {t("team.remove")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppFeaturesSection() {
  const { t } = useTranslation("common");
  const roleSlugs = useRoleSlugs();
  const [profileType, setProfileType] = useState<string>("personal");
  const features = useProfileFeatures(profileType);
  const setFeatures = useAdminSetProfileFeaturesMutation();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const current = selected ?? new Set(features ?? []);

  const toggle = (key: string) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const handleSave = async () => {
    if (!password) return;
    setSaving(true);
    try {
      await setFeatures({ profileType, featureKeys: [...current], password });
      toast.success(`Updated feature visibility for ${profileType}`);
      setPassword("");
      setSelected(null);
    } catch {
      toast.error(t("admin.accesspanel.incorrectAdminPassword"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="text-sm font-bold text-foreground mb-1">{t("admin.accesspanel.appFeatureVisibility")}</div>
      <div className="text-xs text-muted-foreground mb-4">
        {t("admin.accesspanel.whichNavItemsEach")}
      </div>
      <select
        value={profileType}
        onChange={(e) => { setProfileType(e.target.value as string); setSelected(null); setPassword(""); }}
        className="mb-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs"
      >
        {roleSlugs.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {features === undefined ? (
        <div className="text-xs text-muted-foreground py-2">{t("common.loading")}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {APP_FEATURES.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={current.has(f.key)} onChange={() => toggle(f.key)} />
              {t(f.label)}
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t("admin.accesspanel.adminPassword")} className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs flex-1 min-w-[160px]"
        />
        <button
          onClick={() => void handleSave()}
          disabled={saving || !password}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer disabled:opacity-60"
        >
          <Save size={13} /> {saving ? t("admin.accesspanel.saving") : t("modules.save")}
        </button>
      </div>
    </div>
  );
}

function ConsoleFeaturesSection() {
  const { t } = useTranslation("common");
  const [role, setRole] = useState<(typeof CONSOLE_ROLES)[number]>("Personal");
  const [tabs, setTabs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const setConsoleRoleTabs = useAdminSetConsoleRoleTabsMutation();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // console_role_tabs has no App/-side hook (it's ops-console's own table) —
  // reused here as a plain read via the shared Supabase client, fetched on
  // demand per role selection rather than through react-query, since this
  // is the only place in App/ that ever reads it.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase.from("console_role_tabs").select("tab_key").eq("role", role).then((res) => {
      if (cancelled) return;
      setTabs((res.data ?? []).map((row) => row.tab_key as string));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [role]);

  const current = new Set(tabs ?? []);

  const toggle = (key: string) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    setTabs([...next]);
  };

  const handleSave = async () => {
    if (!password || !tabs) return;
    setSaving(true);
    try {
      await setConsoleRoleTabs({ role, tabKeys: tabs, password });
      toast.success(`Updated tab visibility for ${role}`);
      setPassword("");
    } catch {
      toast.error(t("admin.accesspanel.incorrectAdminPassword"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={14} className="text-primary" />
        <div className="text-sm font-bold text-foreground">{t("admin.accesspanel.opsConsoleFeatureVisibility")}</div>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        {t("admin.accesspanel.whichDashboardTabsEach")}
      </div>
      <select
        value={role}
        onChange={(e) => { setRole(e.target.value as (typeof CONSOLE_ROLES)[number]); setPassword(""); }}
        className="mb-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs"
      >
        {CONSOLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {!tabs || loading ? (
        <div className="text-xs text-muted-foreground py-2">{t("common.loading")}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {CONSOLE_TABS.map((tItem) => (
            <label key={tItem} className="flex items-center gap-1.5 text-xs capitalize cursor-pointer">
              <input type="checkbox" checked={current.has(tItem)} onChange={() => toggle(tItem)} />
              {tItem}
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t("admin.accesspanel.adminPassword")} className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs flex-1 min-w-[160px]"
        />
        <button
          onClick={() => void handleSave()}
          disabled={saving || !password}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer disabled:opacity-60"
        >
          <Save size={13} /> {saving ? t("admin.accesspanel.saving") : t("modules.save")}
        </button>
      </div>
    </div>
  );
}

export default function AccessPanel() {
  return (
    <div className="space-y-5 max-w-2xl">
      <ReassignRemoveSection />
      <AppFeaturesSection />
      <ConsoleFeaturesSection />
    </div>
  );
}
