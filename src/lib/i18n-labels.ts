import type { TFunction } from "i18next";

/** Translated label for a transfer type stored in the database (transfer, payment, deposit, remittance, convert_out, convert_in). */
export function txTypeLabel(t: TFunction, type: string): string {
  return t(`txtype.${type}`, { defaultValue: type });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short month name in the active language for a chart label written as an English abbreviation ("Mar"). */
export function monthLabel(month: string, lng: string | undefined): string {
  const i = MONTHS.indexOf(month);
  if (i < 0) return month;
  return new Intl.DateTimeFormat(lng ?? "en", { month: "short" }).format(new Date(2026, i, 1));
}

/** Wallet names the backend generates ("PayRus USD Wallet") in the active language; partner brand names pass through. */
export function walletProviderLabel(t: TFunction, provider: string | null | undefined): string | undefined {
  if (!provider) return undefined;
  const m = provider.match(/^PayRus ([A-Z]{3}) Wallet$/);
  return m ? t("wallet.payrusWallet", { currency: m[1] }) : provider;
}

const displayNames = new Map<string, Intl.DisplayNames>();
const names = (lng: string, type: "region" | "currency") => {
  const k = `${lng}:${type}`;
  let d = displayNames.get(k);
  if (!d) { d = new Intl.DisplayNames([lng], { type }); displayNames.set(k, d); }
  return d;
};

/** Country name in the active language (ISO-3166 alpha-2 code); the English name is the fallback. */
export function countryName(code: string, lng: string | undefined, fallback: string): string {
  try { return names(lng ?? "en", "region").of(code) ?? fallback; } catch { return fallback; }
}

/** Currency name in the active language (ISO-4217 code). */
export function currencyName(code: string, lng: string | undefined, fallback = code): string {
  try { return names(lng ?? "en", "currency").of(code) ?? fallback; } catch { return fallback; }
}

/** "Working capital (15%)" -> the name translated, the share kept as written. */
export function labelWithPercent(t: TFunction, item: string): string {
  const m = item.match(/^(.*) \((\d+%)\)$/);
  return m ? `${t(m[1])} (${m[2]})` : t(item);
}

/** A savings-goal date written in English ("Sep 2026"), "Ongoing" or an ISO date, in the active language. */
export function potDueLabel(t: TFunction, due: string, lng: string | undefined): string {
  if (due === "Ongoing") return t("savings.ongoing");
  const m = due.match(/^([A-Z][a-z]{2}) (\d{4})$/);
  if (m && MONTHS.includes(m[1])) return `${monthLabel(m[1], lng)} ${m[2]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(due)) { const d = new Date(due); if (!Number.isNaN(d.getTime())) return new Intl.DateTimeFormat(lng ?? "en", { month: "short", year: "numeric" }).format(d); }
  return due;
}
