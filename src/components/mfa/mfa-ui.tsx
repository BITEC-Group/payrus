import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  confirmTotpEnrollment, enrollTotp, listVerifiedTotp, registerStepUpHost, removeTotp, requireStepUp, verifyTotpCode, type TotpFactor,
} from "@/lib/mfa.ts";

/** Six-digit code field + submit, shared by sign-in, step-up and enrolment. */
export function MfaCodeForm({ onSubmit, busy, label }: { onSubmit: (code: string) => void; busy?: boolean; label: string }) {
  const [code, setCode] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) onSubmit(code);
      }}
    >
      <Input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="text-center text-lg tracking-[0.5em] font-mono"
        aria-label={label}
      />
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
        {label}
      </Button>
    </form>
  );
}

/** Mounted once (AppLayout). requireStepUp() opens this when a high-risk action needs a fresh code. */
export function MfaStepUpHost() {
  const { t } = useTranslation("common");
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    registerStepUpHost((resolve) => setResolver(() => resolve));
    return () => registerStepUpHost(null);
  }, []);

  const close = (ok: boolean) => {
    resolver?.(ok);
    setResolver(null);
  };

  return (
    <Dialog open={!!resolver} onOpenChange={(open) => { if (!open) close(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck size={18} />{t("mfa.stepUpTitle")}</DialogTitle>
          <DialogDescription>{t("mfa.stepUpDesc")}</DialogDescription>
        </DialogHeader>
        <MfaCodeForm
          label={t("mfa.verify")}
          busy={busy}
          onSubmit={async (code) => {
            setBusy(true);
            const ok = await verifyTotpCode(code);
            setBusy(false);
            if (ok) close(true);
            else toast.error(t("mfa.codeInvalid"));
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Settings → Security: real TOTP enrolment / removal (replaces the old local-state 2FA toggle). */
export function MfaSettingsCard({ recommend }: { recommend?: boolean }) {
  const { t } = useTranslation("common");
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [enrol, setEnrol] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => listVerifiedTotp().then(setFactors).catch(() => setFactors([]));
  useEffect(() => { void refresh(); }, []);

  const start = async () => {
    setBusy(true);
    try {
      setEnrol(await enrollTotp());
    } catch {
      toast.error(t("mfa.enrolFailed"));
    } finally {
      setBusy(false);
    }
  };

  const enabled = (factors?.length ?? 0) > 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        {enabled ? <ShieldCheck className="text-primary mt-0.5" size={20} /> : <ShieldAlert className="text-muted-foreground mt-0.5" size={20} />}
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{t("mfa.title")}</div>
          <div className="text-xs text-muted-foreground">{enabled ? t("mfa.enabledStatus") : t("mfa.notEnabled")}</div>
          {recommend && !enabled && <div className="text-xs text-destructive mt-1">{t("mfa.staffRecommend")}</div>}
        </div>
        {factors !== null && !enrol && (
          enabled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (!(await requireStepUp())) return;
                setBusy(true);
                const ok = (await Promise.all(factors!.map((f) => removeTotp(f.id)))).every(Boolean);
                setBusy(false);
                if (ok) { toast.success(t("mfa.disabledToast")); void refresh(); } else toast.error(t("mfa.enrolFailed"));
              }}
            >
              {t("mfa.disable")}
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={start}>{t("mfa.enable")}</Button>
          )
        )}
      </div>
      {enrol && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="text-xs text-muted-foreground">{t("mfa.scanQr")}</div>
          <img src={enrol.qrCode} alt={t("mfa.mfaui.totpQrCode")} className="mx-auto w-40 h-40 bg-white rounded-lg p-2" />
          <div className="text-[11px] text-center text-muted-foreground break-all">{t("mfa.orEnterSecret")} <span className="font-mono">{enrol.secret}</span></div>
          <MfaCodeForm
            label={t("mfa.verify")}
            busy={busy}
            onSubmit={async (code) => {
              setBusy(true);
              const ok = await confirmTotpEnrollment(enrol.factorId, code);
              setBusy(false);
              if (ok) { toast.success(t("mfa.enabledToast")); setEnrol(null); void refresh(); } else toast.error(t("mfa.codeInvalid"));
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * PRS-IAM-007 / PRS-OPS-001: privileged (admin/staff) screens require a verified
 * authenticator factor AND an AAL2 session. No factor -> enrol first; factor but
 * AAL1 session -> ask for a code. Wraps the /admin route.
 */
export function StaffMfaGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<"checking" | "enrol" | "stepup" | "ok">("checking");
  const check = async () => {
    try {
      if ((await listVerifiedTotp()).length === 0) return setState("enrol");
      setState((await requireStepUp()) ? "ok" : "stepup");
    } catch {
      setState("enrol");
    }
  };
  useEffect(() => { void check(); }, []);
  if (state === "ok") return <>{children}</>;
  if (state === "checking") return null;
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2"><ShieldAlert size={18} />{t("mfa.staffRequiredTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("mfa.staffRequiredDesc")}</p>
      {state === "enrol" ? <MfaSettingsCard /> : null}
      <Button className="w-full" onClick={() => { setState("checking"); void check(); }}>{t("mfa.staffContinue")}</Button>
    </div>
  );
}
