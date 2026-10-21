import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CreditCard,
  ArrowLeftRight,
  QrCode,
  Smartphone,
  Banknote,
  FileText,
  MoreHorizontal,
  Delete,
  Cpu,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import PageHeader from "@/components/ui/page-header.tsx";
import TransactionReceipt from "@/components/ui/transaction-receipt.tsx";
import { useProfile } from "@/contexts/profile-context.tsx";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useDepositMutation } from "@/hooks/use-backend.ts";

// "card" covers tap/insert/swipe generically — a real terminal never knows in
// advance which interface the customer will use. "insert"/"swipe" are manual
// overrides reachable from the "More" menu, for chip-fail-swipe-fallback style flows.
type Rail = "card" | "insert" | "swipe" | "qr" | "mobile" | "cash" | "bills";
type Stage =
  | "idle"
  | "present"
  | "reading"
  | "pin"
  | "authorizing"
  | "approved"
  | "cancelled";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const PIN_LENGTH = 4;
// Below this amount, a contactless tap skips the PIN (EMV contactless floor limit).
const CONTACTLESS_CVM_LIMIT = 25;
// Matches deposit_to_wallet's own 'mobile' method fee rate (supabase/
// migrations/0006) — a real sale now actually calls that RPC with
// method:'mobile', so this display rate has to agree with what really gets
// charged rather than being an independent, drifting constant.
const ACQUIRING_FEE_RATE = 0.015;
const CARD_RAILS: Rail[] = ["card", "insert", "swipe"];
const INSTANT_RAILS: Rail[] = ["cash", "bills"];

function shuffledDigits() {
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

/** Short buzzer tones, echoing the SDK's Buzzer.beep(times, onTime, offTime, mode). */
function useBeeper() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((times: number) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = ctxRef.current ?? new Ctx();
      ctxRef.current = ctx;
      for (let i = 0; i < times; i++) {
        const start = ctx.currentTime + i * 0.16;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 1800;
        gain.gain.setValueAtTime(0.05, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.1);
      }
    } catch {
      // Audio unavailable (autoplay policy, unsupported env) — beep is a nicety, not required.
    }
  }, []);
}

function LedDot({ stage }: { stage: Stage }) {
  const color =
    stage === "approved"
      ? "bg-emerald-500"
      : stage === "cancelled"
        ? "bg-red-500"
        : stage === "idle"
          ? "bg-muted-foreground/30"
          : "bg-blue-500 animate-pulse";
  return <span className={cn("inline-block size-2.5 rounded-full", color)} />;
}

