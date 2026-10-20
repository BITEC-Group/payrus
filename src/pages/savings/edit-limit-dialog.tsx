import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { useSetLoyaltySpendLimitMutation } from "@/hooks/use-backend.ts";

interface Props {
  userId: string | undefined;
  /** The database id of a real linked venue; absent for the demo pots shown to signed-out visitors. */
  accountId: string | undefined;
  venueName: string;
  currency: string;
  current: number;
  onClose: () => void;
}

export default function EditLimitDialog({ userId, accountId, venueName, currency, current, onClose }: Props) {
  const { t } = useTranslation("common");
  const save = useSetLoyaltySpendLimitMutation();
  const [limit, setLimit] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const n = Number(limit);
  const valid = limit.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 10_000_000;
  const canSave = !!userId && !!accountId;

  async function submit() {
    if (!userId || !accountId || !valid) return;
    setBusy(true);
    try {
      await save({ userId, accountId, spendLimit: n });
      toast.success(t("savings.editLimit.saved"));
      onClose();
    } catch {
      toast.error(t("savings.editLimit.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden gap-0" data-testid="edit-limit">
        <DialogHeader className="px-6 pt-6 pb-3 text-left">
          <DialogTitle className="text-sm font-bold">{t("savings.editLimit.title")}</DialogTitle>
          <DialogDescription className="text-[11px]">{venueName}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">{t("savings.editLimit.label", { currency })}</span>
            <input id="venue-limit" type="number" min={0} max={10000000} step="100" value={limit} onChange={(e) => setLimit(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm font-mono" />
          </label>
          {!valid && <p className="text-xs text-destructive" role="alert">{t("savings.editLimit.range")}</p>}
          {!canSave && <p className="text-[11px] text-muted-foreground">{t("savings.editLimit.demo")}</p>}
          <button type="button" disabled={!canSave || !valid || busy} onClick={() => void submit()}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy ? t("signin.checking") : t("savings.editLimit.save")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
