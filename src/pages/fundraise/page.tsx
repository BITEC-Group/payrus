import { Trans, useTranslation } from "react-i18next";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "@/components/ui/page-header.tsx";
import {
  Heart, Plus, Search, TrendingUp, Leaf, BookOpen, Stethoscope,
  Briefcase, Star, Share2, Users, Clock, CheckCircle, ChevronRight,
  X, Camera, Calendar, Target, ArrowLeft, BadgeCheck, Flame, MapPin,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { useCurrentAppUser } from "@/hooks/use-current-app-user.ts";
import { useCampaigns, useCreateCampaignMutation, useDonateToCampaignMutation } from "@/hooks/use-backend.ts";
import type { AppCampaign } from "@/lib/backend.ts";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Category = "all" | "agriculture" | "education" | "health" | "business";
type TabKey = "browse" | "mycampaigns" | "create";

interface Campaign {
  id: number | string;
  title: string;
  story: string;
  creator: string;
  creatorVerified: boolean;
  category: Category;
  goal: number;
  raised: number;
  donors: number;
  daysLeft: number;
  currency: string;
  location: string;
  featured?: boolean;
  trending?: boolean;
  photo: string; // emoji stand-in for photo
  photoColor: string;
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const CAMPAIGNS: Campaign[] = [
  {
    id: 1,
    title: "Kinshasa Urban Farm Network",
    story: "We're building 12 micro-farms across Kinshasa communes to provide fresh produce to 3,000+ families while training 200 young farmers in sustainable agri-tech practices.",
    creator: "COOPAGRI-KIN", creatorVerified: true,
    category: "agriculture", goal: 8000000, raised: 5420000, donors: 312, daysLeft: 14,
    currency: "CDF", location: "Kinshasa, DRC", featured: true,
    photo: "🌱", photoColor: "from-emerald-900/60 to-emerald-700/30",
  },
  {
    id: 2,
    title: "Digital School for Rural Cameroon",
    story: "Equipping 6 rural primary schools in Adamawa region with solar-powered tablets, offline learning apps, and trained teachers. 1,800 children will benefit.",
    creator: "EduCameroun NGO", creatorVerified: true,
    category: "education", goal: 4500000, raised: 4100000, donors: 891, daysLeft: 4,
    currency: "XAF", location: "Adamawa, Cameroon", trending: true,
    photo: "📚", photoColor: "from-blue-900/60 to-blue-700/30",
  },
  {
    id: 3,
    title: "Mobile Maternity Clinic — Sahel",
    story: "A solar-powered vehicle providing prenatal care, safe delivery kits, and postnatal follow-up to 1,200 women in 18 villages with no clinic access in northern Senegal.",
    creator: "Santé Sahel", creatorVerified: true,
    category: "health", goal: 12000000, raised: 7800000, donors: 1543, daysLeft: 21,
    currency: "XOF", location: "Saint-Louis, Senegal", featured: true,
    photo: "🏥", photoColor: "from-rose-900/60 to-rose-700/30",
  },
  {
    id: 4,
    title: "Women's Batik Cooperative — Abidjan",
    story: "30 women artisans need working capital to produce and export traditional Ivoirian batik fabrics to European markets. Revenue will be split equally among cooperative members.",
    creator: "Tisseuses d'Abidjan", creatorVerified: false,
    category: "business", goal: 2500000, raised: 980000, donors: 74, daysLeft: 30,
    currency: "XOF", location: "Abidjan, Côte d'Ivoire",
    photo: "🧵", photoColor: "from-amber-900/60 to-amber-700/30",
  },
  {
    id: 5,
    title: "Cassava Processing Mill — Bandundu",
    story: "A shared cassava processing mill for 120 smallholder families to convert raw cassava into flour and chips, tripling their income and reducing post-harvest losses by 60%.",
    creator: "Bandundu Farmers Union", creatorVerified: true,
    category: "agriculture", goal: 6000000, raised: 1850000, donors: 156, daysLeft: 45,
    currency: "CDF", location: "Bandundu, DRC",
    photo: "🌾", photoColor: "from-yellow-900/60 to-yellow-700/30",
  },
  {
    id: 6,
    title: "Scholarship Fund for STEM Girls",
    story: "Full secondary school scholarships for 50 girls from low-income families in Lagos, covering tuition, books, and mentorship in STEM over 3 years.",
    creator: "GirlCode Nigeria", creatorVerified: true,
    category: "education", goal: 9000000, raised: 3200000, donors: 427, daysLeft: 60,
    currency: "NGN", location: "Lagos, Nigeria", trending: true,
    photo: "👩‍💻", photoColor: "from-violet-900/60 to-violet-700/30",
  },
  {
    id: 7,
    title: "Community Eye Clinic — Nairobi",
    story: "Free cataract surgery and glasses for 500 elderly patients in Kibera. Each surgery costs KES 18,000 and restores sight permanently.",
    creator: "Maono Eye Foundation", creatorVerified: false,
    category: "health", goal: 9000000, raised: 5670000, donors: 832, daysLeft: 18,
    currency: "KES", location: "Nairobi, Kenya",
    photo: "👁️", photoColor: "from-cyan-900/60 to-cyan-700/30",
  },
  {
    id: 8,
    title: "Solar Kiosk Network — Dakar",
    story: "20 solar-powered kiosks selling affordable phone charging, cold drinks, and basic medicines in off-grid Dakar suburbs. Each kiosk will employ one young entrepreneur.",
    creator: "Solaire Sénégal SARL", creatorVerified: false,
    category: "business", goal: 3500000, raised: 2100000, donors: 211, daysLeft: 28,
    currency: "XOF", location: "Dakar, Senegal",
    photo: "☀️", photoColor: "from-orange-900/60 to-orange-700/30",
  },
];

const CATEGORIES: { key: Category; label: string; icon: React.ElementType; color: string }[] = [
  { key: "all", label: "All", icon: TrendingUp, color: "text-foreground" },
  { key: "agriculture", label: "Agriculture", icon: Leaf, color: "text-emerald-700" },
  { key: "education", label: "Education", icon: BookOpen, color: "text-blue-700" },
  { key: "health", label: "Health", icon: Stethoscope, color: "text-rose-700" },
  { key: "business", label: "Business", icon: Briefcase, color: "text-amber-700" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function pct(raised: number, goal: number) {
  return Math.min(100, Math.round((raised / goal) * 100));
}

function fmt(n: number, currency: string) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ${currency}`;
  return `${n.toLocaleString()} ${currency}`;
}

const CATEGORY_PHOTO: Record<string, { emoji: string; color: string }> = {
  agriculture: { emoji: "🌱", color: "from-emerald-900/60 to-emerald-700/30" },
  education: { emoji: "📚", color: "from-blue-900/60 to-blue-700/30" },
  health: { emoji: "🏥", color: "from-rose-900/60 to-rose-700/30" },
  business: { emoji: "💼", color: "from-amber-900/60 to-amber-700/30" },
};

// Real campaigns (supabase/migrations/0018) don't track a donor count or a
// creator display name yet — mapped into the same Campaign shape the
// existing mock UI already renders so no JSX below needs to branch on
// real-vs-mock, only the data source does.
function toDisplayCampaign(c: AppCampaign): Campaign {
  const daysLeft = c.deadline ? Math.max(0, Math.ceil((new Date(c.deadline).getTime() - Date.now()) / 86400000)) : 30;
  const photo = CATEGORY_PHOTO[c.category] ?? { emoji: "❤️", color: "from-primary/60 to-primary/30" };
  return {
    id: c.id, title: c.title, story: c.story, creator: "PayRus member", creatorVerified: false,
    category: (["agriculture", "education", "health", "business"].includes(c.category) ? c.category : "business") as Category,
    goal: c.goal, raised: c.raised, donors: 0, daysLeft, currency: c.currency, location: "",
    photo: photo.emoji, photoColor: photo.color,
  };
}

// ─── CAMPAIGN CARD ─────────────────────────────────────────────────────────

function CampaignCard({ campaign, onSelect, onDonate }: {
  campaign: Campaign;
  onSelect: (c: Campaign) => void;
  onDonate: (c: Campaign) => void;
}) {
  const { t } = useTranslation("common");
  const progress = pct(campaign.raised, campaign.goal);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col cursor-pointer group"
      onClick={() => onSelect(campaign)}
    >
      {/* Photo area */}
      <div className={cn("relative h-28 bg-gradient-to-br flex items-center justify-center text-5xl", campaign.photoColor)}>
        <span>{campaign.photo}</span>
        <div className="absolute top-2 left-2 flex gap-1">
          {campaign.featured && (
            <span className="flex items-center gap-0.5 text-[9px] font-black bg-amber-400/20 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-full">
              <Star size={9} /> {t("fundraise.featured")}
            </span>
          )}
          {campaign.trending && (
            <span className="flex items-center gap-0.5 text-[9px] font-black bg-rose-400/20 border border-rose-400/40 text-rose-300 px-2 py-0.5 rounded-full">
              <Flame size={9} /> {t("fundraise.trending")}
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2 text-[9px] font-black bg-black/40 backdrop-blur-sm border border-white/10 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
          {campaign.category}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="flex items-start gap-1.5">
          <h3 className="font-bold text-sm leading-snug flex-1">{t(campaign.title)}</h3>
          {campaign.creatorVerified && <BadgeCheck size={14} className="text-primary shrink-0 mt-0.5" />}
        </div>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin size={10} />
          {campaign.location}
          <span className="ml-auto font-medium text-foreground">{campaign.creator}</span>
        </div>

        {/* Progress */}
        <div className="space-y-1 mt-auto pt-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-primary font-bold font-mono">{fmt(campaign.raised, campaign.currency)}</span>
            <span className="text-muted-foreground">{t("fundraise.of")} {fmt(campaign.goal, campaign.currency)}</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" as const }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Users size={9} />{campaign.donors.toLocaleString()} {t("fundraise.donors")}</span>
            <span className="flex items-center gap-1"><Clock size={9} />{campaign.daysLeft}{t("fundraise.dLeft")}</span>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full mt-1 text-xs font-bold"
          onClick={(e) => { e.stopPropagation(); onDonate(campaign); }}
        >
          <Heart size={12} className="mr-1" /> {t("fundraise.donateNow")}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── DONATE MODAL ─────────────────────────────────────────────────────────

function DonateModal({ campaign, currentUserId, onDonate, onClose }: {
  campaign: Campaign; currentUserId: string | undefined; onDonate: (args: { userId: string; campaignId: string; amount: number; note?: string }) => Promise<unknown>; onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [amount, setAmount] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [done, setDone] = useState(false);
  const [donating, setDonating] = useState(false);
  const presets = [500, 2000, 5000, 10000, 25000];

  async function handleDonate() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error(t("wallet.enterValidAmount"));
      return;
    }
    if (!currentUserId || typeof campaign.id !== "string") {
      // Anonymous preview, or a demo (non-real) campaign — keep the
      // existing mock success path unchanged.
      setDone(true);
      toast.success(`Donation of ${Number(amount).toLocaleString()} ${campaign.currency} sent!`);
      return;
    }
    setDonating(true);
    try {
      await onDonate({ userId: currentUserId, campaignId: campaign.id, amount: Number(amount) });
      setDone(true);
      toast.success(`Donation of ${Number(amount).toLocaleString()} ${campaign.currency} sent!`);
    } catch {
      toast.error(t("fundraise.couldnTProcessThe"));
    } finally {
      setDonating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" as const }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {!done ? (
          <>
            <div className={cn("relative h-20 bg-gradient-to-br flex items-center justify-center text-4xl", campaign.photoColor)}>
              <span>{campaign.photo}</span>
              <button className="absolute top-3 right-3 text-white/70 hover:text-white" onClick={onClose}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm">{t(campaign.title)}</h3>
                <p className="text-[11px] text-muted-foreground">{campaign.creator}</p>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 flex-wrap">
                {presets.map(p => (
                  <button
                    key={p}
                    onClick={() => setAmount(String(p))}
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer",
                      amount === String(p)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.toLocaleString()}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("savings.amountLabel", { currency: campaign.currency })}</label>
                <Input
                  type="number"
                  placeholder={t("fundraise.enterAmount")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-mono text-base"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setAnonymous(a => !a)}
                  className={cn(
                    "w-9 h-5 rounded-full transition-colors flex items-center px-0.5",
                    anonymous ? "bg-primary" : "bg-secondary border border-border"
                  )}
                >
                  <div className={cn("w-4 h-4 rounded-full bg-white transition-transform shadow", anonymous ? "translate-x-4" : "translate-x-0")} />
                </div>
                <span className="text-xs text-muted-foreground">{t("fundraise.donateAnonymously")}</span>
              </label>

              <Button className="w-full font-bold" disabled={donating} onClick={() => void handleDonate()}>
                <Heart size={14} className="mr-2" />
                {donating ? t("fundraise.processing") : t("fundraise.confirmDonation")}
              </Button>
            </div>
          </>
        ) : (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 300 }}>
              <CheckCircle size={56} className="text-primary" />
            </motion.div>
            <h3 className="font-black text-lg">{t("fundraise.thankYou")}</h3>
            <p className="text-sm text-muted-foreground"><Trans i18nKey="fundraise.donationProcessed" values={{ title: t(campaign.title) }} components={{ b: <span className="text-foreground font-semibold" /> }} /></p>
            <div className="flex gap-2 w-full">
              <Button variant="secondary" className="flex-1 text-xs" onClick={() => { void navigator.clipboard?.writeText(window.location.href).then(() => toast.success(t("fundraise.shareLinkCopied")), () => toast.error(t("fundraise.couldNotCopyThe"))); }}>
                <Share2 size={12} className="mr-1" /> {t("receipt.share")}
              </Button>
              <Button className="flex-1 text-xs" onClick={onClose}>{t("receipt.done")}</Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── CAMPAIGN DETAIL ─────────────────────────────────────────────────────────

function CampaignDetail({ campaign, onBack, onDonate }: {
  campaign: Campaign;
  onBack: () => void;
  onDonate: (c: Campaign) => void;
}) {
  const { t } = useTranslation("common");
  const progress = pct(campaign.raised, campaign.goal);
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: "easeOut" as const }}
      className="flex flex-col h-full"
    >
      {/* Header photo */}
      <div className={cn("relative h-40 bg-gradient-to-br flex items-center justify-center text-7xl shrink-0", campaign.photoColor)}>
        <span>{campaign.photo}</span>
        <button
          onClick={onBack}
          className="absolute top-3 left-3 flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-semibold bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <ArrowLeft size={14} /> {t("payments.back")}
        </button>
        <div className="absolute top-3 right-3 flex gap-1.5">
          {campaign.featured && <span className="flex items-center gap-0.5 text-[9px] font-black bg-amber-400/20 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-full"><Star size={9} /> {t("fundraise.featured")}</span>}
          {campaign.trending && <span className="flex items-center gap-0.5 text-[9px] font-black bg-rose-400/20 border border-rose-400/40 text-rose-300 px-2 py-0.5 rounded-full"><Flame size={9} /> {t("fundraise.trending")}</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <div className="flex items-start gap-2 mb-1">
            <h2 className="font-black text-xl leading-snug flex-1">{t(campaign.title)}</h2>
            {campaign.creatorVerified && <BadgeCheck size={18} className="text-primary shrink-0 mt-1" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users size={11} />{campaign.creator}</span>
            <span className="flex items-center gap-1"><MapPin size={11} />{campaign.location}</span>
            <span className="uppercase text-[9px] font-black bg-secondary px-2 py-0.5 rounded-full border border-border">{campaign.category}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-secondary/40 border border-border rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-black font-mono text-primary">{fmt(campaign.raised, campaign.currency)}</div>
              <div className="text-[10px] text-muted-foreground">{t("fundraise.raised")}</div>
            </div>
            <div>
              <div className="text-lg font-black font-mono">{campaign.donors.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">{t("fundraise.donors")}</div>
            </div>
            <div>
              <div className="text-lg font-black font-mono text-amber-700">{campaign.daysLeft}</div>
              <div className="text-[10px] text-muted-foreground">{t("fundraise.daysLeft")}</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">{progress}{t("fundraise.funded")}</span>
              <span className="text-muted-foreground">{t("fundraise.goal")} {fmt(campaign.goal, campaign.currency)}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" as const }}
              />
            </div>
          </div>
        </div>

        {/* Story */}
        <div>
          <h3 className="font-bold text-sm mb-2">{t("fundraise.aboutThisCampaign")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{campaign.story}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button className="flex-1 font-bold" onClick={() => onDonate(campaign)}>
            <Heart size={15} className="mr-2" /> {t("fundraise.donateNow")}
          </Button>
          <Button variant="secondary" className="px-4" onClick={() => { void navigator.clipboard?.writeText(window.location.href).then(() => toast.success(t("fundraise.shareLinkCopied")), () => toast.error(t("fundraise.couldNotCopyThe"))); }}>
            <Share2 size={15} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── CREATE CAMPAIGN ─────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "agriculture", label: "Agriculture" },
  { value: "education", label: "Education" },
  { value: "health", label: "Health" },
  { value: "business", label: "Business" },
];

function CreateCampaign({ currentUserId, onCreate, onBack }: {
  currentUserId: string | undefined;
  onCreate: (args: { ownerUserId: string; title: string; story: string; category: string; goal: number; currency: string; deadline?: string }) => Promise<unknown>;
  onBack: () => void;
}) {
  const { t } = useTranslation("common");
  const [form, setForm] = useState({ title: "", story: "", goal: "", category: "agriculture" as Category, deadline: "", org: "" });
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!form.title || !form.story || !form.goal || !form.deadline) {
      toast.error(t("fundraise.pleaseFillInAll"));
      return;
    }
    if (!currentUserId) {
      // Anonymous preview — keep the existing mock success path unchanged.
      setSubmitted(true);
      toast.success(t("fundraise.campaignSubmittedForReview"));
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({ ownerUserId: currentUserId, title: form.title, story: form.story, category: form.category, goal: Number(form.goal), currency: "XAF", deadline: form.deadline });
      setSubmitted(true);
      toast.success(t("fundraise.campaignSubmittedForReview"));
    } catch {
      toast.error(t("fundraise.couldnTCreateThe"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full text-center gap-5 p-8"
      >
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 300, delay: 0.1 }}>
          <CheckCircle size={64} className="text-primary" />
        </motion.div>
        <h2 className="font-black text-xl">{t("fundraise.campaignSubmitted")}</h2>
        <p className="text-muted-foreground text-sm max-w-xs">{t("fundraise.yourCampaignHasBeen")}</p>
        <div className="bg-secondary/50 border border-border rounded-2xl p-4 text-left w-full max-w-xs space-y-1.5">
          <div className="text-xs text-muted-foreground">{t("fundraise.campaignTitle")}</div>
          <div className="font-bold text-sm">{t(form.title)}</div>
          <div className="text-xs text-muted-foreground mt-1">{t("fundraise.goal2")}</div>
          <div className="font-bold font-mono text-primary text-sm">{Number(form.goal).toLocaleString()} {t("fundraise.xaf")}</div>
        </div>
        <Button className="w-full max-w-xs" onClick={onBack}>{t("fundraise.backToBrowse")}</Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" as const }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-3 p-5 border-b border-border shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="font-black text-base">{t("fundraise.launchACampaign")}</h2>
          <p className="text-xs text-muted-foreground">{t("fundraise.anyPayrusMemberCan")}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Photo placeholder */}
        <label htmlFor="campaign-photo" className="h-28 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 focus-within:border-primary transition-colors">
          <Camera size={24} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{photoName ?? t("fundraise.addACampaignPhoto")}</span>
          <input id="campaign-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)} />
        </label>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("fundraise.campaignTitle2")}</label>
          <Input
            placeholder={t("fundraise.eGCleanWater")}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("fundraise.yourStory")}</label>
          <textarea
            className="w-full min-h-[100px] bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t("fundraise.describeYourCauseWho")}
            value={form.story}
            onChange={e => setForm(f => ({ ...f, story: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t("fundraise.goalAmountXaf")}</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                className="pl-8 font-mono"
                placeholder="500000"
                value={form.goal}
                onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t("fundraise.deadline")}</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                className="pl-8"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("admin.payouttypespanel.category")}</label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORY_OPTIONS.map(c => (
              <button
                key={c.value}
                onClick={() => setForm(f => ({ ...f, category: c.value }))}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer",
                  form.category === c.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{t("fundraise.organisationNameOptional")}</label>
          <Input
            placeholder={t("fundraise.eGCoopagriKin")}
            value={form.org}
            onChange={e => setForm(f => ({ ...f, org: e.target.value }))}
          />
          <p className="text-[10px] text-muted-foreground">{t("fundraise.ngosAndRegisteredCooperatives")}</p>
        </div>

        {/* Info box */}
        <div className="flex gap-2.5 bg-primary/5 border border-primary/20 rounded-xl p-3.5">
          <Target size={15} className="text-primary shrink-0 mt-0.5" />
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <Trans i18nKey="fundraise.reviewNote" values={{ fee: t("fundraise.25PlatformFee") }} components={{ b: <span className="text-foreground font-semibold" /> }} />
          </div>
        </div>

        <Button className="w-full font-bold" disabled={submitting} onClick={() => void handleSubmit()}>
          <Plus size={15} className="mr-2" /> {submitting ? t("fundraise.submitting") : t("fundraise.submitCampaign")}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── MY CAMPAIGNS ─────────────────────────────────────────────────────────────

function MyCampaigns({ campaigns, onCreateNew, onSelect, onDonate }: {
  campaigns: Campaign[];
  onCreateNew: () => void;
  onSelect: (c: Campaign) => void;
  onDonate: (c: Campaign) => void;
}) {
  const { t } = useTranslation("common");
  const myCampaigns = campaigns;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">{t("fundraise.myCampaigns")}</h3>
        <Button size="sm" className="text-xs" onClick={onCreateNew}>
          <Plus size={13} className="mr-1" /> {t("dashboard.new")}
        </Button>
      </div>
      {myCampaigns.map(c => {
        const progress = pct(c.raised, c.goal);
        return (
          <div
            key={c.id}
            className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => onSelect(c)}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl shrink-0", c.photoColor)}>
                {c.photo}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm truncate">{t(c.title)}</h4>
                <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
                  <span className="flex items-center gap-1"><Users size={9} />{c.donors} {t("fundraise.donors")}</span>
                  <span className="flex items-center gap-1"><Clock size={9} />{c.daysLeft}{t("fundraise.dLeft")}</span>
                </div>
              </div>
              <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{progress}%</span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="font-mono text-primary font-bold">{fmt(c.raised, c.currency)}</span>
                <span>{t("fundraise.of")} {fmt(c.goal, c.currency)}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={(e) => { e.stopPropagation(); toast.info(t("fundraise.shareLinkCopied")); }}>
                <Share2 size={11} className="mr-1" /> {t("receipt.share")}
              </Button>
              <Button size="sm" className="flex-1 text-xs" onClick={(e) => { e.stopPropagation(); onDonate(c); }}>
                <ChevronRight size={11} className="mr-1" /> {t("fundraise.viewBoost")}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Fundraise() {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<TabKey>("browse");
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [donating, setDonating] = useState<Campaign | null>(null);

  const currentUser = useCurrentAppUser();
  const realCampaigns = useCampaigns();
  const createCampaignMutation = useCreateCampaignMutation();
  const donateToCampaignMutation = useDonateToCampaignMutation();

  // Real campaigns once any exist (browsable by everyone, same as the
  // fictional catalog — not gated on being signed in yourself); falls back
  // to the demo catalog only while the real table is still empty.
  const hasReal = !!realCampaigns && realCampaigns.length > 0;
  const displayCampaigns: Campaign[] = hasReal ? realCampaigns.map(toDisplayCampaign) : CAMPAIGNS;

  const filtered = displayCampaigns.filter(c => {
    const matchCat = category === "all" || c.category === category;
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase()) ||
      c.creator.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const featured = displayCampaigns.filter(c => c.featured);
  const trending = displayCampaigns.filter(c => c.trending);

  // Stats banner
  const totalRaised = displayCampaigns.reduce((s, c) => s + c.raised, 0);
  const totalDonors = displayCampaigns.reduce((s, c) => s + c.donors, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Back navigation */}
      <div className="px-5 pt-5 pb-0 shrink-0">
        <PageHeader title={t("nav.fundraise")} className="mb-4 md:mb-6" />
      </div>
      {/* Header */}
      <div className="px-5 pt-0 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-black">{t("fundraise.fundraising")}</h1>
            <p className="text-xs text-muted-foreground">{t("fundraise.communityCampaignsPoweredBy")}</p>
          </div>
          <Button size="sm" className="font-bold" onClick={() => { setSelected(null); setTab("create"); }}>
            <Plus size={14} className="mr-1" /> {t("fundraise.startCampaign")}
          </Button>
        </div>

        {/* Stats strip */}
        <div className="flex gap-3 mt-3 mb-4">
          {[
            { label: "Total raised", value: `${(totalRaised / 1_000_000).toFixed(1)}M XAF equiv.` },
            { label: "Campaigns", value: t("fundraise.nActive", { n: displayCampaigns.length }) },
            { label: "Donors", value: totalDonors.toLocaleString() },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-secondary/50 border border-border rounded-xl px-2.5 py-2">
              <div className="text-[10px] text-muted-foreground">{t(s.label)}</div>
              <div className="font-black text-xs font-mono">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {([
            { key: "browse", label: "Browse" },
            { key: "mycampaigns", label: "My Campaigns" },
            { key: "create", label: "Create" },
          ] as { key: TabKey; label: string }[]).map(tItem => (
            <button
              key={tItem.key}
              onClick={() => { setTab(tItem.key); setSelected(null); }}
              className={cn(
                "text-xs font-bold px-4 py-2.5 border-b-2 transition-colors cursor-pointer",
                tab === tItem.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t(tItem.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "browse" && !selected && (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-5">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 text-sm" placeholder={t("fundraise.searchCampaignsLocationsCreators")} value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              {/* Category filter */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3.5 py-2 rounded-xl border transition-colors cursor-pointer shrink-0",
                      category === cat.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <cat.icon size={12} className={category === cat.key ? "text-primary-foreground" : cat.color} />
                    {t(cat.label)}
                  </button>
                ))}
              </div>

              {/* Featured strip */}
              {category === "all" && !search && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Star size={13} className="text-amber-700" />
                    <span className="text-xs font-black uppercase tracking-wider">{t("fundraise.featured")}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {featured.map(c => <CampaignCard key={c.id} campaign={c} onSelect={setSelected} onDonate={setDonating} />)}
                  </div>
                </div>
              )}

              {/* Trending strip */}
              {category === "all" && !search && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Flame size={13} className="text-rose-700" />
                    <span className="text-xs font-black uppercase tracking-wider">{t("fundraise.trending")}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trending.map(c => <CampaignCard key={c.id} campaign={c} onSelect={setSelected} onDonate={setDonating} />)}
                  </div>
                </div>
              )}

              {/* All / filtered */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider">{category === "all" && !search ? t("fundraise.allCampaigns") : `Results (${filtered.length})`}</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">{t("fundraise.noCampaignsFoundFor")}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(c => <CampaignCard key={c.id} campaign={c} onSelect={setSelected} onDonate={setDonating} />)}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {tab === "browse" && selected && (
            <motion.div key="detail" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CampaignDetail campaign={selected} onBack={() => setSelected(null)} onDonate={setDonating} />
            </motion.div>
          )}

          {tab === "mycampaigns" && (
            <motion.div key="mine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
              {selected ? (
                <CampaignDetail campaign={selected} onBack={() => setSelected(null)} onDonate={setDonating} />
              ) : (
                <MyCampaigns
                  campaigns={hasReal ? displayCampaigns.filter((_, i) => realCampaigns![i].ownerUserId === currentUser?.id) : displayCampaigns.slice(0, 2)}
                  onCreateNew={() => setTab("create")}
                  onSelect={setSelected}
                  onDonate={setDonating}
                />
              )}
            </motion.div>
          )}

          {tab === "create" && (
            <motion.div key="create" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CreateCampaign
                currentUserId={currentUser?.id}
                onCreate={createCampaignMutation}
                onBack={() => setTab("browse")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Donate modal */}
      <AnimatePresence>
        {donating && <DonateModal campaign={donating} currentUserId={currentUser?.id} onDonate={donateToCampaignMutation} onClose={() => setDonating(null)} />}
      </AnimatePresence>
    </div>
  );
}
