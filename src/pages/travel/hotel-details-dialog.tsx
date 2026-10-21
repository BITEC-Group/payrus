import { useTranslation } from "react-i18next";
import { CheckCircle2, Heart, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import type { AppHotel, AppTravelReview } from "@/lib/backend.ts";
import AmenityChip from "./amenity-chip.tsx";
import { StarsDisplay } from "./reviews-section.tsx";
import { formatDate, formatMoney, round2 } from "./travel-utils.ts";

interface Props {
  hotel: AppHotel;
  reviews: AppTravelReview[];
  liked: boolean;
  nights: number;
  onToggleLike: () => void;
  onBook: () => void;
  onClose: () => void;
}

export default function HotelDetailsDialog({ hotel, reviews, liked, nights, onToggleLike, onBook, onClose }: Props) {
  const { t, i18n } = useTranslation("common");
  const memberPrice = round2(hotel.pricePerNight * (1 - hotel.memberDiscountPercent / 100));
  const mine = reviews.filter((r) => r.kind === "hotel" && r.itemId === hotel.id);
  const fmt = (n: number) => formatMoney(n, hotel.currency, i18n.language);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden gap-0" data-testid="hotel-details">
        <div className="relative h-32 bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
          <span className="text-6xl" aria-hidden>{hotel.emoji}</span>
          <button type="button" onClick={onToggleLike} aria-pressed={liked} aria-label={t("travel.favorites.toggle")}
            className="absolute top-3 right-12 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-card transition-colors">
            <Heart size={14} className={liked ? "text-red-400 fill-red-400" : "text-muted-foreground"} />
          </button>
          <div className="absolute bottom-3 left-4"><StarsDisplay count={hotel.stars} /></div>
        </div>
        <div className="p-6 space-y-4 max-h-[60vh] overflow-auto">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-bold">{hotel.name}</DialogTitle>
            <DialogDescription className="flex items-center gap-1 text-[11px]">
              <MapPin size={11} /> {hotel.location}{hotel.distance ? ` · ${t(hotel.distance, { defaultValue: hotel.distance })}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 font-bold text-amber-700">★ {hotel.rating}</span>
            <span className="text-muted-foreground">{t("travel.reviewsCountLabel", { count: (hotel.reviewCount + mine.length).toLocaleString(i18n.language) })}</span>
            <span className="text-muted-foreground">{hotel.category}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {hotel.amenities.map((a) => <AmenityChip key={a} amenity={a} size={10} />)}
          </div>

          <div className="rounded-2xl bg-secondary/50 p-4 flex items-end justify-between">
            <div>
              <div className="text-[11px] text-muted-foreground">{t("travel.perNight")}</div>
              <div className="text-xl font-black font-mono text-foreground">{fmt(hotel.pricePerNight)}</div>
            </div>
            {hotel.memberDiscountPercent > 0 && (
              <div className="text-right text-xs text-primary flex items-center gap-1.5">
                <CheckCircle2 size={12} /> {t("travel.memberPrice")} <span className="font-bold font-mono">{fmt(memberPrice)}/{t("travel.nightAbbrev")}</span>
              </div>
            )}
          </div>

          {mine.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">{t("travel.details.guestReviews")}</div>
              {mine.slice(0, 3).map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-3 text-[12px]">
                  <div className="flex items-center justify-between mb-1"><span className="font-semibold">{r.userName}</span><span className="text-[10px] text-muted-foreground">{formatDate(r.createdAt, i18n.language)}</span></div>
                  <StarsDisplay count={r.rating} size={10} />
                  <p className="text-muted-foreground mt-1">{t(r.comment)}</p>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={onBook}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors">
            {t("travel.details.bookStay", { nights, count: nights })}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
