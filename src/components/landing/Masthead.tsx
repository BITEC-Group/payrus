import { useTranslation } from "react-i18next";
import logo from "@/assets/payrus-logo.png";
import { Button } from "@/components/ui/button";
import {
  navLinks,
  ctaLabel,
  dateline,
  edition,
  publisher,
} from "@/data/payrus-landing-content";

export function Masthead() {
  const { t } = useTranslation("common");
  return (
    <div className="mx-auto max-w-[1180px] px-6 pt-6">
      <div className="flex flex-wrap items-center gap-4">
        <a
          href="#top"
          role="img"
          aria-label={t("landing.Masthead.payrus")}
          className="w-[96px] h-[28px] shrink-0 mix-blend-multiply bg-no-repeat"
          style={{
            backgroundImage: `url(${logo})`,
            backgroundSize: "200px auto",
            backgroundPosition: "-58px -62px",
          }}
        />
        <span className="flex-1" />
        {navLinks.map((n) => (
          <a key={n.href} href={n.href} className="text-[15px]">
            {n.label}
          </a>
        ))}
        <Button asChild>
          <a href="#signin">{ctaLabel}</a>
        </Button>
      </div>

      <div className="mt-4 h-[5px] bg-foreground" />
      <div className="flex flex-wrap items-baseline justify-between gap-4 py-2 text-[13px] tracking-[0.14em] text-pr-neutral-700 uppercase">
        <span>{dateline}</span>
        <span>{edition}</span>
        <span>{publisher}</span>
      </div>
      <div className="mt-[3px] h-px bg-foreground" />
    </div>
  );
}
