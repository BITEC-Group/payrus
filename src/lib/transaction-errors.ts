// Turns what the backend (or the network) throws when a money action fails into a message a customer can act on:
// "insufficient wallet balance: you need 208.00 EUR but your wallet holds 50.00 EUR", "unauthorised corridor", and so on.
//
// The database raises plain English exceptions (supabase/migrations: apply_wallet_transfer, send_remittance, p2p_transfer,
// send_to_receiver, ...), PostgREST adds its own wording, and fetch adds another for a dropped connection. This is the one place
// that recognises them; every money screen calls transactionErrorMessage() instead of showing "Something went wrong".

export type TransactionErrorCode =
  | "insufficient_balance" | "no_wallet" | "unauthorised" | "permission" | "session" | "network"
  | "corridor_not_offered" | "corridor_suspended" | "corridor_below_min" | "corridor_above_max" | "corridor_below_floor" | "corridor_no_rate" | "corridor_invalid"
  | "payout_not_connected" | "partner_not_live" | "agent_not_allowed" | "no_agent" | "agents_only" | "wallet_receiver"
  | "approval_limit" | "role_permission" | "self_transfer" | "unknown_recipient" | "bad_amount" | "currency_unsupported"
  | "quote_expired" | "sold_out" | "duplicate" | "unknown";

export interface TransactionError {
  code: TransactionErrorCode;
  /** Values to interpolate into the message (amounts, currencies, country). */
  params: Record<string, string>;
}

const CORRIDOR_REASONS: Record<string, TransactionErrorCode> = {
  not_offered: "corridor_not_offered", suspended: "corridor_suspended", below_min: "corridor_below_min", above_max: "corridor_above_max",
  below_floor: "corridor_below_floor", no_rate: "corridor_no_rate", invalid: "corridor_invalid",
};

const rawMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "";
};

/** Reads the backend's wording and says what went wrong. Order matters: the specific cases come first. */
export function classifyTransactionError(e: unknown): TransactionError {
  const raw = rawMessage(e);
  const m = raw.toLowerCase();
  const done = (code: TransactionErrorCode, params: Record<string, string> = {}): TransactionError => ({ code, params });

  // corridor_blocked:<reason> from remittance_quote / send_remittance (migrations 0033-0047)
  const corridor = /corridor_blocked:\s*([a-z_]+)/.exec(m);
  if (corridor) return done(CORRIDOR_REASONS[corridor[1]] ?? "corridor_invalid");

  // insufficient balance (need 208.00 EUR, have 50.00 EUR) - the currency tags are absent in older functions
  const bal = /insufficient (?:wallet )?balance(?:\s*\(\s*need\s+([\d.,]+)\s*([a-z]{3})?\s*,\s*have\s+([\d.,]+)\s*([a-z]{3})?\s*\))?/i.exec(raw);
  if (bal) {
    const currency = (bal[2] ?? bal[4] ?? "").toUpperCase();
    return done("insufficient_balance", bal[1] ? { need: bal[1], have: bal[3] ?? "", currency } : {});
  }

  if (/has no wallet|no wallet yet|open a wallet first|no \w+ wallet yet/.test(m)) return done("no_wallet");

  // Authorisation
  if (/acting user does not match|not permitted|not authori[sz]ed|only .* can |only the superadmin|admin role required/.test(m) && !/does not allow this step/.test(m)) {
    return done(/agent/.test(m) ? "agents_only" : "unauthorised");
  }
  if (/permission denied|row-level security|violates row-level/.test(m)) return done("permission");
  if (/jwt|not signed in|auth session missing|invalid refresh token|session (?:has )?expired|401/.test(m)) return done("session");

  // Routes and partners
  const notConnected = /(.+?) is not connected in ([a-z]{2})/i.exec(raw);
  if (notConnected) return done("payout_not_connected", { method: notConnected[1].replace(/^.*?:\s*/, ""), country: notConnected[2].toUpperCase() });
  if (/partner route is not live|route is not live|contract not active/.test(m)) return done("partner_not_live");
  if (/agent cannot pay out|cannot pay out to this receiver/.test(m)) return done("agent_not_allowed");
  if (/no pickup agent is available/.test(m)) return done("no_agent");
  if (/only agents can pay out/.test(m)) return done("agents_only");
  if (/use a payrus transfer for wallet receivers/.test(m)) return done("wallet_receiver");

  // Limits and roles
  const approval = /above your approval limit of ([\d.,]+)/i.exec(raw);
  if (approval) return done("approval_limit", { limit: approval[1] });
  if (/does not allow this step|needs the .* permission/.test(m)) return done("role_permission");

  // Who and how much
  if (/cannot send to yourself/.test(m)) return done("self_transfer");
  if (/unknown (?:recipient|receiver|sender|user|customer)|no such (?:user|customer|receiver)/.test(m)) return done("unknown_recipient");
  if (/amount must be positive|amount must be|must be greater than/.test(m)) return done("bad_amount");
  if (/not a supported currency|no reference rate|no branding available/.test(m)) return done("currency_unsupported");
  if (/quote .*expired|offer has expired|expired/.test(m)) return done("quote_expired");
  if (/sold out/.test(m)) return done("sold_out");
  if (/duplicate key|already (?:booked|exists)|unique constraint/.test(m)) return done("duplicate");

  // The connection itself
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out/.test(m)) return done("network");

  return done("unknown");
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The translation key for an error code (the corridor reasons reuse the existing remittance.blocked.* wording). */
export function transactionErrorKey(code: TransactionErrorCode): string {
  if (code.startsWith("corridor_")) return `remittance.blocked.${code.slice("corridor_".length)}`;
  return `txerror.${code}`;
}

/**
 * The message to show. `fallbackKey` is the screen's own generic message ("payments.paymentFailed"), used only when the
 * failure is not recognised; a recognised failure always gets its specific explanation.
 */
export function transactionErrorMessage(e: unknown, t: Translate, fallbackKey = "txerror.unknown"): string {
  const { code, params } = classifyTransactionError(e);
  if (code === "unknown") return t(fallbackKey);
  if (code === "insufficient_balance" && !params.need) return t("txerror.insufficient_balance_plain");
  return t(transactionErrorKey(code), params);
}
