// Shared helpers for the Travel page. The price maths mirrors supabase/migrations/0062 (`book_travel`) so
// the quote shown before booking matches what the database will charge; the database is still the
// authority and its figures are what the confirmation screen shows.

export const AIRPORTS: Record<string, string> = {
  KIN: "Kinshasa", CDG: "Paris", NBO: "Nairobi", BRU: "Brussels", IST: "Istanbul", ABJ: "Abidjan",
  DKR: "Dakar", ADD: "Addis Ababa", KGL: "Kigali", JNB: "Johannesburg", LOS: "Lagos",
};

export const airportLabel = (code: string) => (AIRPORTS[code] ? `${code} · ${AIRPORTS[code]}` : code);

/** "KIN", "kin", "KIN · Kinshasa" or "Kinshasa" -> "KIN"; null when it cannot be read as a code. */
export function toAirportCode(input: string): string | null {
  const text = input.trim();
  if (/^[A-Za-z]{3}\b/.test(text) && (text.length === 3 || /^[A-Za-z]{3}\s*[·-]/.test(text))) return text.slice(0, 3).toUpperCase();
  const hit = Object.entries(AIRPORTS).find(([, city]) => city.toLowerCase() === text.toLowerCase());
  return hit ? hit[0] : null;
}


export function formatMoney(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
  } catch {
    return `${amount.toLocaleString(locale)} ${currency}`;
  }
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PriceQuote {
  base: number; discount: number; total: number;
  term1: number; term2: number; term3: number; fee: number;
  /** What leaves the wallet now: the full total, or instalment 1 plus the service fee. */
  chargedNow: number;
}

export function priceQuote(unitPrice: number, units: number, discountPercent: number, installments: boolean): PriceQuote {
  const base = round2(unitPrice * units);
  const discount = round2((base * discountPercent) / 100);
  const total = round2(base - discount);
  const term1 = round2(total * 0.34);
  const term2 = round2(total * 0.33);
  const term3 = round2(total - term1 - term2);
  const fee = round2(total * 0.025);
  return { base, discount, total, term1, term2, term3, fee, chargedNow: installments ? round2(term1 + fee) : total };
}

// ---- Dates as plain YYYY-MM-DD strings (no timezone surprises) ----

const pad = (n: number) => String(n).padStart(2, "0");

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function formatDate(iso: string | null | undefined, locale?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** Total flight time in hours from a "10h 15m" style duration; Infinity when it cannot be read. */
export function durationHours(d: string): number {
  const m = /(\d+)h\s*(\d+)?/.exec(d);
  return m ? Number(m[1]) + Number(m[2] ?? 0) / 60 : Infinity;
}

/** The database's error text, trimmed of its "function_name:" prefix. */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.replace(/^[a-z_]+:\s*/i, "");
}

/** Maps the database's refusals to translation keys so the customer sees a clear reason. */
export function bookingErrorKey(e: unknown): string {
  const m = errorMessage(e).toLowerCase();
  if (m.includes("sold out")) return "travel.error.soldOut";
  if (m.includes("insufficient")) return "travel.error.insufficient";
  if (m.includes("past")) return "travel.error.pastDate";
  if (m.includes("no longer available")) return "travel.error.unavailable";
  if (m.includes("no wallet")) return "travel.error.noWallet";
  if (m.includes("not permitted")) return "travel.error.notPermitted";
  return "travel.bookingFailed";
}

export const AMENITY_KEYS = ["wifi", "meal", "entertainment", "usb", "pool", "spa", "restaurant", "bar", "gym", "parking", "ac", "conference", "casino"] as const;
