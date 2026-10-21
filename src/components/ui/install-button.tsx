import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";

// Chrome, Edge and Samsung Internet (desktop and Android) fire beforeinstallprompt once, possibly before React
// has mounted, so it is captured at module load and shared with every button.
// iPhones and iPads (every iOS browser) have no such event: installing there is "Share > Add to Home Screen",
// so the button opens a short how-to instead.
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

// iPadOS 13+ reports itself as a Mac, so touch support tells them apart.
const isIos = () =>
  typeof navigator !== "undefined" && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** "Install app": offers PayRus as an app. Renders nothing when the browser cannot install it or it is already installed. */
export default function InstallButton({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (isInstalled() || (!deferred && !isIos())) return null;

  const install = async () => {
    const event = deferred;
    if (!event) { setHelp(true); return; }
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") deferred = null; // the browser only allows one prompt per event
    notify();
  };

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => void install()} className={cn("gap-2 text-sm font-semibold", className)}>
        <Download size={15} aria-hidden="true" />
        {t("install.button")}
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("install.title")}</DialogTitle>
            <DialogDescription>{t("install.intro")}</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
            <li>{t("install.step1")}</li>
            <li>{t("install.step2")}</li>
            <li>{t("install.step3")}</li>
          </ol>
          <Button type="button" onClick={() => setHelp(false)} className="w-full">{t("install.close")}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
