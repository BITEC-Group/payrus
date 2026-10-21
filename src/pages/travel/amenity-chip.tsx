import { useTranslation } from "react-i18next";
import { BedDouble, Coffee, Dumbbell, Dices, Car, Snowflake, Sparkles, Utensils, Wifi, Wind, Zap, Presentation, Wine } from "lucide-react";
import type { ComponentType } from "react";

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  wifi: Wifi, meal: Utensils, entertainment: Zap, usb: Zap, pool: Wind, spa: Sparkles, restaurant: Coffee, bar: Wine,
  gym: Dumbbell, parking: Car, ac: Snowflake, conference: Presentation, casino: Dices,
};

export default function AmenityChip({ amenity, size = 9, className }: { amenity: string; size?: number; className?: string }) {
  const { t } = useTranslation("common");
  // amenities come from the database either as keys ("wifi") or as labels ("Priority boarding")
  const norm = amenity.toLowerCase().replace(/[\s-]+/g, "_");
  const Icon = ICONS[amenity] ?? ICONS[norm] ?? BedDouble;
  return (
    <div className={className ?? "flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-[10px] text-muted-foreground"}>
      <Icon size={size} />
      {t([`travel.amenity.${amenity}`, `travel.amenity.${norm}`], { defaultValue: amenity })}
    </div>
  );
}
