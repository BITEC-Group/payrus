import i18n from "i18next";

/**
 * A large amount as a short figure in the active language: 12.8M in English, "12,8 M" in French and Spanish,
 * "12,8 mi" in Portuguese. Below 1,000 it is the plain localised number.
 */
export function formatCompact(n: number, maxFractionDigits = 1): string {
  const lng = i18n.language || "en";
  const large = Math.abs(n) >= 1000;
  return new Intl.NumberFormat(lng, {
    notation: large ? "compact" : "standard",
    compactDisplay: "short",
    maximumFractionDigits: large ? maxFractionDigits : 2,
  }).format(n);
}
