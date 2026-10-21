import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { useAddTravelReviewMutation } from "@/hooks/use-backend.ts";
import type { AppTravelReview } from "@/lib/backend.ts";
import { errorMessage, formatDate } from "./travel-utils.ts";

export function StarsDisplay({ count, size = 12 }: { count: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className={i < Math.round(count) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"} />
      ))}
    </div>
  );
}

function flagOf(country: string | null) {
  if (!country || country.length !== 2) return "🌍";
  return String.fromCodePoint(...country.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

interface Props {
  kind: "flight" | "hotel";
  reviews: AppTravelReview[];
  /** The catalogue items a customer can review, as { id, label }. */
  items: { id: string; label: string }[];
  userId: string | undefined;
  /** Pre-selects the item being reviewed (e.g. from a hotel's detail view). */
  defaultItemId?: string;
}

function ReviewForm({ kind, items, userId, defaultItemId, onDone }: Pick<Props, "kind" | "items" | "userId" | "defaultItemId"> & { onDone: () => void }) {
  const { t } = useTranslation("common");
  const addReview = useAddTravelReviewMutation();
  const [itemId, setItemId] = useState(defaultItemId ?? items[0]?.id ?? "");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const ratingLabels = t("travel.reviewForm.ratingLabels", { returnObjects: true }) as string[];

  async function submit() {
    if (!userId) { toast.error(t("travel.reviews.signIn")); return; }
    if (!itemId || rating < 1 || comment.trim().length < 3) { toast.error(t("travel.reviewForm.toastError")); return; }
    setBusy(true);
    try {
      await addReview({ userId, kind, itemId, rating, comment: comment.trim() });
      toast.success(t("travel.reviewPublishedToast"));
      onDone();
    } catch (e) {
      toast.error(errorMessage(e) || t("travel.reviews.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-4" data-testid="review-form">
      <h3 className="text-sm font-bold text-foreground">{t("travel.leaveReview")}</h3>
      <label className="block space-y-1">
        <span className="text-[11px] text-muted-foreground">{kind === "flight" ? t("travel.reviews.whichFlight") : t("travel.reviews.whichHotel")}</span>
        <select id={`review-item-${kind}`} value={itemId} onChange={(e) => setItemId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm">
          {items.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <button key={i} type="button" aria-label={`${i + 1}`} onMouseEnter={() => setHovered(i + 1)} onMouseLeave={() => setHovered(0)} onClick={() => setRating(i + 1)}
            className="cursor-pointer transition-transform hover:scale-125">
            <Star size={24} className={i < (hovered || rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"} />
          </button>
        ))}
        {rating > 0 && <span className="text-sm text-muted-foreground ml-2">{ratingLabels[rating]}</span>}
      </div>
      <textarea id={`review-comment-${kind}`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("travel.reviewForm.placeholder")} rows={3} maxLength={500}
        className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50" />
      <button type="button" disabled={busy} onClick={() => void submit()}
        className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-60">
        {busy ? t("signin.checking") : t("travel.reviewForm.submitButton")}
      </button>
    </div>
  );
}

export default function ReviewsSection({ kind, reviews, items, userId, defaultItemId }: Props) {
  const { t, i18n } = useTranslation("common");
  const [showForm, setShowForm] = useState(false);
  const shown = reviews.filter((r) => r.kind === kind);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{kind === "flight" ? t("travel.reviewsHeadingFlights") : t("travel.reviewsHeadingHotels")}</h2>
        <button type="button" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-[11px] text-primary font-medium cursor-pointer hover:bg-primary/20 transition-colors">
          <Star size={11} /> {t("travel.leaveReview")}
        </button>
      </div>

      {showForm && <ReviewForm kind={kind} items={items} userId={userId} defaultItemId={defaultItemId} onDone={() => setShowForm(false)} />}

      {shown.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">{t("travel.reviews.none")}</div>
      ) : (
        <div className="space-y-3">
          {shown.map((review) => (
            <div key={review.id} className={cn("rounded-2xl bg-card border p-4", review.mine ? "border-primary/40" : "border-border")} data-testid="review-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-base shrink-0">{flagOf(review.country)}</div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                      {review.userName}
                      {review.mine && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{t("travel.reviews.yours")}</span>}
                      {review.verified && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700"><BadgeCheck size={11} /> {t("travel.reviews.verified")}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{review.entity}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StarsDisplay count={review.rating} />
                  <div className="text-[10px] text-muted-foreground">{formatDate(review.createdAt, i18n.language)}</div>
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed">{t(review.comment)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
