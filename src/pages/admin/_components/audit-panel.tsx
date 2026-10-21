import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useAdminAuditEvents } from "@/hooks/use-backend.ts";

const TABLES = ["", "user_roles", "users", "transfers", "support_escalations", "support_permissions", "gate_passwords", "profile_features", "console_role_tabs", "fx_margin_config", "expense_reports"];

const short = (v: unknown) => {
  const s = JSON.stringify(v);
  return s && s.length > 400 ? `${s.slice(0, 400)}…` : s;
};

// Read-only view of the tamper-evident audit trail (audit_events, hash-chained
// by its trigger). Admin tier only (admin_list_audit_events).
export default function AuditPanel() {
  const { t } = useTranslation("common");
  const [table, setTable] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const { data, isLoading, error } = useAdminAuditEvents(table || undefined);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="audit-table" className="text-[10px] font-semibold uppercase text-muted-foreground">{t("admin.auditpanel.table")}</label>
        <select id="audit-table" value={table} onChange={(e) => setTable(e.target.value)} className="rounded-xl border border-border bg-card px-2 py-2 text-xs">
          {TABLES.map((tItem) => <option key={tItem} value={tItem}>{tItem || t("admin.auditpanel.allTables")}</option>)}
        </select>
        <span className="text-[10px] text-muted-foreground">{t("admin.auditpanel.latest200EventsNewest")}</span>
      </div>
      {isLoading && <div className="text-xs text-muted-foreground text-center py-8">{t("admin.auditpanel.loadingAuditEvents")}</div>}
      {error && <div className="text-xs text-destructive text-center py-8">{t("admin.auditpanel.theAuditLogNeeds")}</div>}
      {data && data.length === 0 && <div className="text-xs text-muted-foreground text-center py-8">{t("admin.auditpanel.noEvents")}</div>}
      <div className="space-y-1.5">
        {data?.map((e) => (
          <div key={e.seq} className="bg-card border border-border rounded-xl px-3 py-2">
            <button className="w-full text-left cursor-pointer" onClick={() => setOpen(open === e.seq ? null : e.seq)}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold font-mono">{e.action}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(e.occurredAt).toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {e.actorName ?? e.actorEmail ?? e.actorLabel}{e.reason ? ` · ${e.reason}` : ""}
              </div>
            </button>
            {open === e.seq && (
              <div className="mt-2 grid gap-2 md:grid-cols-2 text-[10px] font-mono">
                <div><div className="text-muted-foreground mb-0.5">{t("admin.auditpanel.before")}</div><pre className="whitespace-pre-wrap break-all bg-secondary/40 rounded-lg p-2">{short(e.beforeData) ?? "—"}</pre></div>
                <div><div className="text-muted-foreground mb-0.5">{t("admin.auditpanel.after")}</div><pre className="whitespace-pre-wrap break-all bg-secondary/40 rounded-lg p-2">{short(e.afterData) ?? "—"}</pre></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
