import { useTranslation } from "react-i18next";
import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Search, ShieldCheck, Sparkles, Wallet, CreditCard, Save, X, Plus,
  Trash2, CheckCircle2, Clock, AlertCircle, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import EscalateForm from "./escalate-form.tsx";
import type { AppUserRole, AdminUserRow } from "@/lib/backend.ts";
import {
  useAdminListUsers, useAdminUpdateUserRoleMutation, useAdminCreateUserMutation,
  useAdminGrantAdminRoleMutation, useTestUsersCleanupMutation, useAdminUpdateUserMutation, useMyPermissions,
} from "@/hooks/use-backend.ts";

const ALL_ROLES = [
  "personal", "merchant", "agent", "treasury", "public_institution",
  "ngo", "group", "starter", "admin",
] as const;

type Role = AppUserRole;
type UserRow = AdminUserRow;

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { icon: typeof CheckCircle2; cls: string }> = {
    verified: { icon: CheckCircle2, cls: "bg-primary/10 text-primary" },
    pending_verification: { icon: Clock, cls: "bg-amber-100 text-amber-700" },
    incomplete: { icon: AlertCircle, cls: "bg-destructive/10 text-destructive" },
  };
  const m = map[status] ?? map.incomplete;
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", m.cls)}>
      <Icon size={9} />{status.replace("_", " ")}
    </span>
  );
}

