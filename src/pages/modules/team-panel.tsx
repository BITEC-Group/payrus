import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Briefcase, Users } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { TEAM_PERMISSIONS, type TeamRole, type Workspace } from "@/lib/institutional-team.ts";
import { catText } from "@/lib/catalog-i18n.ts";
import {
  useAddTeamMember, useDeleteTeamRole, useRemoveTeamMember, useSaveTeamRole, useSetTeamMemberStatus, useTeam, useTeamRoles,
} from "@/hooks/use-institutional-team.ts";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// English source text; shown through catText() so it follows the language.
const PERM_LABEL: Record<string, string> = {
  view: "See all records", view_own: "See own records only", create: "Create records", edit: "Edit and send", reconcile: "Reconcile bank lines",
  approve: "Approve", settle: "Pay / settle", manage_team: "Manage team", manage_webhooks: "Manage webhooks", manage_settings: "Budgets and approval rules",
};

// Which books am I working in? Only shown when the user belongs to more than their own workspace.
export function WorkspaceSwitcher({ workspaces, current, onSelect }: { workspaces: Workspace[]; current: Workspace | null; onSelect: (ownerId: string) => void }) {
  const { t } = useTranslation("common");
  if (workspaces.length < 2) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
      <Briefcase size={15} className="text-muted-foreground" />
      <label className="text-xs text-muted-foreground" htmlFor="workspace">{t("team.workspace", "Workspace")}</label>
      <select id="workspace" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm min-w-0" value={current?.ownerId ?? ""} onChange={(e) => onSelect(e.target.value)}>
        {workspaces.map((w) => <option key={w.ownerId} value={w.ownerId}>{w.isSelf ? t("team.mine", "My account") : w.ownerName} — {catText(t, w.roleLabel)}</option>)}
      </select>
      {current && !current.isSelf && <span className="text-xs text-muted-foreground">{t("team.yourRole", "Your role here")}: <strong>{catText(t, current.roleLabel)}</strong></span>}
    </section>
  );
}

export function TeamPanel({ ownerId }: { ownerId: string }) {
  const { t } = useTranslation("common");
  const team = useTeam(ownerId).data ?? [];
  const roles = useTeamRoles(ownerId).data ?? [];
  // Built-in roles are seeded in English; roles the owner created are shown as written.
  const roleName = (r: TeamRole) => (r.isSystem ? catText(t, r.label) : r.label);
  const roleHint = (r: TeamRole | undefined) => (r ? (r.isSystem ? catText(t, r.description) : r.description) : "");
  const permName = (p: string) => catText(t, PERM_LABEL[p] ?? p);
  const add =useAddTeamMember(); const setStatus = useSetTeamMemberStatus(); const remove = useRemoveTeamMember();
  const saveRole = useSaveTeamRole(); const delRole = useDeleteTeamRole();
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState("viewer");
  const [showRoles, setShowRoles] = useState(false);
  const [rname, setRname] = useState("");
  const [rperms, setRperms] = useState<string[]>(["view"]);

  async function invite() {
    try { await add.mutateAsync({ ownerId, identifier: identifier.trim(), role }); setIdentifier(""); toast.success(t("team.added", "Team member added")); }
    catch (e) { toast.error(msg(e)); }
  }
  async function createRole() {
    try { await saveRole.mutateAsync({ ownerId, label: rname.trim(), permissions: rperms }); setRname(""); setRperms(["view"]); toast.success(t("team.roleSaved", "Role created")); }
    catch (e) { toast.error(msg(e)); }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2"><Users size={15} />{t("team.title", "Team and roles")} ({team.length})</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t("team.hint", "Give colleagues access to this account's modules. Each person acts under their own name, so the four-eyes rule still applies. You are the Owner.")}</p>
      </div>

      <div className="space-y-1.5">
        {team.length === 0 && <p className="text-sm text-muted-foreground">{t("team.none", "No team members yet.")}</p>}
        {team.map((m) => (
          <div key={m.memberId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{m.name} <span className="text-xs text-muted-foreground font-normal">{m.email}</span></div>
              <div className="text-xs text-muted-foreground">{catText(t, m.roleLabel)}{m.status === "suspended" ? ` · ${t("team.suspended", "suspended")}` : ""}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void setStatus.mutateAsync({ ownerId, memberId: m.memberId, status: m.status === "active" ? "suspended" : "active" }).catch((e) => toast.error(msg(e)))}>
                {m.status === "active" ? t("team.suspend", "Suspend") : t("team.reactivate", "Reactivate")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t("team.removeConfirm", "Remove this person from the workspace?"))) void remove.mutateAsync({ ownerId, memberId: m.memberId }).catch((e) => toast.error(msg(e))); }}>
                {t("team.remove", "Remove")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground">{t("team.invite", "Add a PayRus member")}</div>
        <div className="flex flex-wrap gap-2">
          <Input className="flex-1 min-w-[12rem]" placeholder={t("team.identifier", "Email, @username or phone")} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r.slug} value={r.slug}>{roleName(r)}</option>)}
          </select>
          <Button size="sm" disabled={!identifier.trim() || add.isPending} onClick={() => void invite()}>{t("team.add", "Add")}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{roleHint(roles.find((r) => r.slug === role))}</p>
      </div>

      <div className="pt-2 border-t border-border">
        <button className="text-xs text-primary underline cursor-pointer" onClick={() => setShowRoles(!showRoles)}>{showRoles ? t("team.hideRoles", "Hide roles") : t("team.showRoles", "Roles and permissions")}</button>
        {showRoles && (
          <div className="mt-2 space-y-2">
            {roles.map((r) => (
              <div key={r.slug} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{roleName(r)} <span className="text-xs text-muted-foreground font-normal">{r.isSystem ? t("team.system", "built-in") : t("team.custom", "custom")}</span></span>
                  {!r.isSystem && <Button size="sm" variant="ghost" onClick={() => void delRole.mutateAsync({ ownerId, slug: r.slug }).catch((e) => toast.error(msg(e)))}>{t("team.remove", "Remove")}</Button>}
                </div>
                <p className="text-xs text-muted-foreground">{r.permissions.map(permName).join(" · ")}</p>
              </div>
            ))}
            <div className="rounded-lg border border-dashed border-border p-2.5 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{t("team.newRole", "New custom role")}</div>
              <Input placeholder={t("team.roleName", "Role name")} value={rname} onChange={(e) => setRname(e.target.value)} />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {TEAM_PERMISSIONS.map((p) => (
                  <label key={p} className={cn("inline-flex items-center gap-1.5 text-xs cursor-pointer")}>
                    <input type="checkbox" checked={rperms.includes(p)} onChange={(e) => setRperms(e.target.checked ? [...rperms, p] : rperms.filter((x) => x !== p))} /> {permName(p)}
                  </label>
                ))}
              </div>
              <Button size="sm" disabled={rname.trim().length < 2 || rperms.length === 0 || saveRole.isPending} onClick={() => void createRole()}>{t("team.createRole", "Create role")}</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
