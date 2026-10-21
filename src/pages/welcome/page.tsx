import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import LocaleSwitcher from "@/components/ui/locale-switcher.tsx";

/* Icons traced from the PayRus onboarding mockup (Onboarding.dc.html) */
type IconProps = { size?: number };
const iconBase = { viewBox: "0 0 24 24", fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const IconWallet = ({ size = 18 }: IconProps) => (
  <svg {...iconBase} width={size} height={size}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" />
    <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
  </svg>
);
const IconCard = ({ size = 18 }: IconProps) => (
  <svg {...iconBase} width={size} height={size}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
    <path d="M2.5 10h19" />
  </svg>
);
const IconMobile = ({ size = 18 }: IconProps) => (
  <svg {...iconBase} width={size} height={size}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
    <path d="M11 18h2" />
  </svg>
);

const FEATURES = [
  { icon: IconWallet, key: "welcome.feature.walletsRow", bg: "#EAF3EC", fg: "#78B72E" },
  { icon: IconCard, key: "welcome.feature.cardRow", bg: "#EDEBF7", fg: "#0A2F5C" },
  { icon: IconMobile, key: "welcome.feature.mobileRow", bg: "#FFF0E9", fg: "#E9762E" },
] as const;

export default function Welcome() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { lng = "en" } = useParams<{ lng?: string }>();
  const base = `/${lng}`;

  // "Get started" creates a brand-new database-only account (registration
  // screen collects the details + password); "I already have an account"
  // goes to the username/email/phone + password login screen. PayRus SSO is
  // offered as a secondary option on both.
  const handleSignUp = () => navigate(`${base}/register`);
  const handleSignIn = () => navigate(`${base}/signin`);

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={{
        backgroundColor: "#F7FAF8",
        backgroundImage: "radial-gradient(rgba(10,47,92,0.06) 1px, transparent 1.2px)",
        backgroundSize: "16px 16px",
      }}
    >
      <svg viewBox="0 0 390 300" className="absolute pointer-events-none" style={{ top: -60, left: -80, opacity: 0.5, width: 280 }}>
        <circle cx="140" cy="140" r="140" fill="#78B72E" opacity="0.16" />
      </svg>
      <svg viewBox="0 0 390 300" className="absolute pointer-events-none" style={{ bottom: 120, right: -90, opacity: 0.6, width: 300 }}>
        <circle cx="140" cy="140" r="140" fill="#0E7FB0" opacity="0.13" />
      </svg>

      <div className="relative z-10 flex justify-end px-6 pt-5">
        <LocaleSwitcher />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-7 px-8 py-6 max-w-md mx-auto w-full text-center">
        <div
          className="relative flex items-center justify-center rounded-[32px] px-8 py-5"
          style={{
            background: "radial-gradient(ellipse at 50% 40%, rgba(120,183,46,0.10) 0%, rgba(14,127,176,0.07) 55%, transparent 78%)",
          }}
        >
          <img src={`${import.meta.env.BASE_URL}payrus-logo-lockup.png`} alt={t("landing.Masthead.payrus")} className="w-[220px] md:w-60 h-auto drop-shadow-[0_10px_22px_rgba(10,47,92,0.14)]" />
        </div>

        <div className="flex flex-col gap-2.5">
          <h1 className="text-[22px] leading-tight text-[#0A2F5C]" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800 }}>
            {t("welcome.headline")}
          </h1>
          <p className="text-[13.5px] leading-relaxed text-[#66798F]">
            {t("welcome.subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-3.5 w-full mt-1.5">
          {FEATURES.map(({ icon: Icon, key, bg, fg }) => (
            <div key={key} className="flex items-center gap-3 text-left">
              <div
                className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0"
                style={{ background: bg, color: fg }}
              >
                <Icon size={18} />
              </div>
              <span className="text-[13px] font-semibold text-[#0B2A4A]">{t(key)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-3 px-6 pb-10 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={handleSignUp}
          className="rounded-2xl text-white font-bold text-[15px] text-center py-4 shadow-[0_10px_26px_rgba(10,42,74,0.14)] cursor-pointer"
          style={{
            background: "linear-gradient(90deg,#78B72E 0%,#17927E 55%,#0E7FB0 100%)",
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {t("onboarding.getStarted")}
        </button>
        <button
          type="button"
          onClick={handleSignIn}
          className="text-[13px] font-semibold text-[#66798F] hover:text-[#0A2F5C] text-center py-1 transition-colors cursor-pointer"
        >
          {t("welcome.haveAccount")}
        </button>
      </div>
    </div>
  );
}