function EditRoleForm({ row, roleId, onDone }: { row: UserRow; roleId: string; onDone: () => void }) {
  const { t } = useTranslation("common");
  const role = row.roles.find((r) => r.id === roleId)!;
  const updateUserRole = useAdminUpdateUserRoleMutation();
  const [status, setStatus] = useState(role.status);
  const [phone, setPhone] = useState(role.phone ?? "");
  const [address, setAddress] = useState(role.address ?? "");
  const [orgName, setOrgName] = useState(role.orgName ?? "");
  const [legalRepName, setLegalRepName] = useState(role.legalRepName ?? "");
  const [legalRepIdNumber, setLegalRepIdNumber] = useState(role.legalRepIdNumber ?? "");
  const [legalRepPhone, setLegalRepPhone] = useState(role.legalRepPhone ?? "");
  const [saving, setSaving] = useState(false);

  const isOrg = role.kind === "organisation";

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserRole({
        roleId,
        status: status as "incomplete" | "pending_verification" | "verified",
        phone, address,
        ...(isOrg ? { orgName, legalRepName, legalRepIdNumber, legalRepPhone } : {}),
      });
      toast.success(t("admin.userspanel.profileUpdated"));
      onDone();
    } catch {
      toast.error(t("admin.userspanel.couldnTSaveChanges"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-secondary/40 rounded-xl p-3 mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground font-semibold uppercase">
          {t("receipt.status")}
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
            <option value="incomplete">{t("admin.userspanel.incomplete")}</option>
            <option value="pending_verification">{t("admin.userspanel.pendingVerification")}</option>
            <option value="verified">{t("settings.status.verified")}</option>
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground font-semibold uppercase">
          {t("settings.profile.phone")}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
        </label>
        <label className="text-[10px] text-muted-foreground font-semibold uppercase col-span-2">
          {t("admin.userspanel.address")}
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
        </label>
        {isOrg && (
          <>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase col-span-2">
              {t("profile.orgName")}
              <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
            </label>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase">
              {t("admin.userspanel.legalRepName")}
              <input value={legalRepName} onChange={(e) => setLegalRepName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
            </label>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase">
              {t("admin.userspanel.legalRepIdNumber")}
              <input value={legalRepIdNumber} onChange={(e) => setLegalRepIdNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
            </label>
            <label className="text-[10px] text-muted-foreground font-semibold uppercase col-span-2">
              {t("admin.userspanel.legalRepPhone")}
              <input value={legalRepPhone} onChange={(e) => setLegalRepPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
            </label>
          </>
        )}
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onDone} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer">
          <X size={12} /> {t("disputes.cancel")}
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground cursor-pointer disabled:opacity-60">
          <Save size={12} /> {saving ? t("admin.accesspanel.saving") : t("admin.users.save")}
        </button>
      </div>
    </div>
  );
}

function EditUserForm({ user, onDone }: { user: UserRow["user"]; onDone: () => void }) {
  const { t } = useTranslation("common");
  const updateUser = useAdminUpdateUserMutation();
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [country, setCountry] = useState(user.country ?? "");
  const [currency, setCurrency] = useState(user.defaultCurrency ?? "");
  const [kyc, setKyc] = useState(user.kycStatus);
  const [saving, setSaving] = useState(false);
  const field = "mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs";

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({
        userId: user.id, name, phone,
        country: country.trim() ? country.trim().toUpperCase() : undefined,
        defaultCurrency: currency.trim() ? currency.trim().toUpperCase() : undefined,
        kycStatus: kyc,
      });
      toast.success(t("admin.userspanel.userUpdated"));
      onDone();
    } catch {
      toast.error(t("admin.userspanel.couldNotSaveChanges"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-secondary/40 rounded-xl p-3 mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground font-semibold uppercase col-span-2">
          {t("admin.users.name")}
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="text-[10px] text-muted-foreground font-semibold uppercase">
          {t("settings.profile.phone")}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
        </label>
        <label className="text-[10px] text-muted-foreground font-semibold uppercase">
          {t("admin.userspanel.kycStatus")}
          <select value={kyc} onChange={(e) => setKyc(e.target.value as typeof kyc)} className={field}>
            <option value="unverified">{t("admin.userspanel.unverified")}</option>
            <option value="submitted">{t("txd.state.submitted")}</option>
            <option value="verified">{t("settings.status.verified")}</option>
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground font-semibold uppercase">
          {t("admin.userspanel.countryIso2")}
          <input value={country} maxLength={2} onChange={(e) => setCountry(e.target.value)} className={field} />
        </label>
        <label className="text-[10px] text-muted-foreground font-semibold uppercase">
          {t("admin.userspanel.defaultCurrency")}
          <input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} className={field} />
        </label>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onDone} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer">
          <X size={12} /> {t("disputes.cancel")}
        </button>
        <button onClick={() => void handleSave()} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground cursor-pointer disabled:opacity-60">
          <Save size={12} /> {saving ? t("admin.accesspanel.saving") : t("admin.userspanel.saveUser")}
        </button>
      </div>
    </div>
  );
}

function CreateProfileForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("common");
  const createUser = useAdminCreateUserMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ALL_ROLES)[number]>("personal");
  const [kind, setKind] = useState<"individual" | "organisation">("individual");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdminRole = role === "admin";

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error(t("admin.userspanel.nameAndEmailAre"));
      return;
    }
    if (isAdminRole && !password) {
      toast.error(t("admin.userspanel.theAdminRoleRequires"));
      return;
    }
    setSaving(true);
    try {
      const result = await createUser({
        name: name.trim(), email: email.trim().toLowerCase(), role, kind,
        ...(isAdminRole ? { password } : {}),
      });
      toast.success(result.alreadyExisted ? "That role already existed for this email" : "Profile created");
      onDone();
    } catch {
      toast.error(isAdminRole ? "Incorrect admin password" : "Couldn't create this profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input placeholder={t("registerCustomer.name")} value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs col-span-2" />
        <input placeholder={t("settings.profile.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs col-span-2" />
        <select value={role} onChange={(e) => setRole(e.target.value as (typeof ALL_ROLES)[number])} className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as "individual" | "organisation")} className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
          <option value="individual">{t("registerCustomer.kindIndividual")}</option>
          <option value="organisation">{t("registerCustomer.kindOrganisation")}</option>
        </select>
        {isAdminRole && (
          <input
            placeholder={t("admin.accesspanel.adminPassword")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs col-span-2"
          />
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer">{t("disputes.cancel")}</button>
        <button onClick={handleCreate} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground cursor-pointer disabled:opacity-60">
          <Plus size={12} /> {saving ? t("admin.userspanel.creating") : t("admin.users.create")}
        </button>
      </div>
    </motion.div>
  );
}

export default function UsersPanel() {
  const { t } = useTranslation("common");
  const rows = useAdminListUsers();
  const grantAdminRole = useAdminGrantAdminRoleMutation();
  const createUser = useAdminCreateUserMutation();
  const cleanup = useTestUsersCleanupMutation();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [escalateUserId, setEscalateUserId] = useState<string | null>(null);
  const perms = useMyPermissions();
  const canEdit = perms?.users.update ?? false;
  const isSuper = perms?.isSuperadmin ?? false;

  const filtered = (rows ?? []).filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      row.user.name?.toLowerCase().includes(q) ||
      row.user.email?.toLowerCase().includes(q) ||
      row.user.username?.toLowerCase().includes(q) ||
      row.user.id.toLowerCase().includes(q) ||
      row.roles.some((r) => r.role.toLowerCase().includes(q))
    );
  });

  const handleCleanup = async () => {
    const deletedCount = await cleanup();
    toast.success(`Removed ${deletedCount} test profile(s)`);
  };

  // A single canonical admin profile (admin@payrus.app), gated by the demo
  // admin password — separate from "Make admin" below, which grants the
  // role to an existing profile the admin already picked.
  const handleCreateAdminProfile = async () => {
    const password = window.prompt(t("Set the admin password to create the admin profile:"));
    if (password === null) return;
    try {
      const result = await createUser({
        name: "Admin", email: "admin@payrus.app", role: "admin", kind: "individual", password,
      });
      toast.success(result.alreadyExisted ? "Admin profile already exists" : "Admin profile created (admin@payrus.app)");
    } catch {
      toast.error(t("admin.accesspanel.incorrectAdminPassword"));
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    const password = window.prompt(t("Enter the admin password to grant this role:"));
    if (password === null) return;
    try {
      await grantAdminRole({ userId, password });
      toast.success(t("admin.userspanel.grantedAdminRole"));
    } catch {
      toast.error(t("admin.accesspanel.incorrectAdminPassword"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.userspanel.searchByNameEmail")}
            className="w-full rounded-xl border border-border bg-card pl-8 pr-3 py-2 text-xs"
          />
        </div>
        {canEdit && <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
        >
          <Plus size={13} /> {t("admin.users.addNew")}
        </button>}
        {canEdit && <button
          onClick={() => void handleCreateAdminProfile()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 text-primary text-xs font-semibold cursor-pointer hover:bg-primary/5 whitespace-nowrap"
        >
          <KeyRound size={13} /> {t("admin.userspanel.createAdminProfile")}
        </button>}
        {isSuper && <button
          onClick={() => void handleCleanup()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/30 text-destructive text-xs font-semibold cursor-pointer hover:bg-destructive/5"
        >
          <Trash2 size={13} /> {t("admin.userspanel.cleanUpTestData")}
        </button>}
      </div>

      {creating && <CreateProfileForm onDone={() => setCreating(false)} />}

      {rows === undefined && (
        <div className="text-xs text-muted-foreground text-center py-8">{t("admin.userspanel.loadingUsers")}</div>
      )}
      {rows && filtered.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-8">{t("admin.users.noResults")}</div>
      )}

      <div className="space-y-3">
        {filtered.map((row) => {
          const totalBalance = row.wallets.reduce((sum, w) => sum + w.balance, 0);
          const primaryCard = row.cards[0];
          return (
            <div key={row.user.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{row.user.name ?? "—"}</span>
                    {row.user.isTestData && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-1">
                        <Sparkles size={9} /> {t("admin.userspanel.test")}
                      </span>
                    )}
                    {row.roles.some((r) => r.role === "admin") && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                        <ShieldCheck size={9} /> {t("profile.badge.admin")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {row.user.email ?? t("admin.userspanel.noEmail")}
                    {row.user.username && <span className="text-muted-foreground/70"> · @{row.user.username}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 font-mono truncate">{row.user.id}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                      <Wallet size={11} className="text-muted-foreground" /> {row.wallets.length} · {totalBalance.toLocaleString()}
                    </div>
                    {primaryCard && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground justify-end">
                        <CreditCard size={11} /> {primaryCard.brand} •• {primaryCard.last4}
                      </div>
                    )}
                  </div>
                  {canEdit && <button
                    onClick={() => setEditingUserId(editingUserId === row.user.id ? null : row.user.id)}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary cursor-pointer whitespace-nowrap"
                  >
                    {editingUserId === row.user.id ? t("common.close") : t("admin.userspanel.editUser")}
                  </button>}
                  {!canEdit && (
                    <button
                      onClick={() => setEscalateUserId(escalateUserId === row.user.id ? null : row.user.id)}
                      className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary cursor-pointer whitespace-nowrap"
                    >
                      {escalateUserId === row.user.id ? t("common.close") : t("organisation.organisationpanel.escalate")}
                    </button>
                  )}
                  {canEdit && !row.roles.some((r) => r.role === "admin") && (
                    <button
                      onClick={() => void handleMakeAdmin(row.user.id)}
                      className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary cursor-pointer whitespace-nowrap"
                    >
                      {t("admin.userspanel.makeAdmin")}
                    </button>
                  )}
                </div>
              </div>

              {escalateUserId === row.user.id && (
                <EscalateForm userId={row.user.id} userLabel={row.user.name ?? row.user.email ?? row.user.id} onDone={() => setEscalateUserId(null)} />
              )}

              {editingUserId === row.user.id && (
                <EditUserForm user={row.user} onDone={() => setEditingUserId(null)} />
              )}

              <div className="mt-3 space-y-1.5">
                {row.roles.map((role) => (
                  <div key={role.id}>
                    <div className="flex items-center justify-between gap-2 bg-secondary/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold capitalize">{role.role.replace("_", " ")}</span>
                        <StatusPill status={role.status} />
                        <span className="text-[10px] text-muted-foreground">{role.kind}</span>
                      </div>
                      <button
                        onClick={() => setEditingRoleId(editingRoleId === role.id ? null : role.id)}
                        className="text-[10px] font-semibold text-primary cursor-pointer shrink-0"
                      >
                        {editingRoleId === role.id ? t("common.close") : t("savings.edit")}
                      </button>
                    </div>
                    {editingRoleId === role.id && (
                      <EditRoleForm row={row} roleId={role.id} onDone={() => setEditingRoleId(null)} />
                    )}
                  </div>
                ))}
                {row.roles.length === 0 && (
                  <div className="text-[11px] text-muted-foreground italic px-1">{t("admin.userspanel.noRolesActivatedYet")}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
