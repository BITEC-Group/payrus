import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, KeyRound, PlugZap, RotateCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { catText } from "@/lib/catalog-i18n.ts";
import { WEBHOOK_EVENTS } from "@/lib/institutional-webhooks.ts";
import {
  useCreateWebhook, useDeleteWebhook, useRetryWebhookDelivery, useRotateWebhookSecret, useSetWebhookActive, useTestWebhook, useWebhookDeliveries, useWebhooks,
} from "@/hooks/use-institutional-webhooks.ts";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const STATUS_TONE: Record<string, string> = {
  sent: "bg-primary/10 text-primary", queued: "bg-secondary text-muted-foreground", sending: "bg-secondary text-muted-foreground",
  failed: "bg-amber-500/10 text-amber-600", dead: "bg-destructive/10 text-destructive",
};

export function WebhooksPanel({ userId }: { userId: string }) {
  const { t } = useTranslation("common");
  const hooks = useWebhooks(userId).data ?? [];
  const create = useCreateWebhook(); const setActive = useSetWebhookActive(); const del = useDeleteWebhook();
  const rotate = useRotateWebhookSecret(); const test = useTestWebhook(); const retry = useRetryWebhookDelivery();
  const [showLog, setShowLog] = useState(false);
  const deliveries = useWebhookDeliveries(userId, undefined, showLog).data ?? [];
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>(["record.status_changed", "record.settled"]);
  const [secret, setSecret] = useState<{ id: string; value: string } | null>(null);

  async function add() {
    try {
      const r = await create.mutateAsync({ userId, url: url.trim(), events, description });
      setSecret({ id: r.id, value: r.secret }); setUrl(""); setDescription("");
    } catch (e) { toast.error(msg(e)); }
  }
  async function doRotate(id: string) {
    if (!window.confirm(t("webhooks.rotateConfirm", "Rotate the signing secret? Your receiver must switch to the new secret."))) return;
    try { setSecret({ id, value: await rotate.mutateAsync({ userId, id }) }); } catch (e) { toast.error(msg(e)); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success(t("webhooks.copied", "Copied")); } catch { toast.error(t("webhooks.copyFail", "Copy failed")); }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2"><PlugZap size={15} />{t("webhooks.title", "Webhooks")} ({hooks.length}/10)</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t("webhooks.hint", "Get a signed HTTPS call when records change. The header PayRus-Signature is t=<time>,v1=<HMAC-SHA256 of \"<time>.<raw body>\" with your secret>. Failed deliveries retry after 1 min, 5 min, 30 min, 2 h and 12 h.")}</p>
      </div>

      {secret && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
          <div className="text-xs font-medium flex items-center gap-1.5"><KeyRound size={13} />{t("webhooks.secretOnce", "Signing secret — shown only now. Store it in your receiver.")}</div>
          <div className="flex items-center gap-2">
            <code className="text-xs break-all flex-1 rounded bg-secondary px-2 py-1.5">{secret.value}</code>
            <Button size="sm" variant="outline" onClick={() => void copy(secret.value)}><Copy size={13} /></Button>
            <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>{t("webhooks.done", "Done")}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {hooks.length === 0 && <p className="text-sm text-muted-foreground">{t("webhooks.none", "No webhooks yet.")}</p>}
        {hooks.map((h) => (
          <div key={h.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium break-all">{h.url}</div>
                <div className="text-xs text-muted-foreground">{h.description ? `${h.description} · ` : ""}{h.events.join(", ")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {h.delivered24h} {t("webhooks.delivered", "delivered")} · {h.failed24h} {t("webhooks.failed", "failed")} (24h) · {h.pending} {t("webhooks.pending", "pending")}
                  {h.lastStatusCode ? ` · ${t("webhooks.last", "last")} HTTP ${h.lastStatusCode}` : ""}
                </div>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={h.active} onChange={(e) => void setActive.mutateAsync({ userId, id: h.id, active: e.target.checked })} />
                {h.active ? t("webhooks.active", "Active") : t("webhooks.paused", "Paused")}
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={async () => { try { await test.mutateAsync({ userId, id: h.id }); toast.success(t("webhooks.testQueued", "Test event queued — delivered within a minute")); setShowLog(true); } catch (e) { toast.error(msg(e)); } }}><Send size={13} /> {t("webhooks.test", "Send test")}</Button>
              <Button size="sm" variant="outline" onClick={() => void doRotate(h.id)}><RotateCw size={13} /> {t("webhooks.rotate", "Rotate secret")}</Button>
              <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t("webhooks.deleteConfirm", "Delete this webhook and its delivery log?"))) void del.mutateAsync({ userId, id: h.id }); }}><Trash2 size={13} /> {t("webhooks.delete", "Delete")}</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground">{t("webhooks.new", "New webhook")}</div>
        <Input placeholder="https://example.com/payrus-webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Input placeholder={t("webhooks.description", "Description (optional)")} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={events.includes(ev)} onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))} /> {ev}
            </label>
          ))}
        </div>
        <Button size="sm" disabled={!url.trim() || events.length === 0 || create.isPending || hooks.length >= 10} onClick={() => void add()}>{t("webhooks.add", "Add webhook")}</Button>
      </div>

      <div className="pt-2 border-t border-border">
        <button className="text-xs text-primary underline cursor-pointer" onClick={() => setShowLog(!showLog)}>{showLog ? t("webhooks.hideLog", "Hide delivery log") : t("webhooks.showLog", "Show delivery log")}</button>
        {showLog && (
          <div className="mt-2 space-y-1.5">
            {deliveries.length === 0 && <p className="text-xs text-muted-foreground">{t("webhooks.noDeliveries", "No deliveries yet.")}</p>}
            {deliveries.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-xs rounded border border-border px-2 py-1.5">
                <div className="min-w-0">
                  <span className={cn("px-1.5 py-0.5 rounded-full mr-2", STATUS_TONE[d.status])}>{catText(t, d.status)}</span>
                  <span className="font-medium">{d.event}</span>
                  <span className="text-muted-foreground"> · {new Date(d.createdAt).toLocaleString()} · {d.attempts} {t("webhooks.attempts", "attempt(s)")}{d.responseCode ? ` · HTTP ${d.responseCode}` : ""}{d.lastError ? ` · ${d.lastError}` : ""}</span>
                </div>
                {(d.status === "failed" || d.status === "dead") && <Button size="sm" variant="outline" onClick={() => void retry.mutateAsync({ userId, deliveryId: d.id })}>{t("webhooks.retry", "Retry now")}</Button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
