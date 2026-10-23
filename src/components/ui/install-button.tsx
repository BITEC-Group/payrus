import { useEffect, useState } from "react";
import { Copy, Download, Share } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { copyLink, detectInstallPlatform, shareOrCopyLink, type InstallPlatform } from "@/lib/install-platform.ts";
import { cn } from "@/lib/utils.ts";

// Chrome, Edge and Samsung Internet (desktop and Android) fire beforeinstallprompt once, possibly before React
// has mounted, so it is captured at module load and shared with every button.
// Safari (iPhone, iPad and Mac) has no such event: installing there goes through its own menus, so the button opens
// a how-to whose main button starts the part a website can start (the system Share sheet, or copying the link).
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const isInstalled = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const STEPS: Record<Exclude<InstallPlatform, "none">, { title: string; intro: string; steps: string[] }> = {
  ios: { title: "install.title", intro: "install.intro", steps: ["install.step1", "install.step2", "install.step3"] },
  "ios-inapp": { title: "install.title", intro: "install.inappNote", steps: ["install.step1", "install.step2", "install.step3"] },
  "mac-safari": { title: "install.titleDock", intro: "install.introDock", steps: ["install.dock1", "install.dock2", "install.dock3"] },
};

/** "Install app": offers PayRus as an app. Renders nothing when the browser cannot install it or it is already installed. */
export default function InstallButton({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const platform = detectInstallPlatform();
  if (isInstalled() || (!deferred && platform === "none")) return null;

  const install = async () => {
    const event = deferred;
    if (!event) { setHelp(true); return; }
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") deferred = null; // the browser only allows one prompt per event
    notify();
  };

  // The main button of the how-to. iPhone/iPad: the Share sheet lists "Add to Home Screen" (and "Open in Safari" from
  // in-app browsers). Mac: nothing can open the File menu, so the link is copied for sharing or reopening in Safari.
  const canShare = platform !== "mac-safari" && typeof navigator.share === "function";
  const act = async () => {
    setBusy(true);
    const url = window.location.href.split("#")[0];
    const result = canShare ? await shareOrCopyLink({ title: "PayRus", text: t("install.shareText"), url }) : await copyLink(url);
    setBusy(false);
    if (result === "shared") setHelp(false);
    else if (result === "copied") toast.success(t("install.copied"));
    else if (result === "failed") toast.error(t("install.shareFailed"));
  };

  const copy = platform !== "none" ? STEPS[platform] : STEPS.ios;
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => void install()} className={cn("gap-2 text-sm font-semibold", className)}>
        <Download size={15} aria-hidden="true" />
        {t("install.button")}
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t(copy.title)}</DialogTitle>
            <DialogDescription>{t(copy.intro)}</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
            {copy.steps.map((s) => <li key={s}>{t(s)}</li>)}
          </ol>
          <Button type="button" onClick={() => void act()} disabled={busy} className="w-full gap-2">
            {canShare ? <Share size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {canShare ? t("install.share") : t("install.copy")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setHelp(false)} className="w-full">{t("install.close")}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
