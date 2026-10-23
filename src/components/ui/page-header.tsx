import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import { useTranslation } from "react-i18next";

type PageHeaderProps = {
  title?: string;
  subtitle?: string;
  /** Show back button. Defaults to true */
  showBack?: boolean;
  /** Custom back action. Defaults to navigate(-1) */
  onBack?: () => void;
  /** Right-side actions slot */
  actions?: React.ReactNode;
  /** Extra className on wrapper */
  className?: string;
  children?: React.ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  actions,
  className,
  children,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showBack && (
        <button
          onClick={handleBack}
          aria-label={t("common.back", { defaultValue: "Back" })}
          className="w-11 h-11 md:w-9 md:h-9 rounded-lg bg-secondary border border-border flex items-center justify-center hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={16} className="text-muted-foreground" />
        </button>
      )}
      {(title || subtitle) && (
        <div className="flex-1 min-w-0">
          {title && <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{title}</h1>}
          {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
        </div>
      )}
      {children && !title && <div className="flex-1 min-w-0">{children}</div>}
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
