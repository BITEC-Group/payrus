import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  useAdminListUsers, useMyPermissions, useSupportRoles, useSupportPermissions,
  useAdminSetSupportPermissionMutation, useAdminAssignStaffRoleMutation, useAdminRevokeStaffRoleMutation, useAdminSetGatePasswordMutation,
} from "@/hooks/use-backend.ts";

const ACTIONS = ["create", "read", "update", "delete"] as const;
const RESOURCES = ["transactions", "users"] as const;
// users.create / users.delete are reserved (see migration 0024).
const UNAVAILABLE = new Set(["users:create", "users:delete"]);
// Delete is never delegated: only the superadmin tier holds it (locked in the database).
const isLocked = (resource: string, action: string) => UNAVAILABLE.has(`${resource}:${action}`) || action === "delete";

// Staff roles + the CRUD matrix. Everyone with a staff role can read the
// matrix; only a superadmin can change it or assign roles (enforced by the
// database, gate-password confirmed).
export default function StaffPanel() {
  const { t } = useTranslation("common");
  const perms = useMyPermissions();
  const roles = useSupportRoles();
  const matrix = useSupportPermissions();
  const users = useAdminListUsers();
  const setPermission = useAdminSetSupportPermissionMutation();
  const assign = useAdminAssignStaffRoleMutation();
  const revoke = useAdminRevokeStaffRoleMutation();
  const [userId, setUserId] = useState("");
  const [roleSlug, setRoleSlug] = useState("support_agent");
  const setGatePassword = useAdminSetGatePasswordMutation();
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");

  const isSuper = perms?.isSuperadmin ?? false;
  const staffSlugs = new Set((roles ?? []).map((r) => r.slug));

  const ask = (what: string) => window.prompt(`Enter the admin password to ${what}:`);
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message.replace(/^[A-Za-z]+: /, "") : "Action failed");

  const toggle = async (slug: string, resource: (typeof RESOURCES)[number], action: (typeof ACTIONS)[number]) => {
    const current = matrix?.find((m) => m.roleSlug === slug && m.resource === resource);
    const next = { create: current?.create ?? false, read: current?.read ?? false, update: current?.update ?? false, delete: current?.delete ?? false };
    next[action] = !next[action];
    const password = ask("change this permission");
    if (password === null) return;
    try {
      await setPermission({ roleSlug: slug, resource, ...next, password });
      toast.success(t("admin.staffpanel.permissionUpdated"));
    } catch (e) {
      fail(e);
    }
  };

  const handleAssign = async () => {
    if (!userId) return;
    const password = ask(`assign ${roleSlug.replace("_", " ")}`);
    if (password === null) return;
    try {
      await assign({ userId, roleSlug, password });
      toast.success(t("admin.staffpanel.staffRoleAssigned"));
    } catch (e) {
      fail(e);
    }
  };

  const handleRevoke = async (uid: string, slug: string) => {
    const password = ask("revoke this staff role");
    if (password === null) return;
    try {
      await revoke({ userId: uid, roleSlug: slug, password });
      toast.success(t("admin.staffpanel.staffRoleRevoked"));
    } catch (e) {
      fail(e);
    }
  };

  const staffRows = (users ?? []).flatMap((row) =>
    row.roles.filter((r) => staffSlugs.has(r.role)).map((r) => ({ user: row.user, role: r.role })),
  );

  return (
    <div className="space-y-5">
      {!isSuper && (
        <div className="text-[11px] text-muted-foreground bg-secondary/50 rounded-xl px-3 py-2">
          {t("admin.staffpanel.readOnlyOnlyA")}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="text-xs font-bold">{t("admin.staffpanel.permissionMatrixCreateRead")}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-muted-foreground">
                <th className="py-1 pr-3">{t("savings.cardRoleLabel")}</th>
                <th className="py-1 pr-3">{t("admin.staffpanel.resource")}</th>
                {ACTIONS.map((a) => <th key={a} className="py-1 px-2 text-center">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {(roles ?? []).flatMap((role) =>
                RESOURCES.map((resource) => {
                  const cell = matrix?.find((m) => m.roleSlug === role.slug && m.resource === resource);
                  const bypass = role.slug === "superadmin";
                  return (
                    <tr key={`${role.slug}:${resource}`} className="border-t border-border">
                      <td className="py-1.5 pr-3 font-semibold" title={role.description}>{resource === "transactions" ? role.label : ""}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{resource}</td>
                      {ACTIONS.map((action) => {
                        const unavailable = isLocked(resource, action);
                        const checked = bypass ? !UNAVAILABLE.has(`${resource}:${action}`) : Boolean(cell?.[action]);
                        return (
                          <td key={action} className="py-1.5 px-2 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${role.label} ${resource} ${action}`}
                              checked={checked}
                              disabled={!isSuper || bypass || unavailable}
                              onChange={() => void toggle(role.slug, resource, action)}
                              className={cn("cursor-pointer", (!isSuper || bypass || unavailable) && "cursor-not-allowed opacity-50")}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {t("admin.staffpanel.superadminBypassesTheMatrix")}
        </div>
      </div>

      {isSuper && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold">{t("admin.staffpanel.assignAStaffRole")}</div>
          <div className="flex gap-2 flex-wrap">
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="flex-1 min-w-[180px] rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
              <option value="">{t("admin.staffpanel.selectAUser")}</option>
              {(users ?? []).map((row) => (
                <option key={row.user.id} value={row.user.id}>{row.user.name ?? row.user.email ?? row.user.id}{row.user.email ? ` (${row.user.email})` : ""}</option>
              ))}
            </select>
            <select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
              {(roles ?? []).map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
            </select>
            <button onClick={() => void handleAssign()} disabled={!userId} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground cursor-pointer disabled:opacity-60">
              {t("admin.staffpanel.assign")}
            </button>
          </div>
        </div>
      )}

      {isSuper && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold">{t("admin.staffpanel.changeTheAdminPassword")}</div>
          <div className="text-[10px] text-muted-foreground">{t("admin.staffpanel.theSharedGatePassword")}</div>
          <div className="flex gap-2 flex-wrap">
            <input type="password" aria-label={t("admin.staffpanel.currentAdminPassword")} placeholder={t("admin.staffpanel.currentPassword")} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="flex-1 min-w-[150px] rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
            <input type="password" aria-label={t("admin.staffpanel.newAdminPassword")} placeholder={t("admin.staffpanel.newPassword4Characters")} value={nextPw} onChange={(e) => setNextPw(e.target.value)} className="flex-1 min-w-[150px] rounded-lg border border-border bg-card px-2 py-1.5 text-xs" />
            <button
              disabled={!currentPw || nextPw.length < 4}
              onClick={() => void setGatePassword({ current: currentPw, next: nextPw }).then(() => { toast.success(t("admin.staffpanel.adminPasswordChanged")); setCurrentPw(""); setNextPw(""); }).catch(fail)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground cursor-pointer disabled:opacity-60"
            >
              {t("admin.staffpanel.change")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <div className="text-xs font-bold">{t("admin.staffpanel.currentStaff", { count: staffRows.length })}</div>
        {staffRows.length === 0 && <div className="text-[11px] text-muted-foreground">{t("admin.staffpanel.noStaffRolesAssigned")}</div>}
        {staffRows.map(({ user, role }) => (
          <div key={`${user.id}:${role}`} className="flex items-center justify-between gap-2 bg-secondary/30 rounded-lg px-3 py-2">
            <div className="min-w-0 text-xs">
              <span className="font-semibold">{user.name ?? user.email}</span>
              <span className="text-muted-foreground"> · {(roles ?? []).find((r) => r.slug === role)?.label ?? role}</span>
            </div>
            {isSuper && (
              <button onClick={() => void handleRevoke(user.id, role)} className="text-[10px] font-semibold text-destructive cursor-pointer shrink-0">{t("admin.staffpanel.revoke")}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
