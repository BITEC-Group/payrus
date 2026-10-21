import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QrCode, ScanLine, Keyboard, Share2, Store } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import PageHeader from "@/components/ui/page-header.tsx";

type Tab = "scan" | "mine";

export default function ScanToPay() {
  const { lng } = useParams<{ lng: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const base = `/${lng ?? "en"}`;

  const [tab, setTab] = useState<Tab>("scan");
  const [code, setCode] = useState("");

  const handleManualSubmit = () => {
    if (code.trim().length < 6) {
      toast.error(t("scan.invalidCode"));
      return;
    }
    navigate(`${base}/payments`);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title={t("scan.title")} subtitle={t("scan.subtitle")} className="mb-5" />

      <div className="flex gap-2 mb-5 bg-secondary rounded-xl p-1 max-w-xs">
        <button
          onClick={() => setTab("scan")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer",
            tab === "scan" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground",
          )}
        >
          <ScanLine size={15} /> {t("scan.tabScan")}
        </button>
        <button
          onClick={() => setTab("mine")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer",
            tab === "mine" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground",
          )}
        >
          <QrCode size={15} /> {t("scan.tabMine")}
        </button>
      </div>

      <>
        {tab === "scan" && (
          <motion.div key="scan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5">
            <p className="text-sm text-muted-foreground">{t("scan.intro")}</p>

            <div className="relative aspect-square max-w-sm mx-auto rounded-2xl bg-foreground/95 overflow-hidden">
              {/* Corner brackets */}
              {[
                "top-6 left-6 border-t-2 border-l-2",
                "top-6 right-6 border-t-2 border-r-2",
                "bottom-6 left-6 border-b-2 border-l-2",
                "bottom-6 right-6 border-b-2 border-r-2",
              ].map((pos, i) => (
                <div key={i} className={cn("absolute w-10 h-10 rounded-sm border-primary/80", pos)} />
              ))}
              {/* Animated scan line */}
              <motion.div
                className="absolute left-8 right-8 h-0.5 bg-primary/80 shadow-[0_0_12px_2px] shadow-primary/50"
                animate={{ top: ["18%", "80%", "18%"] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <ScanLine size={32} className="text-background/25" />
              </div>
            </div>

            <button
              onClick={() => navigate(`${base}/pos`)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors text-left cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Store size={19} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground text-sm">{t("scan.payTerminal")}</div>
                <div className="text-xs text-muted-foreground">{t("scan.payTerminalNote")}</div>
              </div>
            </button>

            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                <Keyboard size={14} /> {t("scan.enterManually")}
              </label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder={t("scan.digits")}
                  className="bg-card border-border font-mono"
                />
                <Button onClick={handleManualSubmit} className="shrink-0">{t("scan.go")}</Button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "mine" && (
          <motion.div key="mine" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5">
            <p className="text-sm text-muted-foreground">{t("scan.mineIntro")}</p>
            <div className="flex flex-col items-center p-6 rounded-2xl bg-white border border-border max-w-xs mx-auto">
              <div className="w-44 h-44 grid grid-cols-6 gap-1">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div key={i} className={cn("rounded-sm", i % 3 === 0 || i % 5 === 0 ? "bg-gray-900" : "bg-transparent")} />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3 font-mono">{t("scan.payrusTag8421")}</p>
            </div>
            <Button
              variant="secondary"
              className="w-full h-11 rounded-xl"
              onClick={() => { navigator.clipboard?.writeText("PAYRUS-TAG-8421").catch(() => {}); toast.success(t("scan.copied")); }}
            >
              <Share2 size={15} /> {t("scan.share")}
            </Button>
          </motion.div>
        )}
      </>
    </div>
  );
}