export default function PointOfSale() {
  const { t } = useTranslation("common");
  const { profile } = useProfile();
  const beep = useBeeper();
  const currentUser = useCurrentAppUser();
  const depositToWallet = useDepositMutation();

  const [amount, setAmount] = useState("0");
  const [rail, setRail] = useState<Rail>("card");
  const [stage, setStage] = useState<Stage>("idle");
  const [pin, setPin] = useState("");
  const [pinKeys, setPinKeys] = useState<string[]>(() => shuffledDigits());
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [txReference, setTxReference] = useState(
    () => `POS-${Date.now().toString().slice(-10)}`,
  );

  const numeric = parseFloat(amount) || 0;
  const net = numeric * (1 - ACQUIRING_FEE_RATE);
  const currency = profile?.currency ?? "XAF";
  const isCardRail = CARD_RAILS.includes(rail);
  const isManualCardOverride = rail === "insert" || rail === "swipe";

  const methodLabel: Record<Rail, string> = {
    card: t("pos.cardMethod"),
    insert: t("pos.insertCard"),
    swipe: t("pos.swipeCard"),
    qr: t("pos.showQr"),
    mobile: t("pos.mobileMoney"),
    cash: t("pos.cash"),
    bills: t("pos.billPayment"),
  };

  // Deck-aligned 2x3 method grid: Card, QR Code, Mobile Money / Cash, Bill Payment, More.
  const tiles: { id: Rail; icon: typeof CreditCard; label: string }[] = [
    { id: "card", icon: CreditCard, label: methodLabel.card },
    { id: "qr", icon: QrCode, label: methodLabel.qr },
    { id: "mobile", icon: Smartphone, label: methodLabel.mobile },
    { id: "cash", icon: Banknote, label: methodLabel.cash },
    { id: "bills", icon: FileText, label: methodLabel.bills },
  ];

  const presentPrompt: Record<Rail, string> = {
    card: t("pos.presentCard"),
    insert: t("pos.presentInsert"),
    swipe: t("pos.presentSwipe"),
    qr: t("pos.presentQr"),
    mobile: t("pos.presentMobile"),
    cash: t("pos.recordingCash"),
    bills: t("pos.recordingBill"),
  };

  // Terminal transaction pipeline: present card -> read -> (PIN if required) -> authorize -> result.
  useEffect(() => {
    if (stage === "present") {
      const delay = setTimeout(
        () => setStage(isCardRail ? "reading" : "authorizing"),
        1100,
      );
      return () => clearTimeout(delay);
    }
    if (stage === "reading") {
      const delay = setTimeout(() => {
        const needsPin =
          rail === "insert" ||
          rail === "swipe" ||
          (rail === "card" && numeric > CONTACTLESS_CVM_LIMIT);
        if (needsPin) {
          setPinKeys(shuffledDigits());
          setPin("");
          setStage("pin");
        } else {
          setStage("authorizing");
        }
      }, 700);
      return () => clearTimeout(delay);
    }
    if (stage === "authorizing") {
      const delay = setTimeout(() => {
        void (async () => {
          // A POS sale credits the merchant (money coming in), so it
          // reuses deposit_to_wallet directly rather than a debit RPC —
          // same shape (amount, currency, a fee-bearing method, a note)
          // this flow already needs. Anonymous/no-account preview stays
          // exactly as before (receipt only, nothing persisted).
          if (currentUser && numeric > 0) {
            try {
              await depositToWallet({ userId: currentUser.id, amount: numeric, currency, method: "mobile", note: "POS sale" });
            } catch {
              beep(3);
              setStage("cancelled");
              return;
            }
          }
          beep(1);
          setStage("approved");
        })();
      }, 900);
      return () => clearTimeout(delay);
    }
  }, [stage, rail, isCardRail, numeric, beep, currentUser, currency, depositToWallet]);

  const press = (key: string) => {
    if (key === "back") {
      setAmount((a) => (a.length > 1 ? a.slice(0, -1) : "0"));
      return;
    }
    if (key === "." && amount.includes(".")) return;
    setAmount((a) => (a === "0" && key !== "." ? key : a + key));
  };

  const pressPin = (digit: string) => {
    setPin((p) => {
      const next = (p + digit).slice(0, PIN_LENGTH);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => setStage("authorizing"), 250);
      }
      return next;
    });
  };

  const cancelPin = () => {
    beep(3);
    setStage("cancelled");
  };

  const selectOverride = (r: "insert" | "swipe") => {
    setRail(r);
    setMoreOpen(false);
  };

  const handleCharge = () => {
    if (numeric <= 0) return;
    setStage(INSTANT_RAILS.includes(rail) ? "authorizing" : "present");
  };

  const reset = () => {
    setAmount("0");
    setPin("");
    setStage("idle");
    setTxReference(`POS-${Date.now().toString().slice(-10)}`);
  };

  const diagnostics = [
    { label: t("pos.device.icReader"), key: "ic" },
    { label: t("pos.device.magReader"), key: "mag" },
    { label: t("pos.device.nfcReader"), key: "nfc" },
    { label: t("pos.device.psam"), key: "psam" },
    { label: t("pos.device.printer"), key: "printer" },
    { label: t("pos.device.battery"), key: "battery" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-md mx-auto">
      <PageHeader
        title={t("pos.title")}
        subtitle={profile?.name ?? t("pos.subtitle")}
        className="mb-5"
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeviceOpen(true)}
            aria-label={t("pos.device.title")}
          >
            <Cpu size={18} />
          </Button>
        }
      />

      {stage === "idle" && (
        <>
          <div className="text-center py-6">
            <div className="text-4xl font-bold font-mono text-foreground tracking-tight">
              {numeric.toLocaleString()}{" "}
              <span className="text-xl text-muted-foreground">
                {currency}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("pos.net")}{" "}
              <span className="font-semibold text-foreground">
                {net.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
                {currency}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-6">
            {KEYS.map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                className="h-14 rounded-xl bg-card border border-border text-lg font-semibold text-foreground hover:bg-secondary active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                {k === "back" ? <Delete size={18} /> : k}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {tiles.map((tile) => (
              <button
                key={tile.id}
                onClick={() => setRail(tile.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer",
                  rail === tile.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                <tile.icon size={18} />
                {tile.label}
              </button>
            ))}

            <Popover open={moreOpen} onOpenChange={setMoreOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer w-full",
                    isManualCardOverride
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <MoreHorizontal size={18} />
                  {isManualCardOverride ? methodLabel[rail] : t("pos.more")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1.5" align="end">
                <button
                  onClick={() => selectOverride("insert")}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer",
                    rail === "insert" ? "bg-primary/5 text-primary" : "hover:bg-secondary text-foreground",
                  )}
                >
                  <CreditCard size={16} />
                  {t("pos.insertCard")}
                </button>
                <button
                  onClick={() => selectOverride("swipe")}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer",
                    rail === "swipe" ? "bg-primary/5 text-primary" : "hover:bg-secondary text-foreground",
                  )}
                >
                  <ArrowLeftRight size={16} />
                  {t("pos.swipeCard")}
                </button>
              </PopoverContent>
            </Popover>
          </div>

          <Button
            onClick={handleCharge}
            disabled={numeric <= 0}
            className="w-full h-12 text-base font-semibold rounded-xl"
          >
            {t("pos.confirmPayment")}
          </Button>
        </>
      )}

      {(stage === "present" ||
        stage === "reading" ||
        stage === "authorizing") && (
        <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
          <div className="relative flex items-center justify-center size-20 rounded-full bg-primary/10">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <LedDot stage={stage} />
            <p className="text-sm font-medium text-foreground">
              {stage === "present" && presentPrompt[rail]}
              {stage === "reading" && t("pos.reading")}
              {stage === "authorizing" &&
                (rail === "cash"
                  ? t("pos.recordingCash")
                  : rail === "bills"
                    ? t("pos.recordingBill")
                    : t("pos.authorizing"))}
            </p>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">
            {numeric.toLocaleString()} {currency}
          </p>
        </div>
      )}

      {stage === "pin" && (
        <div className="flex flex-col items-center py-6 gap-6">
          <div className="flex items-center gap-2">
            <LedDot stage={stage} />
            <p className="text-sm font-medium text-foreground">
              {t("pos.enterPin")}
            </p>
          </div>
          <div className="flex gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-3.5 rounded-full border-2 border-primary",
                  i < pin.length ? "bg-primary" : "bg-transparent",
                )}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 max-w-xs w-full">
            {pinKeys.map((k) => (
              <button
                key={k}
                onClick={() => pressPin(k)}
                className="h-14 rounded-xl bg-card border border-border text-lg font-semibold text-foreground hover:bg-secondary active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                {k}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={cancelPin} className="w-full max-w-xs">
            {t("pos.pinCancel")}
          </Button>
        </div>
      )}

      {stage === "cancelled" && (
        <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
          <XCircle size={40} className="text-red-500" />
          <p className="text-sm font-medium text-foreground">
            {t("pos.cancelled")}
          </p>
          <Button onClick={reset} className="w-full max-w-xs h-11 rounded-xl">
            {t("pos.tryAgain")}
          </Button>
        </div>
      )}

      {stage === "approved" && (
        <TransactionReceipt
          type="pos"
          amount={numeric.toLocaleString()}
          currency={currency}
          method={methodLabel[rail]}
          fee={`${(numeric * ACQUIRING_FEE_RATE).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`}
          reference={txReference}
          date={new Date().toLocaleString()}
          onClose={reset}
          onNewTransaction={reset}
        />
      )}

      <Dialog open={deviceOpen} onOpenChange={setDeviceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pos.device.title")}</DialogTitle>
            <DialogDescription>{t("pos.device.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">
                {t("pos.device.model")}
              </span>
              <span className="font-medium text-foreground">
                {t("pos.feitianF20Smartpos")}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">
                {t("pos.device.serial")}
              </span>
              <span className="font-mono text-xs font-medium text-foreground">{t("pos.ft88231", { v: profile?.type?.slice(0, 4).toUpperCase() ?? "0000" })}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">
                {t("pos.device.firmware")}
              </span>
              <span className="font-mono text-xs font-medium text-foreground">
                1.00.07.00
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 mb-2">
              <span className="text-muted-foreground">
                {t("pos.device.sdk")}
              </span>
              <span className="font-mono text-xs font-medium text-foreground">
                {t("pos.ftsdk100")}
              </span>
            </div>
            {diagnostics.map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between py-1.5 border-t border-border first:border-t-0"
              >
                <span className="text-muted-foreground">{d.label}</span>
                <Badge
                  variant="outline"
                  className="text-emerald-600 border-emerald-200 gap-1"
                >
                  <CheckCircle2 size={12} />
                  {t("pos.device.ok")}
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
