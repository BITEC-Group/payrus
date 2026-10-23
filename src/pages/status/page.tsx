import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase-client.ts";
import { useSystemStatus } from "@/hooks/use-system-status.ts";

// PRS-OPS-010 / TCX-OPS-04 / TCX-NEW-06: a public status page. The overall state combines the live probe of the
// backend with incidents recorded by operations (status_incidents), so an injected partner outage shows as degraded
// instead of "Systems operational". It is public so a monitor or crawler can read it without signing in.
type Incident = { id: string; component: string; severity: string; title: string; started_at: string; resolved_at: string | null };

export default function StatusPage() {
  const { t } = useTranslation("common");
  const probe = useSystemStatus();
  const incidents = useQuery({
    queryKey: ["status-incidents"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Incident[]> => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const res = await supabase.from("status_incidents").select("*").gte("started_at", since).order("started_at", { ascending: false });
      return res.error ? [] : ((res.data ?? []) as Incident[]);
    },
  });
  const open = (incidents.data ?? []).filter((i) => !i.resolved_at);
  const overall = probe.state === "down" || open.some((i) => i.severity === "critical") ? "down"
    : probe.state === "degraded" || open.length > 0 ? "degraded"
    : probe.state === "checking" ? "checking" : "operational";

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">{t("status.title")}</h1>
      <div role="status" data-testid="status-overall" data-state={overall} className="rounded-2xl border border-border p-4 flex items-center justify-between">
        <span className="font-semibold">{t(`status.overall.${overall}`)}</span>
        {probe.latencyMs !== undefined ? <span className="text-xs text-muted-foreground">{`${probe.latencyMs} ms`}</span> : null}
      </div>
      <section aria-labelledby="incidents-h" className="space-y-3">
        <h2 id="incidents-h" className="font-semibold">{t("status.incidents")}</h2>
        {(incidents.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t("status.none")}</p> : null}
        {(incidents.data ?? []).map((i) => (
          <div key={i.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="font-semibold">{i.title}</div>
            <div className="text-xs text-muted-foreground">
              {t(`status.component.${i.component}`, { defaultValue: i.component })} · {t(`status.severity.${i.severity}`, { defaultValue: i.severity })} · {new Date(i.started_at).toLocaleString()} · {i.resolved_at ? t("status.resolved") : t("status.ongoing")}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
