import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  User, Store, Smartphone, Building2, Landmark, Heart, Users, Sparkles,
  ChevronDown, CheckCircle2, Plus, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useProfile, type ProfileType, getDefaultProfile } from "@/contexts/profile-context.tsx";
import { clearLocalUserId } from "@/lib/local-user.ts";

interface ProfileTypeInfo {
  id: ProfileType;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bgColor: string;
}

const TYPE_INFO: ProfileTypeInfo[] = [
  { id: "personal",            icon: User,       color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-500/15" },
  { id: "merchant",            icon: Store,       color: "text-blue-600 dark:text-blue-400",    bgColor: "bg-blue-100 dark:bg-blue-500/15" },
  { id: "agent",               icon: Smartphone,  color: "text-orange-600 dark:text-orange-400",  bgColor: "bg-orange-100 dark:bg-orange-500/15" },
  { id: "treasury",            icon: Building2,   color: "text-violet-600 dark:text-violet-400",  bgColor: "bg-violet-100 dark:bg-violet-500/15" },
  { id: "public_institution",  icon: Landmark,    color: "text-amber-600 dark:text-amber-400",   bgColor: "bg-amber-100 dark:bg-amber-500/15" },
  { id: "ngo",                 icon: Heart,       color: "text-rose-600 dark:text-rose-400",    bgColor: "bg-rose-100 dark:bg-rose-500/15" },
  { id: "group",               icon: Users,       color: "text-lime-600 dark:text-lime-400",    bgColor: "bg-lime-100 dark:bg-lime-500/15" },
  { id: "starter",             icon: Sparkles,    color: "text-cyan-600 dark:text-cyan-400",    bgColor: "bg-cyan-100 dark:bg-cyan-500/15" },
];

const SWITCHER_GROUPS = [
  { label: "profileSwitcher.groupRoles", ids: ["personal","merchant","agent","treasury","public_institution","ngo","group","starter"] as ProfileType[] },
];

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function ProfileSwitcher() {
  const { lng } = useParams<{ lng: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { profile, setProfile, clearProfile } = useProfile();
  const [open, setOpen] = useState(false);
  const base = `/${lng ?? "en"}`;

  const currentTypeInfo = TYPE_INFO.find(tItem => tItem.id === profile?.type);
  const CurrentIcon = currentTypeInfo?.icon ?? User;

  const handleSwitch = (type: ProfileType) => {
    setProfile(getDefaultProfile(type));
    setOpen(false);
  };

  const handleAddNew = () => {
    setOpen(false);
    navigate(`${base}/profile`);
  };

  const handleLogout = () => {
    clearProfile();
    clearLocalUserId();
    navigate(`${base}/profile`);
  };

  if (!profile) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-xs font-bold">
          {getInitials(profile.name)}
        </div>
        {/* Name & type */}
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold text-foreground truncate">{profile.name}</div>
          <div className={cn("text-[10px] truncate font-medium flex items-center gap-1", currentTypeInfo?.color ?? "text-primary")}>
            <CurrentIcon size={9} />
            {t(`profile.type.${profile.type}`)} · {profile.tier}
          </div>
        </div>
        <ChevronDown size={14} className={cn("text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("profile.switchAccount")}</div>
              </div>

              {/* Profile list - grouped */}
              <div className="py-1.5 max-h-80 overflow-y-auto">
                {SWITCHER_GROUPS.map(group => {
                  const groupProfiles = TYPE_INFO.filter(tItem => group.ids.includes(tItem.id));
                  return (
                    <div key={group.label}>
                      <div className="px-4 pt-2 pb-1">
                        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">{t(group.label)}</span>
                      </div>
                      {groupProfiles.map((info) => {
                        const isActiveProfile = profile.type === info.id;
                        const Icon = info.icon;
                        return (
                          <button
                            key={info.id}
                            onClick={() => handleSwitch(info.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-secondary transition-colors cursor-pointer",
                              isActiveProfile && "bg-primary/5"
                            )}
                          >
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", info.bgColor)}>
                              <Icon size={14} className={info.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground">{t(`profile.type.${info.id}`)}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{t(`profile.desc.${info.id}`)}</div>
                            </div>
                            {isActiveProfile && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Footer actions */}
              <div className="border-t border-border py-1.5">
                <button onClick={handleAddNew} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-lg border-2 border-dashed border-border flex items-center justify-center shrink-0">
                    <Plus size={13} className="text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">{t("profile.createNew")}</span>
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                    <LogOut size={13} className="text-destructive" />
                  </div>
                  <span className="text-sm text-destructive">{t("profile.logout")}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
