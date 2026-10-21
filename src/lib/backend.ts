// Supabase replacement for App/convex/*.ts — see supabase/migrations/
// 0001_init_schema.sql through 0006_app_rpc_functions.sql for the schema
// and RPC functions this calls, and supabase/README.md for why the
// target-shape tables (wallet_views/quotes/transfers/partner_mock) are used
// here instead of the legacy 1:1 Convex translation (wallets/transactions).
//
// One function per Convex query/mutation this replaces, kept close to the
// original's name and shape so each page's migration is a small, reviewable
// diff rather than a rewrite. Pure reads that RLS permits directly (cards,
// wallet_views, user_roles, addresses, linked_payment_methods,
// marketplace_partners, shop_orders) are plain supabase-js queries — no
// RPC wrapping for a trivial SELECT.
import { supabase } from "./supabase-client.ts";

// ============================================================================
// Types — mirror the Postgres tables/RPC return shapes, camelCased to match
// what the Convex-backed pages already destructure.
// ============================================================================

export interface AppUser {
  id: string;
  authUserId: string | null;
  username: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  idType: string | null;
  profileType: string | null;
  country: string | null;
  defaultCurrency: string | null;
  /** Country the user is in right now (live location, migration 0028), if they allowed it. */
  locationCountry: string | null;
  locationCurrency: string | null;
  /** Currency transactions default to: the live-location currency, else the registration currency. */
  transactionCurrency: string | null;
  kycStatus: "unverified" | "submitted" | "verified";
  kycSubmittedAt: string | null;
  isTestData: boolean;
}

export interface AppAddress {
  id: string;
  userId: string;
  street: string;
  houseNumber: string;
  city: string;
  province: string;
  country: string;
  postalCode: string | null;
  createdAt: string;
}

export interface AppUserRole {
  id: string;
  userId: string;
  role: string;
  kind: "individual" | "organisation";
  status: "incomplete" | "pending_verification" | "verified";
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  idType: string | null;
  orgName: string | undefined; // matches post-auth-routing.ts's ExistingRole.orgName?: string
  registrationDocPath: string | null;
  legalRepName: string | null;
  legalRepIdType: string | null;
  legalRepIdNumber: string | null;
  legalRepPhone: string | null;
  idFrontDocPath: string | null;
  idBackDocPath: string | null;
  selfieDocPath: string | null;
  createdAt: string;
  complete: boolean;
}

export interface AppWallet {
  id: string;
  userId: string;
  provider: string;
  currency: string;
  balance: number;
  asOf: string;
  isStale: boolean;
  flag: string;
  colorClass: string;
}

export interface AppCard {
  id: string;
  userId: string;
  tier: string;
  brand: string;
  last4: string;
  holder: string;
  expiry: string;
  balance: number;
  currency: string;
  type: string;
  network: string;
  contactless: boolean;
  gradient: string;
  shimmer: string;
  accentColor: string;
  locked: boolean;
  monthlySpend: number;
  monthlyLimit: number;
}

export interface AppTransfer {
  id: string;
  userId: string;
  walletViewId: string;
  type: "transfer" | "payment" | "deposit" | "remittance" | "convert_out" | "convert_in";
  state: string;
  amount: number;
  currency: string;
  partnerTxId: string | null;
  reference: string;
  note: string | null;
  createdAt: string;
  // The commission fee, joined in from the transfer's quote (quotes.fee) —
  // null when the transfer has no quote (e.g. a same-currency deposit) or
  // when this row came from an RPC call that returns the bare `transfers`
  // row with no embedded quote. Restores the fee/commission line the
  // pre-migration Convex `transactions.commission` column used to show,
  // see wallet-history-sheet.tsx.
  fee: number | null;
}

export interface LinkedPaymentMethod {
  id: string;
  ownerKey: string | null;
  provider: "apple_pay" | "google_pay" | "card" | "bank" | "mobile_money";
  label: string;
  status: "active" | "primary";
  createdAt: string;
}

export interface MarketplacePartner {
  id: string;
  slug: string;
  name: string;
  category: string;
  emoji: string;
  promoted: boolean;
  discountPercent: number | null;
  rating: number;
  items: { name: string; price: number }[];
}

export interface ShopOrder {
  id: string;
  ownerKey: string | null;
  partnerSlug: string | null;
  partnerName: string;
  subtotal: number;
  discountAmount: number;
  payrusFee: number;
  partnerCommission: number;
  total: number;
  method: string;
  reference: string;
  createdAt: string;
}

// Throws on a Postgrest/RPC error; otherwise returns `data` AS-IS — still
// possibly null (e.g. `.maybeSingle()` legitimately finds no row). Use
// `mustHaveData` below when null would itself be a bug, not a valid result.
function mustNotError<T>(res: { data: T | null; error: { message: string } | null }, label: string): T | null {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

// Same, but also throws if `data` is null — for calls (`.select()` without
// `.maybeSingle()`, `.single()`, an RPC expected to always return a row)
// where a null result means something went wrong, not "not found."
function mustHaveData<T>(res: { data: T | null; error: { message: string } | null }, label: string): T {
  const data = mustNotError(res, label);
  if (data === null) throw new Error(`${label}: expected data, got null`);
  return data;
}

function toAppUser(row: Record<string, unknown>): AppUser {
  return {
    id: row.id as string, authUserId: (row.auth_user_id as string) ?? null, username: (row.username as string) ?? null,
    name: (row.name as string) ?? null, firstName: (row.first_name as string) ?? null, lastName: (row.last_name as string) ?? null,
    email: (row.email as string) ?? null, phone: (row.phone as string) ?? null, dateOfBirth: (row.date_of_birth as string) ?? null,
    address: (row.address as string) ?? null, idType: (row.id_type as string) ?? null, profileType: (row.profile_type as string) ?? null,
    country: (row.country as string) ?? null, defaultCurrency: (row.default_currency as string) ?? null,
    locationCountry: (row.location_country as string) ?? null, locationCurrency: (row.location_currency as string) ?? null,
    transactionCurrency: ((row.location_currency as string) ?? (row.default_currency as string)) ?? null,
    kycStatus: row.kyc_status as AppUser["kycStatus"], kycSubmittedAt: (row.kyc_submitted_at as string) ?? null,
    isTestData: Boolean(row.is_test_data),
  };
}

// ============================================================================
// Identity (replaces convex/users.ts, convex/supabaseAuth.ts)
// ============================================================================

export async function upsertSupabaseUser(args: {
  supabaseUserId: string; email: string; name?: string; firstName?: string; lastName?: string;
}): Promise<{ userId: string; isNew: boolean; name: string }> {
  const before = await supabase.from("users").select("id").eq("auth_user_id", args.supabaseUserId).maybeSingle();
  const res = await supabase.rpc("upsert_supabase_user", {
    p_auth_user_id: args.supabaseUserId, p_email: args.email, p_name: args.name ?? null,
    p_first_name: args.firstName ?? null, p_last_name: args.lastName ?? null,
  });
  const row = mustHaveData(res, "upsertSupabaseUser") as Record<string, unknown>;
  return { userId: row.id as string, isNew: !before.data, name: (row.name as string) ?? args.email };
}

export async function completeRegistrationProfile(args: {
  userId: string; phone: string; country: string; street: string; houseNumber: string;
  city: string; province: string; postalCode?: string;
}): Promise<void> {
  const res = await supabase.rpc("complete_registration_profile", {
    p_user_id: args.userId, p_phone: args.phone, p_country: args.country, p_street: args.street,
    p_house_number: args.houseNumber, p_city: args.city, p_province: args.province, p_postal_code: args.postalCode ?? null,
  });
  mustHaveData(res, "completeRegistrationProfile");
}

export async function resolveEmailByIdentifier(identifier: string): Promise<string | null> {
  const res = await supabase.rpc("resolve_email_by_identifier", { p_identifier: identifier });
  return mustNotError(res, "resolveEmailByIdentifier") as string | null;
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  const res = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  const row = mustNotError(res, "getUserById");
  return row ? toAppUser(row) : null;
}

// The signed-in Supabase session's own `users` row — identity comes from the
// session, not from a cached local id, so it can't drift from the account
// that money RPCs are authorised against (auth.uid()).
export async function getSessionAppUser(): Promise<AppUser | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authId = sessionData.session?.user.id;
  if (!authId) return null;
  const res = await supabase.from("users").select("*").eq("auth_user_id", authId).maybeSingle();
  const row = mustNotError(res, "getSessionAppUser");
  return row ? toAppUser(row) : null;
}

export async function updateMyLocation(country: string): Promise<AppUser> {
  const res = await supabase.rpc("update_my_location", { p_country: country });
  return toAppUser(mustHaveData(res, "updateMyLocation") as Record<string, unknown>);
}

export async function clearMyLocation(): Promise<void> {
  const res = await supabase.rpc("clear_my_location");
  mustHaveData(res, "clearMyLocation");
}

export interface ResolvedRecipient { id: string; name: string; username: string | null; defaultCurrency: string | null }

export async function resolveUserByIdentifier(identifier: string): Promise<ResolvedRecipient | null> {
  const res = await supabase.rpc("resolve_user_by_identifier", { p_identifier: identifier });
  const rows = (mustNotError(res, "resolveUserByIdentifier") ?? []) as Record<string, unknown>[];
  const r = rows[0];
  return r ? { id: r.id as string, name: (r.name as string) ?? (r.username as string) ?? "PayRus member", username: (r.username as string) ?? null, defaultCurrency: (r.default_currency as string) ?? null } : null;
}

export interface Counterpart {
  id: string; name: string; username: string | null; defaultCurrency: string | null; maskedEmail: string | null;
  timesSent: number; lastSentAt: string; lastCurrency: string | null;
}

// People the signed-in user has already sent money to, filtered as they type
// (name, @username, email prefix). Never a directory of other members.
export async function searchMyCounterparts(query: string, limit = 8): Promise<Counterpart[]> {
  const res = await supabase.rpc("search_my_counterparts", { p_query: query || null, p_limit: limit });
  return ((mustNotError(res, "searchMyCounterparts") ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, name: (r.name as string) ?? (r.username as string) ?? "PayRus member", username: (r.username as string) ?? null,
    defaultCurrency: (r.default_currency as string) ?? null, maskedEmail: (r.masked_email as string) ?? null,
    timesSent: Number(r.times_sent), lastSentAt: r.last_sent_at as string, lastCurrency: (r.last_currency as string) ?? null,
  }));
}

export type DeliveryMethod = "mobile_money" | "bank" | "cash_pickup" | "wallet";
export interface SavedRecipient {
  id: string; fullName: string; country: string | null; currency: string | null; deliveryMethod: DeliveryMethod;
  provider: string | null; account: string; timesSent: number; lastSentAt: string | null;
}

// The signed-in user's remittance recipient book (migration 0032). Owner-only.
export async function listSavedRecipients(): Promise<SavedRecipient[]> {
  const res = await supabase.rpc("list_saved_recipients");
  return ((mustNotError(res, "listSavedRecipients") ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, fullName: r.full_name as string, country: (r.country as string) ?? null, currency: (r.currency as string) ?? null,
    deliveryMethod: r.delivery_method as DeliveryMethod, provider: (r.provider as string) ?? null, account: r.account as string,
    timesSent: Number(r.times_sent), lastSentAt: (r.last_sent_at as string) ?? null,
  }));
}

export async function saveRecipient(args: {
  fullName: string; deliveryMethod: DeliveryMethod; account: string; country?: string; currency?: string; provider?: string;
}): Promise<string> {
  const res = await supabase.rpc("save_recipient", {
    p_full_name: args.fullName, p_delivery_method: args.deliveryMethod, p_account: args.account,
    p_country: args.country ?? null, p_currency: args.currency ?? null, p_provider: args.provider ?? null,
  });
  return mustHaveData(res, "saveRecipient") as string;
}

export async function touchSavedRecipient(id: string): Promise<void> {
  mustNotError(await supabase.rpc("touch_saved_recipient", { p_id: id }), "touchSavedRecipient");
}

export async function deleteSavedRecipient(id: string): Promise<void> {
  mustNotError(await supabase.rpc("delete_saved_recipient", { p_id: id }), "deleteSavedRecipient");
}

// ---- Send to a NEW receiver from identification data (migration 0038) ----
export type PayoutMethod = "mobile_money" | "bank" | "cash_pickup";
export interface Receiver {
  id: string; fullName: string; country: string | null; currency: string | null; deliveryMethod: PayoutMethod; provider: string | null;
  account: string; phone: string | null; idType: string | null; idNumber: string | null; city: string | null; address: string | null; email: string | null; timesSent: number; lastSentAt: string | null;
}
export interface PayoutRow {
  id: string; reference: string | null; receiverName: string; country: string | null; deliveryMethod: PayoutMethod; provider: string | null;
  accountMasked: string; amount: number; fromCurrency: string; toCurrency: string; receiveAmount: number;
  status: "processing" | "ready_for_pickup" | "paid_out" | "blocked" | "cancelled"; pickupCode: string | null; agentName: string | null; agentAddress: string | null; createdAt: string; completedAt: string | null;
}
export interface ReceiverInput {
  fullName: string; phone: string; country: string; city: string; address: string; email?: string; currency: string; deliveryMethod: PayoutMethod;
  provider?: string; account?: string; idType?: string; idNumber?: string;
}
export interface PayoutAgent {
  id: string; name: string; kind: "payrus_direct" | "correspondent"; partner: string | null; country: string; city: string; address: string; phone: string | null;
  hours: string | null; distanceKm: number | null; matchLevel: "city" | "country" | "nearby"; scope?: "country" | "zone" | "abroad"; pickupCurrency?: string;
}
export interface PayoutReceipt { reference: string; payoutStatus: PayoutRow["status"]; pickupCode: string | null; receiveAmount: number; toCurrency: string; receiverName: string; deliveryMethod: PayoutMethod; agentName: string | null; agentAddress: string | null }

const camelRow = <T,>(r: Record<string, unknown>): T => Object.fromEntries(Object.entries(r).map(([k, v]) => [camelKey(k), v])) as T;

export async function listMyReceivers(): Promise<Receiver[]> {
  const res = await supabase.rpc("list_my_receivers");
  return ((mustNotError(res, "listMyReceivers") ?? []) as Record<string, unknown>[]).map((r) => ({ ...camelRow<Receiver>(r), timesSent: Number(r.times_sent) }));
}

export async function saveReceiver(a: ReceiverInput): Promise<string> {
  const res = await supabase.rpc("save_receiver", {
    p_full_name: a.fullName, p_phone: a.phone, p_country: a.country, p_city: a.city, p_address: a.address, p_email: a.email ?? null,
    p_currency: a.currency, p_delivery_method: a.deliveryMethod, p_provider: a.provider ?? null, p_account: a.account ?? null,
    p_id_type: a.idType ?? null, p_id_number: a.idNumber ?? null,
  });
  return mustHaveData(res, "saveReceiver") as string;
}

export async function sendToReceiver(a: { senderId: string; receiverId: string; amount: number; from: string; note?: string; agentId?: string }): Promise<PayoutReceipt> {
  const res = await supabase.rpc("send_to_receiver", { p_sender_id: a.senderId, p_receiver_id: a.receiverId, p_amount: a.amount, p_from: a.from, p_note: a.note ?? null, p_agent_id: a.agentId ?? null });
  const r = ((mustHaveData(res, "sendToReceiver") as Record<string, unknown>[]))[0];
  return { reference: r.reference as string, payoutStatus: r.payout_status as PayoutRow["status"], pickupCode: (r.pickup_code as string) ?? null, receiveAmount: Number(r.receive_amount), toCurrency: r.to_currency as string, receiverName: r.receiver_name as string, deliveryMethod: r.delivery_method as PayoutMethod, agentName: (r.agent_name as string) ?? null, agentAddress: (r.agent_address as string) ?? null };
}

// Demo mode (migration 0039): tops the located area up with sample agents. Best-effort, never blocks the flow.
export async function ensureDemoAgentsNear(a: { country: string; city: string; address: string; lat: number; lng: number }): Promise<void> {
  await supabase.rpc("ensure_demo_agents_near", { p_country: a.country, p_city: a.city, p_address: a.address, p_lat: a.lat, p_lng: a.lng });
}

// PayRus direct and corresponding partner agents near a receiver (migration 0039).
export async function findPayoutAgents(a: { country: string; city: string; lat?: number | null; lng?: number | null; service?: PayoutMethod }): Promise<PayoutAgent[]> {
  const res = await supabase.rpc("find_payout_agents", { p_country: a.country, p_city: a.city, p_lat: a.lat ?? null, p_lng: a.lng ?? null, p_service: a.service ?? "cash_pickup", p_limit: 5 });
  return ((mustNotError(res, "findPayoutAgents") ?? []) as Record<string, unknown>[]).map((r) => ({ ...camelRow<PayoutAgent>(r), distanceKm: r.distance_km == null ? null : Number(r.distance_km) }));
}

// Every pickup point open to the receiver (migration 0043): any PayRus agent in their country, any PayRus direct agent anywhere
// (paid in local currency at the day's rate), plus partner agents within the receiver's monetary zone.
export async function listPickupPoints(a: { country: string; currency: string; lat?: number | null; lng?: number | null }): Promise<PayoutAgent[]> {
  const res = await supabase.rpc("list_pickup_points", { p_country: a.country, p_currency: a.currency, p_lat: a.lat ?? null, p_lng: a.lng ?? null, p_limit: 60 });
  return ((mustNotError(res, "listPickupPoints") ?? []) as Record<string, unknown>[]).map((r) => ({ ...camelRow<PayoutAgent>(r), distanceKm: r.distance_km == null ? null : Number(r.distance_km) }));
}

export interface PayoutOption { method: PayoutMethod; providers: string[]; available: boolean }

// Which payout methods (and providers) are connected in the receiver's country (migration 0044).
export async function getPayoutOptions(country: string): Promise<PayoutOption[]> {
  const res = await supabase.rpc("payout_options", { p_country: country });
  return ((mustNotError(res, "getPayoutOptions") ?? []) as Record<string, unknown>[]).map((r) => ({ method: r.method as PayoutMethod, providers: (r.providers as string[]) ?? [], available: Boolean(r.available) }));
}

export interface ChannelOption { method: PayoutMethod; available: boolean; providers: string[]; feeEur: number; fee: number | null; deliveryTime: string | null; source: string }
export interface ChannelQuote { ok: boolean; blockedReason: string | null; fee: number; fxCost: number; receiveAmount: number; feeEur: number; deliveryTime: string | null; source: string }

// Price and delivery time per payout channel in a country, from the rail partners' contract terms (migration 0047).
export async function getChannelOptions(country: string, from: string, amount?: number): Promise<ChannelOption[]> {
  const res = await supabase.rpc("channel_options", { p_country: country, p_from: from, p_amount: amount ?? null });
  return ((mustNotError(res, "getChannelOptions") ?? []) as Record<string, unknown>[]).map((r) => ({
    method: r.method as PayoutMethod, available: Boolean(r.available), providers: (r.providers as string[]) ?? [], feeEur: Number(r.fee_eur),
    fee: r.fee == null ? null : Number(r.fee), deliveryTime: (r.delivery_time as string) ?? null, source: r.source as string,
  }));
}

// The sender's quote on the selected channel: the fee follows the channel's real contractual cost.
export async function getChannelQuote(a: { from: string; amount: number; country: string; method: PayoutMethod; provider?: string; to?: string; channelType?: string }): Promise<ChannelQuote> {
  const res = await supabase.rpc("channel_quote", { p_from: a.from, p_amount: a.amount, p_country: a.country, p_method: a.method, p_provider: a.provider ?? null, p_to: a.to ?? null, p_channel_type: a.channelType ?? null });
  const r = ((mustNotError(res, "getChannelQuote") ?? []) as Record<string, unknown>[])[0];
  if (!r) throw new Error("getChannelQuote: empty response");
  return { ok: Boolean(r.ok), blockedReason: (r.blocked_reason as string) ?? null, fee: Number(r.fee), fxCost: Number(r.fx_cost), receiveAmount: Number(r.receive_amount), feeEur: Number(r.fee_eur), deliveryTime: (r.delivery_time as string) ?? null, source: r.source as string };
}

export async function listMyPayouts(): Promise<PayoutRow[]> {
  const res = await supabase.rpc("list_my_payouts", { p_limit: 20 });
  return ((mustNotError(res, "listMyPayouts") ?? []) as Record<string, unknown>[]).map((r) => ({
    ...camelRow<PayoutRow>(r), amount: Number(r.amount), receiveAmount: Number(r.receive_amount),
  }));
}

export interface PickupResult { ok: boolean; reason: string | null; receiverName: string | null; amount: number | null; currency: string | null }

// Agent counter (migration 0038): pays out a cash pickup when code and ID number both match.
export async function confirmPickup(code: string, idNumber: string): Promise<PickupResult> {
  const res = await supabase.rpc("payout_confirm_pickup", { p_code: code, p_id_number: idNumber });
  if (res.error) throw new Error(res.error.message);
  const r = ((res.data ?? []) as Record<string, unknown>[])[0];
  return { ok: Boolean(r?.ok), reason: (r?.reason as string) ?? null, receiverName: (r?.receiver_name as string) ?? null, amount: r?.amount == null ? null : Number(r.amount), currency: (r?.currency as string) ?? null };
}

export type CorridorBlockReason = "invalid" | "no_rate" | "suspended" | "not_offered" | "below_min" | "above_max" | "below_floor";
export interface RemittanceQuote {
  ok: boolean; blockedReason: CorridorBlockReason | null; appliedMargin: number; fee: number; fxCost: number;
  receiveAmount: number; totalCostPct: number;
}

// Execution-time price for a corridor, checked against the ops-console guardrails (migration 0033).
export async function getRemittanceQuote(from: string, to: string, amount: number): Promise<RemittanceQuote> {
  const res = await supabase.rpc("remittance_quote", { p_from: from, p_to: to, p_amount: amount });
  const r = ((mustNotError(res, "getRemittanceQuote") ?? []) as Record<string, unknown>[])[0];
  if (!r) throw new Error("getRemittanceQuote: empty response");
  return {
    ok: r.ok as boolean, blockedReason: (r.blocked_reason as CorridorBlockReason) ?? null, appliedMargin: Number(r.applied_margin),
    fee: Number(r.fee), fxCost: Number(r.fx_cost), receiveAmount: Number(r.receive_amount), totalCostPct: Number(r.total_cost_pct),
  };
}

// Runs the guardrail check again server-side, then moves money exactly like applyWalletTransfer.
// Falls back to it when migration 0033 is not applied yet, so the flow keeps working either way.
export async function sendRemittance(args: { userId: string; amount: number; from: string; to: string; note?: string }): Promise<AppTransfer> {
  const res = await supabase.rpc("send_remittance", { p_user_id: args.userId, p_amount: args.amount, p_from: args.from, p_to: args.to, p_note: args.note ?? null });
  if (res.error && /could not find the function|PGRST202/i.test(`${res.error.code ?? ""} ${res.error.message}`)) {
    return applyWalletTransfer({ userId: args.userId, amount: args.amount, currency: args.from, type: "remittance", note: args.note });
  }
  return toAppTransfer(mustHaveData(res, "sendRemittance") as Record<string, unknown>);
}

// Configured, switched-on send->receive pairs (migration 0037). A convenience for the pickers only;
// remittance_quote / send_remittance still enforce the rules.
export async function listOpenCorridors(): Promise<{ from: string; to: string }[]> {
  const res = await supabase.rpc("list_open_corridors");
  return ((mustNotError(res, "listOpenCorridors") ?? []) as Record<string, unknown>[]).map((x) => ({ from: x.from_currency as string, to: x.to_currency as string }));
}

export interface P2pReceipt { reference: string; senderName: string; recipientName: string; amount: number; currency: string }

export async function p2pTransfer(args: {
  senderId: string; recipientId: string; amount: number; currency: string; note?: string;
}): Promise<P2pReceipt> {
  const res = await supabase.rpc("p2p_transfer", {
    p_sender_id: args.senderId, p_recipient_id: args.recipientId, p_amount: args.amount,
    p_currency: args.currency, p_note: args.note ?? null,
  });
  const rows = mustHaveData(res, "p2pTransfer") as Record<string, unknown>[];
  const r = rows[0];
  return { reference: r.reference as string, senderName: (r.sender_name as string) ?? "", recipientName: (r.recipient_name as string) ?? "", amount: Number(r.amount), currency: r.currency as string };
}

export interface RoleDefinition {
  slug: string; kind: "individual" | "organisation"; isAdmin: boolean; sortOrder: number; consoleRole: string;
  family: "individual" | "business" | "institution" | "system" | null;
  templateName: string; templateAccountNumber: string; templateTier: string; templateCurrency: string;
  templateBalance: number; templateBalanceUsd: number;
}

export async function listRoleDefinitions(): Promise<RoleDefinition[]> {
  const res = await supabase.from("role_definitions").select("*").order("sort_order");
  return mustHaveData(res, "listRoleDefinitions").map((r) => ({
    slug: r.slug, kind: r.kind, isAdmin: r.is_admin, sortOrder: r.sort_order, consoleRole: r.console_role, family: (r.family as RoleDefinition["family"]) ?? null,
    templateName: r.template_name, templateAccountNumber: r.template_account_number, templateTier: r.template_tier,
    templateCurrency: r.template_currency, templateBalance: Number(r.template_balance), templateBalanceUsd: Number(r.template_balance_usd),
  }));
}

// ============================================================================
// Addresses (replaces convex/addresses.ts)
// ============================================================================

export async function listAddressesForUser(userId: string): Promise<AppAddress[]> {
  const res = await supabase.from("addresses").select("*").eq("user_id", userId);
  return mustHaveData(res, "listAddressesForUser").map((r) => ({
    id: r.id, userId: r.user_id, street: r.street, houseNumber: r.house_number, city: r.city,
    province: r.province, country: r.country, postalCode: r.postal_code, createdAt: r.created_at,
  }));
}

// ============================================================================
// User roles (replaces convex/userRoles.ts)
// ============================================================================

const ROLE_REQUIRED_FIELDS: Record<"individual" | "organisation", (keyof Omit<AppUserRole, "complete">)[]> = {
  individual: ["phone", "dateOfBirth", "address", "idType"],
  organisation: ["phone", "dateOfBirth", "address", "idType", "orgName", "registrationDocPath", "legalRepName", "legalRepIdType", "legalRepIdNumber", "legalRepPhone"],
};

function roleIsComplete(role: Omit<AppUserRole, "complete">): boolean {
  return ROLE_REQUIRED_FIELDS[role.kind].every((field) => {
    const value = role[field];
    return typeof value === "string" ? value.trim().length > 0 : value != null;
  });
}

export async function listUserRolesForUser(userId: string): Promise<AppUserRole[]> {
  const res = await supabase.from("user_roles").select("*").eq("user_id", userId);
  return mustHaveData(res, "listUserRolesForUser").map((r) => {
    const role: Omit<AppUserRole, "complete"> = {
      id: r.id, userId: r.user_id, role: r.role, kind: r.kind, status: r.status,
      phone: r.phone, dateOfBirth: r.date_of_birth, address: r.address, idType: r.id_type, orgName: r.org_name ?? undefined,
      registrationDocPath: r.registration_doc_path, legalRepName: r.legal_rep_name, legalRepIdType: r.legal_rep_id_type,
      legalRepIdNumber: r.legal_rep_id_number, legalRepPhone: r.legal_rep_phone,
      idFrontDocPath: r.id_front_doc_path, idBackDocPath: r.id_back_doc_path, selfieDocPath: r.selfie_doc_path,
      createdAt: r.created_at,
    };
    return { ...role, complete: roleIsComplete(role) };
  });
}

export async function upsertUserRole(args: {
  userId: string; role: string; kind: "individual" | "organisation"; phone?: string; dateOfBirth?: string;
  address?: string; idType?: string; orgName?: string; registrationDocPath?: string; legalRepName?: string;
  legalRepIdType?: string; legalRepIdNumber?: string; legalRepPhone?: string;
  idFrontDocPath?: string; idBackDocPath?: string; selfieDocPath?: string;
}): Promise<string> {
  const res = await supabase.rpc("upsert_user_role", {
    p_user_id: args.userId, p_role: args.role, p_kind: args.kind, p_phone: args.phone ?? null,
    p_date_of_birth: args.dateOfBirth ?? null, p_address: args.address ?? null, p_id_type: args.idType ?? null,
    p_org_name: args.orgName ?? null, p_registration_doc_path: args.registrationDocPath ?? null,
    p_legal_rep_name: args.legalRepName ?? null, p_legal_rep_id_type: args.legalRepIdType ?? null,
    p_legal_rep_id_number: args.legalRepIdNumber ?? null, p_legal_rep_phone: args.legalRepPhone ?? null,
    p_id_front_doc_path: args.idFrontDocPath ?? null, p_id_back_doc_path: args.idBackDocPath ?? null,
    p_selfie_doc_path: args.selfieDocPath ?? null,
  });
  const row = mustHaveData(res, "upsertUserRole") as Record<string, unknown>;
  return row.id as string;
}

// Convex's generateRegistrationDocUploadUrl had no direct Supabase Storage
// equivalent built in this pass — file upload for the org registration
// document is flagged, not silently dropped, in the migration notes.
// (project root PROGRESS/APP_MIGRATION_NOTES.md)

// ============================================================================
// Wallets / transfers (replaces convex/wallets.ts, financialData.ts)
// ============================================================================

function toAppWallet(r: Record<string, unknown>): AppWallet {
  return {
    id: r.id as string, userId: r.user_id as string, provider: r.provider as string, currency: r.currency as string,
    balance: Number(r.balance_snapshot), asOf: r.as_of as string, isStale: Boolean(r.is_stale),
    flag: r.flag as string, colorClass: r.color_class as string,
  };
}

export async function listWalletViewsForUser(userId: string): Promise<AppWallet[]> {
  const res = await supabase.from("wallet_views").select("*").eq("user_id", userId);
  return mustHaveData(res, "listWalletViewsForUser").map(toAppWallet);
}

function toAppTransfer(r: Record<string, unknown>): AppTransfer {
  // The embedded `quotes` resource (PostgREST relationship syntax, see the
  // two list* queries below) comes back as an object for a to-one FK, but as
  // a single-element array in some PostgREST versions/configurations —
  // handled defensively rather than assuming one shape.
  const quote = Array.isArray(r.quotes) ? r.quotes[0] : r.quotes;
  return {
    id: r.id as string, userId: r.user_id as string, walletViewId: r.wallet_view_id as string, type: r.type as AppTransfer["type"],
    state: r.state as string, amount: Number(r.amount), currency: r.currency as string, partnerTxId: (r.partner_tx_id as string) ?? null,
    reference: r.reference as string, note: (r.note as string) ?? null, createdAt: r.created_at as string,
    fee: quote && typeof quote === "object" && "fee" in quote ? Number((quote as { fee: unknown }).fee) : null,
  };
}

export async function listRecentTransfersForUser(userId: string, limit = 10): Promise<AppTransfer[]> {
  const res = await supabase.from("transfers").select("*, quotes(fee)").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return mustHaveData(res, "listRecentTransfersForUser").map(toAppTransfer);
}

export async function listTransfersForWallet(walletViewId: string): Promise<AppTransfer[]> {
  const res = await supabase.from("transfers").select("*, quotes(fee)").eq("wallet_view_id", walletViewId).order("created_at", { ascending: false });
  return mustHaveData(res, "listTransfersForWallet").map(toAppTransfer);
}

export async function depositToWallet(args: { userId: string; amount: number; currency: string; method?: string; note?: string }): Promise<AppTransfer> {
  const res = await supabase.rpc("deposit_to_wallet", {
    p_user_id: args.userId, p_amount: args.amount, p_currency: args.currency, p_method: args.method ?? null, p_note: args.note ?? null,
  });
  return toAppTransfer(mustHaveData(res, "depositToWallet") as Record<string, unknown>);
}

export async function applyWalletTransfer(args: {
  userId: string; amount: number; currency: string; type: "transfer" | "payment" | "remittance"; note?: string;
}): Promise<AppTransfer> {
  const res = await supabase.rpc("apply_wallet_transfer", {
    p_user_id: args.userId, p_amount: args.amount, p_currency: args.currency, p_type: args.type, p_note: args.note ?? null,
  });
  return toAppTransfer(mustHaveData(res, "applyWalletTransfer") as Record<string, unknown>);
}

export async function convertBetweenWallets(args: {
  userId: string; amount: number; fromCurrency: string; toCurrency: string; note?: string;
}): Promise<{ fromTransfer: AppTransfer; toTransfer: AppTransfer }> {
  const res = await supabase.rpc("convert_between_wallets", {
    p_user_id: args.userId, p_amount: args.amount, p_from_currency: args.fromCurrency, p_to_currency: args.toCurrency, p_note: args.note ?? null,
  });
  const rows = mustHaveData(res, "convertBetweenWallets") as Record<string, unknown>[];
  const row = rows[0];
  return { fromTransfer: toAppTransfer(row.from_transfer as Record<string, unknown>), toTransfer: toAppTransfer(row.to_transfer as Record<string, unknown>) };
}

// ============================================================================
// Cards (replaces convex/cards.ts)
// ============================================================================

export async function listCardsForUser(userId: string): Promise<AppCard[]> {
  // Ordered: without it Postgres returns storage order, which shifts after every update (lock, settings) and moved the selected card.
  const res = await supabase.from("cards").select("*").eq("user_id", userId).order("id");
  return mustHaveData(res, "listCardsForUser").map((r) => ({
    id: r.id, userId: r.user_id, tier: r.tier, brand: r.brand, last4: r.last4, holder: r.holder, expiry: r.expiry,
    balance: Number(r.balance), currency: r.currency, type: r.type, network: r.network, contactless: r.contactless,
    gradient: r.gradient, shimmer: r.shimmer, accentColor: r.accent_color, locked: r.locked,
    monthlySpend: Number(r.monthly_spend), monthlyLimit: Number(r.monthly_limit),
  }));
}

/**
 * Asks the welcome-email Edge Function to send the signed-in tester one informational email. Best effort: it does
 * nothing until an email provider is configured, and a failure here must never affect registration.
 */
export async function sendWelcomeEmail(locale: string): Promise<void> {
  try {
    await supabase.functions.invoke("welcome-email", { body: { locale } });
  } catch {
    /* informational only */
  }
}

// ---- Migration 0065/0066: open a wallet, issue and manage cards, see which wallet a remittance will use ----

export async function createMyWallet(args: { userId: string; currency: string }): Promise<AppWallet> {
  const res = await supabase.rpc("create_my_wallet", { p_user_id: args.userId, p_currency: args.currency });
  return toAppWallet(mustHaveData(res, "createMyWallet") as Record<string, unknown>);
}

/** Currencies PayRus can open a wallet in (they have a reference rate). */
export async function listWalletCurrencies(): Promise<{ code: string; ratePerUsd: number }[]> {
  const res = await supabase.from("currencies").select("code, rate_per_usd").not("rate_per_usd", "is", null).order("code");
  return mustHaveData(res, "listWalletCurrencies").map((r) => ({ code: r.code as string, ratePerUsd: Number(r.rate_per_usd) }));
}

function toAppCard(r: Record<string, unknown>): AppCard {
  return {
    id: r.id as string, userId: r.user_id as string, tier: r.tier as string, brand: r.brand as string, last4: r.last4 as string, holder: r.holder as string,
    expiry: r.expiry as string, balance: Number(r.balance), currency: r.currency as string, type: r.type as string, network: r.network as string,
    contactless: Boolean(r.contactless), gradient: r.gradient as string, shimmer: r.shimmer as string, accentColor: r.accent_color as string,
    locked: Boolean(r.locked), monthlySpend: Number(r.monthly_spend), monthlyLimit: Number(r.monthly_limit),
  };
}

export async function issueCard(args: { userId: string; currency: string; monthlyLimit: number }): Promise<AppCard> {
  const res = await supabase.rpc("issue_card", { p_user_id: args.userId, p_currency: args.currency, p_monthly_limit: args.monthlyLimit });
  return toAppCard(mustHaveData(res, "issueCard") as Record<string, unknown>);
}

export async function setCardLocked(args: { userId: string; cardId: string; locked: boolean }): Promise<AppCard> {
  const res = await supabase.rpc("set_card_locked", { p_user_id: args.userId, p_card_id: args.cardId, p_locked: args.locked });
  return toAppCard(mustHaveData(res, "setCardLocked") as Record<string, unknown>);
}

export async function updateCardSettings(args: { userId: string; cardId: string; monthlyLimit: number; contactless: boolean }): Promise<AppCard> {
  const res = await supabase.rpc("update_card_settings", { p_user_id: args.userId, p_card_id: args.cardId, p_monthly_limit: args.monthlyLimit, p_contactless: args.contactless });
  return toAppCard(mustHaveData(res, "updateCardSettings") as Record<string, unknown>);
}

export interface RemittancePayFrom { walletCurrency: string; balance: number; debit: number; sufficient: boolean; sameCurrency: boolean; fee: number }

/** Which wallet a remittance would be debited from, how much, and whether the balance covers it (same selection as the send). */
export async function getRemittancePayFrom(args: { userId: string; from: string; to: string; amount: number }): Promise<RemittancePayFrom | null> {
  const res = await supabase.rpc("remittance_pay_from", { p_user_id: args.userId, p_from: args.from, p_to: args.to, p_amount: args.amount });
  if (res.error) throw new Error(res.error.message);
  const r = ((res.data ?? [])[0] ?? null) as Record<string, unknown> | null;
  if (!r) return null;
  return { walletCurrency: r.wallet_currency as string, balance: Number(r.balance), debit: Number(r.debit), sufficient: Boolean(r.sufficient), sameCurrency: Boolean(r.same_currency), fee: Number(r.fee) };
}

// ============================================================================
// Linked payment methods (replaces convex/linkedPaymentMethods.ts) — direct
// table access, RLS's "owner_key or user" policy handles both the
// anonymous-before-login and signed-in cases without an RPC.
// ============================================================================

export async function listLinkedPaymentMethods(ownerKey: string): Promise<LinkedPaymentMethod[]> {
  const res = await supabase.from("linked_payment_methods").select("*").eq("owner_key", ownerKey);
  return mustHaveData(res, "listLinkedPaymentMethods").map((r) => ({
    id: r.id, ownerKey: r.owner_key, provider: r.provider, label: r.label, status: r.status, createdAt: r.created_at,
  }));
}

export async function addLinkedPaymentMethod(args: {
  ownerKey: string; provider: LinkedPaymentMethod["provider"]; label: string;
}): Promise<string> {
  // RPC, not a plain insert: the audit trigger on this table fails under the caller's RLS (migration 0061).
  const res = await supabase.rpc("add_linked_payment_method", {
    p_owner_key: args.ownerKey, p_provider: args.provider, p_label: args.label,
  });
  return mustHaveData(res, "addLinkedPaymentMethod") as string;
}

export async function seedDefaultLinkedPaymentMethods(ownerKey: string): Promise<void> {
  const res = await supabase.rpc("seed_default_linked_payment_methods", { p_owner_key: ownerKey });
  mustHaveData(res, "seedDefaultLinkedPaymentMethods");
}

// ============================================================================
// Marketplace / shop orders (replaces convex/marketplacePartners.ts,
// shopOrders.ts) — direct table access.
// ============================================================================

export async function listMarketplacePartners(): Promise<MarketplacePartner[]> {
  const res = await supabase.from("marketplace_partners").select("*, marketplace_partner_items(name, price)");
  return mustHaveData(res, "listMarketplacePartners").map((r) => ({
    id: r.id, slug: r.slug, name: r.name, category: r.category, emoji: r.emoji, promoted: r.promoted,
    discountPercent: r.discount_percent == null ? null : Number(r.discount_percent), rating: Number(r.rating),
    items: (r.marketplace_partner_items ?? []).map((i: { name: string; price: number }) => ({ name: i.name, price: Number(i.price) })),
  }));
}

export async function createShopOrder(args: {
  ownerKey: string; partnerSlug: string; partnerName: string; subtotal: number; discountAmount: number;
  payrusFee: number; partnerCommission: number; total: number; method: string; reference: string;
}): Promise<string> {
  const partner = await supabase.from("marketplace_partners").select("id").eq("slug", args.partnerSlug).maybeSingle();
  const res = await supabase.from("shop_orders").insert({
    owner_key: args.ownerKey, partner_id: partner.data?.id ?? null, partner_name: args.partnerName,
    subtotal: args.subtotal, discount_amount: args.discountAmount, payrus_fee: args.payrusFee,
    partner_commission: args.partnerCommission, total: args.total, method: args.method, reference: args.reference,
  }).select("id").single();
  return mustHaveData(res, "createShopOrder").id;
}

// ============================================================================
// Admin panel (replaces convex/admin.ts, testUsers.ts) — same deliberately
// unrestricted access as the Convex version, see 0006's own header comment.
// ============================================================================

export interface AdminUserRow { user: AppUser; roles: AppUserRole[]; wallets: AppWallet[]; cards: AppCard[] }

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const res = await supabase.rpc("admin_list_users");
  return mustHaveData(res, "adminListUsers").map((r: Record<string, unknown>) => ({
    user: toAppUser(r.user_data as Record<string, unknown>),
    roles: (r.roles as Record<string, unknown>[]).map((role) => {
      const base: Omit<AppUserRole, "complete"> = {
        id: role.id as string, userId: role.user_id as string, role: role.role as string, kind: role.kind as AppUserRole["kind"],
        status: role.status as AppUserRole["status"], phone: (role.phone as string) ?? null, dateOfBirth: (role.date_of_birth as string) ?? null,
        address: (role.address as string) ?? null, idType: (role.id_type as string) ?? null, orgName: (role.org_name as string) ?? undefined,
        registrationDocPath: (role.registration_doc_path as string) ?? null, legalRepName: (role.legal_rep_name as string) ?? null,
        legalRepIdType: (role.legal_rep_id_type as string) ?? null, legalRepIdNumber: (role.legal_rep_id_number as string) ?? null,
        legalRepPhone: (role.legal_rep_phone as string) ?? null,
        idFrontDocPath: (role.id_front_doc_path as string) ?? null, idBackDocPath: (role.id_back_doc_path as string) ?? null,
        selfieDocPath: (role.selfie_doc_path as string) ?? null, createdAt: role.created_at as string,
      };
      return { ...base, complete: roleIsComplete(base) };
    }),
    wallets: (r.wallets as Record<string, unknown>[]).map(toAppWallet),
    cards: (r.cards as Record<string, unknown>[]).map((c) => ({
      id: c.id as string, userId: c.user_id as string, tier: c.tier as string, brand: c.brand as string, last4: c.last4 as string,
      holder: c.holder as string, expiry: c.expiry as string, balance: Number(c.balance), currency: c.currency as string,
      type: c.type as string, network: c.network as string, contactless: c.contactless as boolean, gradient: c.gradient as string,
      shimmer: c.shimmer as string, accentColor: c.accent_color as string, locked: c.locked as boolean,
      monthlySpend: Number(c.monthly_spend), monthlyLimit: Number(c.monthly_limit),
    })),
  }));
}

export async function adminUpdateUserRole(args: {
  roleId: string; status?: AppUserRole["status"]; phone?: string; dateOfBirth?: string; address?: string; idType?: string;
  orgName?: string; legalRepName?: string; legalRepIdType?: string; legalRepIdNumber?: string; legalRepPhone?: string;
}): Promise<void> {
  const res = await supabase.rpc("admin_update_user_role", {
    p_role_id: args.roleId, p_status: args.status ?? null, p_phone: args.phone ?? null, p_date_of_birth: args.dateOfBirth ?? null,
    p_address: args.address ?? null, p_id_type: args.idType ?? null, p_org_name: args.orgName ?? null,
    p_legal_rep_name: args.legalRepName ?? null, p_legal_rep_id_type: args.legalRepIdType ?? null,
    p_legal_rep_id_number: args.legalRepIdNumber ?? null, p_legal_rep_phone: args.legalRepPhone ?? null,
  });
  mustHaveData(res, "adminUpdateUserRole");
}

export async function adminUpdateUser(args: {
  userId: string; name?: string; phone?: string; country?: string; defaultCurrency?: string; kycStatus?: AppUser["kycStatus"];
}): Promise<void> {
  const res = await supabase.rpc("admin_update_user", {
    p_user_id: args.userId, p_name: args.name ?? null, p_phone: args.phone ?? null, p_country: args.country ?? null,
    p_default_currency: args.defaultCurrency ?? null, p_kyc_status: args.kycStatus ?? null,
  });
  mustHaveData(res, "adminUpdateUser");
}

export interface AdminTransfer {
  id: string; reference: string; type: string; state: string; amount: number; currency: string; note: string | null;
  userId: string; userName: string | null; userEmail: string | null; createdAt: string;
}

export async function adminListTransfers(limit = 300, userId?: string): Promise<AdminTransfer[]> {
  const res = await supabase.rpc("admin_list_transfers", { p_limit: limit, p_user_id: userId ?? null });
  return mustHaveData(res, "adminListTransfers").map((r: Record<string, unknown>) => ({
    id: r.transfer_id as string, reference: r.reference as string, type: r.type as string, state: r.state as string,
    amount: Number(r.amount), currency: r.currency as string, note: (r.note as string) ?? null, userId: r.user_id as string,
    userName: (r.user_name as string) ?? null, userEmail: (r.user_email as string) ?? null, createdAt: r.created_at as string,
  }));
}

export interface MyPermissions {
  isSuperadmin: boolean;
  /** admin OR superadmin — unlocks the admin-tier tabs (audit log, access, configuration). */
  isAdmin: boolean;
  users: { create: boolean; read: boolean; update: boolean; delete: boolean };
  transactions: { create: boolean; read: boolean; update: boolean; delete: boolean };
}

export async function getMyPermissions(): Promise<MyPermissions> {
  const res = await supabase.rpc("my_permissions");
  const rows = mustHaveData(res, "getMyPermissions") as Record<string, unknown>[];
  const pick = (resource: string) => {
    const r = rows.find((x) => x.resource === resource);
    return { create: Boolean(r?.can_create), read: Boolean(r?.can_read), update: Boolean(r?.can_update), delete: Boolean(r?.can_delete) };
  };
  return { isSuperadmin: rows.some((r) => Boolean(r.is_superadmin)), isAdmin: rows.some((r) => Boolean(r.is_admin)), users: pick("users"), transactions: pick("transactions") };
}

export interface SupportRole { slug: string; label: string; description: string }
export interface SupportPermissionRow { roleSlug: string; resource: "users" | "transactions"; create: boolean; read: boolean; update: boolean; delete: boolean }

export async function listSupportRoles(): Promise<SupportRole[]> {
  const res = await supabase.from("support_roles").select("*").order("sort_order");
  return mustHaveData(res, "listSupportRoles").map((r) => ({ slug: r.slug, label: r.label, description: r.description }));
}

export async function listSupportPermissions(): Promise<SupportPermissionRow[]> {
  const res = await supabase.from("support_permissions").select("*");
  return mustHaveData(res, "listSupportPermissions").map((r) => ({
    roleSlug: r.role_slug, resource: r.resource, create: r.can_create, read: r.can_read, update: r.can_update, delete: r.can_delete,
  }));
}

export async function adminSetSupportPermission(args: SupportPermissionRow & { password: string }): Promise<void> {
  const res = await supabase.rpc("admin_set_support_permission", {
    p_role_slug: args.roleSlug, p_resource: args.resource, p_create: args.create, p_read: args.read,
    p_update: args.update, p_delete: args.delete, p_password: args.password,
  });
  mustHaveData(res, "adminSetSupportPermission");
}

export async function adminAssignStaffRole(args: { userId: string; roleSlug: string; password: string }): Promise<void> {
  const res = await supabase.rpc("admin_assign_staff_role", { p_user_id: args.userId, p_role_slug: args.roleSlug, p_password: args.password });
  mustHaveData(res, "adminAssignStaffRole");
}

export async function adminRevokeStaffRole(args: { userId: string; roleSlug: string; password: string }): Promise<void> {
  const res = await supabase.rpc("admin_revoke_staff_role", { p_user_id: args.userId, p_role_slug: args.roleSlug, p_password: args.password });
  if (res.error) throw new Error(`adminRevokeStaffRole: ${res.error.message}`);
}

export async function supportCompleteTransfer(args: { transferId: string; note?: string }): Promise<void> {
  const res = await supabase.rpc("support_complete_transfer", { p_transfer_id: args.transferId, p_note: args.note ?? null });
  mustHaveData(res, "supportCompleteTransfer");
}

export async function supportResolveTransfer(args: { transferId: string; newState: string; note?: string }): Promise<void> {
  const res = await supabase.rpc("support_resolve_transfer", { p_transfer_id: args.transferId, p_new_state: args.newState, p_note: args.note ?? null });
  mustHaveData(res, "supportResolveTransfer");
}

export async function supportVoidTransfer(args: { transferId: string; note: string; password: string }): Promise<void> {
  const res = await supabase.rpc("support_void_transfer", { p_transfer_id: args.transferId, p_note: args.note, p_password: args.password });
  mustHaveData(res, "supportVoidTransfer");
}

export async function supportCreateAdjustment(args: { userId: string; amount: number; currency: string; reason: string }): Promise<void> {
  const res = await supabase.rpc("support_create_adjustment", { p_user_id: args.userId, p_amount: args.amount, p_currency: args.currency, p_reason: args.reason });
  mustHaveData(res, "supportCreateAdjustment");
}

export type EscalationAction = "complete" | "refund" | "close_dispute" | "void" | "adjustment" | "profile_edit" | "other";

export interface AdminEscalation {
  id: string; action: EscalationAction; details: string; status: "open" | "done" | "approved" | "rejected";
  resolutionNote: string | null; amount: number | null; currency: string | null; transferId: string | null;
  transferReference: string | null; targetUserId: string; targetName: string | null; targetEmail: string | null;
  requestedBy: string; requesterName: string | null; createdAt: string; resolvedAt: string | null;
}

export async function adminListEscalations(): Promise<AdminEscalation[]> {
  const res = await supabase.rpc("admin_list_escalations");
  return mustHaveData(res, "adminListEscalations").map((r: Record<string, unknown>) => ({
    id: r.id as string, action: r.action as EscalationAction, details: r.details as string, status: r.status as AdminEscalation["status"],
    resolutionNote: (r.resolution_note as string) ?? null, amount: r.amount == null ? null : Number(r.amount), currency: (r.currency as string) ?? null,
    transferId: (r.transfer_id as string) ?? null, transferReference: (r.transfer_reference as string) ?? null,
    targetUserId: r.target_user_id as string, targetName: (r.target_name as string) ?? null, targetEmail: (r.target_email as string) ?? null,
    requestedBy: r.requested_by as string, requesterName: (r.requester_name as string) ?? null,
    createdAt: r.created_at as string, resolvedAt: (r.resolved_at as string) ?? null,
  }));
}

export async function supportRequestEscalation(args: {
  targetUserId: string; action: EscalationAction; details: string; transferId?: string; amount?: number; currency?: string;
}): Promise<void> {
  const res = await supabase.rpc("support_request_escalation", {
    p_target_user_id: args.targetUserId, p_action: args.action, p_details: args.details,
    p_transfer_id: args.transferId ?? null, p_amount: args.amount ?? null, p_currency: args.currency ?? null,
  });
  mustHaveData(res, "supportRequestEscalation");
}

export async function adminResolveEscalation(args: { escalationId: string; decision: "approve" | "reject" | "done"; note?: string; password?: string }): Promise<void> {
  const res = await supabase.rpc("admin_resolve_escalation", { p_escalation_id: args.escalationId, p_decision: args.decision, p_note: args.note ?? null, p_password: args.password ?? null });
  mustHaveData(res, "adminResolveEscalation");
}

// ---- Operations visibility + audit trail (0021 / 0026) — same RPCs the
// ops-console Configuration screen reads, so an admin sees identical data in
// both apps. Rows come back camelCased.
const camelKey = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export async function adminRpcRows<T>(name: string, args?: Record<string, unknown>): Promise<T[]> {
  const res = await supabase.rpc(name, args);
  const rows = (mustHaveData(res, name) as Record<string, unknown>[]);
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [camelKey(k), v])) as T);
}

export interface OpsExpenseReport { id: string; title: string; amount: number; currency: string; category: string; status: string; employeeName: string | null; project: string | null; submittedAt: string; userName: string | null; userEmail: string | null }
export interface OpsCorporateCard { id: string; holderName: string; role: string; limitAmount: number; spentAmount: number; currency: string; ownerName: string | null; ownerEmail: string | null }
export interface OpsLoyaltyAccount { id: string; venueName: string; points: number; currency: string; monthlySpend: number; cashbackRate: number; userName: string | null; userEmail: string | null }
export interface OpsGameBet { id: string; kind: string; stakeAmount: number; currency: string; status: string; payoutAmount: number | null; placedAt: string; userName: string | null; userEmail: string | null }
export interface OpsTontineMember { circleId: string; circleName: string; memberPosition: number; joinedAt: string; userName: string | null; userEmail: string | null }
export interface OpsPitch { id: string; title: string; category: string | null; goal: number; raised: number; currency: string; risk: string; createdAt: string; ownerName: string | null; ownerEmail: string | null }

export async function adminResolveExpenseReport(args: { reportId: string; status: "approved" | "rejected"; password: string }): Promise<void> {
  const res = await supabase.rpc("resolve_expense_report", { p_report_id: args.reportId, p_status: args.status, p_admin_password: args.password });
  mustHaveData(res, "adminResolveExpenseReport");
}

export interface AuditEvent {
  seq: number; occurredAt: string; actorName: string | null; actorEmail: string | null; actorLabel: string; action: string;
  objectTable: string; objectId: string | null; reason: string | null; beforeData: unknown; afterData: unknown;
}

export async function adminListAuditEvents(objectTable?: string): Promise<AuditEvent[]> {
  return adminRpcRows<AuditEvent>("admin_list_audit_events", { p_limit: 200, p_object_table: objectTable ?? null });
}

export async function adminSetGatePassword(args: { current: string; next: string }): Promise<void> {
  const res = await supabase.rpc("admin_set_gate_password", { p_gate: "admin", p_current: args.current, p_new: args.next });
  if (res.error) throw new Error(`adminSetGatePassword: ${res.error.message}`);
}

// ---- AI-assisted escalation triage (0027 + convex/aiSupportAssist.ts) ----

export type TriageAction = "approve" | "reject" | "request_info";
export interface AiSuggestion {
  id: string; escalationId: string; source: "ai" | "rules"; model: string | null; priority: "low" | "medium" | "high" | "urgent";
  category: string; summary: string; recommendedAction: TriageAction; rationale: string; draftReply: string;
  confidence: number; status: "suggested" | "used" | "dismissed"; createdAt: string; createdByName?: string | null;
}

const toSuggestion = (r: Record<string, unknown>): AiSuggestion => {
  const c = Object.fromEntries(Object.entries(r).map(([k, v]) => [camelKey(k), v])) as Record<string, unknown>;
  return { ...(c as unknown as AiSuggestion), confidence: Number(c.confidence) };
};

export async function listAiSuggestions(): Promise<AiSuggestion[]> {
  const res = await supabase.rpc("support_list_ai_suggestions");
  return (mustHaveData(res, "listAiSuggestions") as Record<string, unknown>[]).map(toSuggestion);
}

export async function markAiSuggestion(id: string, status: "used" | "dismissed"): Promise<void> {
  const res = await supabase.rpc("support_mark_ai_suggestion", { p_suggestion_id: id, p_status: status });
  if (res.error) throw new Error(`markAiSuggestion: ${res.error.message}`);
}

// Tries the AI endpoint first (Claude, run server-side by Convex with the
// caller's own session); if it is not configured or unavailable, falls back to
// the deterministic in-database rules triage so the workflow always works.
export async function runTriage(escalationId: string): Promise<{ suggestion: AiSuggestion; via: "ai" | "rules"; fallbackReason?: string }> {
  const site = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  let fallbackReason = "AI is not configured";
  if (site) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const res = await fetch(`${site}/aiSupportAssist`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ escalationId }),
        });
        const body = (await res.json().catch(() => ({}))) as { suggestion?: Record<string, unknown>; error?: string; message?: string };
        if (res.ok && body.suggestion) return { suggestion: toSuggestion(body.suggestion), via: "ai" };
        if (res.status === 403 || res.status === 401) throw new Error(body.message ?? "Not permitted");
        fallbackReason = body.error === "not_configured" ? "AI is not configured" : "AI is unavailable";
      }
    } catch (e) {
      if (e instanceof Error && /permitted|permission|forbidden/i.test(e.message)) throw e;
      fallbackReason = "AI is unreachable";
    }
  }
  const res = await supabase.rpc("support_rules_triage", { p_escalation_id: escalationId });
  const row = mustHaveData(res, "runTriage") as Record<string, unknown>;
  return { suggestion: toSuggestion(row), via: "rules", fallbackReason };
}

export async function adminCreateUser(args: {
  name: string; email: string; role: string; kind: "individual" | "organisation"; password?: string;
}): Promise<{ userId: string; roleId: string; alreadyExisted: boolean }> {
  const res = await supabase.rpc("admin_create_user", { p_name: args.name, p_email: args.email, p_role: args.role, p_kind: args.kind, p_password: args.password ?? null });
  const row = (mustHaveData(res, "adminCreateUser") as Record<string, unknown>[])[0];
  return { userId: row.user_id as string, roleId: row.role_id as string, alreadyExisted: row.already_existed as boolean };
}

export async function adminGrantAdminRole(args: { userId: string; password: string }): Promise<string> {
  const res = await supabase.rpc("admin_grant_admin_role", { p_user_id: args.userId, p_password: args.password });
  return (mustHaveData(res, "adminGrantAdminRole") as Record<string, unknown>).id as string;
}

export interface FxMarginConfig {
  id: string;
  marginRate: number;
  commissionRate: number;
  decider: string;
  note: string | null;
  effectiveFrom: string;
}

function toFxMarginConfig(r: Record<string, unknown>): FxMarginConfig {
  return {
    id: r.id as string, marginRate: Number(r.margin_rate), commissionRate: Number(r.commission_rate),
    decider: r.decider as string, note: (r.note as string) ?? null, effectiveFrom: r.effective_from as string,
  };
}

export async function getCurrentFxMarginConfig(): Promise<FxMarginConfig | null> {
  const res = await supabase.from("fx_margin_config_current").select("*").maybeSingle();
  const row = mustNotError(res, "getCurrentFxMarginConfig");
  return row ? toFxMarginConfig(row as Record<string, unknown>) : null;
}

// Password-gated the same way admin_grant_admin_role/admin_create_user's
// admin-role path already are — see 0013_fx_margin_config_and_live_rates.sql
// for why this reuses that gate rather than a separate "super admin" role.
export async function updateFxMarginConfig(args: {
  marginRate: number; commissionRate: number; decider: string; note?: string; password: string;
}): Promise<FxMarginConfig> {
  const res = await supabase.rpc("update_fx_margin_config", {
    p_margin_rate: args.marginRate, p_commission_rate: args.commissionRate,
    p_decider: args.decider, p_note: args.note ?? null, p_password: args.password,
  });
  return toFxMarginConfig(mustHaveData(res, "updateFxMarginConfig") as Record<string, unknown>);
}

export interface AppCurrency {
  code: string;
  ratePerUsd: number | null;
}

export async function listCurrenciesByCode(codes: string[]): Promise<AppCurrency[]> {
  const res = await supabase.from("currencies").select("code, rate_per_usd").in("code", codes);
  return mustHaveData(res, "listCurrenciesByCode").map((r) => ({ code: r.code as string, ratePerUsd: r.rate_per_usd === null ? null : Number(r.rate_per_usd) }));
}

export async function getCurrencyForCountry(countryCode: string): Promise<string | null> {
  const res = await supabase.from("countries").select("currency").eq("code", countryCode.toUpperCase()).maybeSingle();
  const row = mustNotError(res, "getCurrencyForCountry") as { currency: string } | null;
  return row?.currency ?? null;
}

export interface FxRateUpdate {
  source: string;
  currenciesUpdated: number;
  fetchedAt: string;
}

export async function getLastFxRateUpdate(): Promise<FxRateUpdate | null> {
  const res = await supabase.from("fx_rate_updates").select("*").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  const row = mustNotError(res, "getLastFxRateUpdate") as Record<string, unknown> | null;
  return row ? { source: row.source as string, currenciesUpdated: row.currencies_updated as number, fetchedAt: row.fetched_at as string } : null;
}

export interface BlockedTransfer {
  transferId: string;
  reference: string;
  state: string;
  amount: number;
  currency: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

export async function adminListBlockedTransfers(): Promise<BlockedTransfer[]> {
  const res = await supabase.rpc("admin_list_blocked_transfers");
  return mustHaveData(res, "adminListBlockedTransfers").map((r: Record<string, unknown>) => ({
    transferId: r.transfer_id as string, reference: r.reference as string, state: r.state as string,
    amount: Number(r.amount), currency: r.currency as string,
    userName: (r.user_name as string) ?? null, userEmail: (r.user_email as string) ?? null, createdAt: r.created_at as string,
  }));
}

export async function adminResolveTransfer(args: {
  transferId: string; newState: string; reason?: string; password: string;
}): Promise<void> {
  const res = await supabase.rpc("admin_resolve_transfer", {
    p_transfer_id: args.transferId, p_new_state: args.newState, p_reason: args.reason ?? null, p_password: args.password,
  });
  mustHaveData(res, "adminResolveTransfer");
}

export interface PendingProfile {
  roleId: string;
  userId: string;
  role: string;
  status: string;
  kind: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

export async function adminListPendingProfiles(): Promise<PendingProfile[]> {
  const res = await supabase.rpc("admin_list_pending_profiles");
  return mustHaveData(res, "adminListPendingProfiles").map((r: Record<string, unknown>) => ({
    roleId: r.role_id as string, userId: r.user_id as string, role: r.role as string, status: r.status as string, kind: r.kind as string,
    userName: (r.user_name as string) ?? null, userEmail: (r.user_email as string) ?? null, createdAt: r.created_at as string,
  }));
}

export async function adminBackfillCardHolders(): Promise<number> {
  const res = await supabase.rpc("admin_backfill_card_holders");
  return mustHaveData(res, "adminBackfillCardHolders") as number;
}

export async function testUsersCleanup(): Promise<number> {
  const res = await supabase.rpc("test_users_cleanup");
  return mustHaveData(res, "testUsersCleanup") as number;
}

// ============================================================================
// Roles & Access — supabase/migrations/0014_role_access_management.sql.
// Reassigning/removing a role, and the DB-driven feature-visibility tables
// that replace AppLayout.tsx's/ops-console Console.tsx's hardcoded nav
// gating (profile_features for this app, console_role_tabs for ops-console —
// both editable from the same admin screen here, since this app already has
// the one Supabase client both apps share).
// ============================================================================

export async function adminReassignUserRole(args: {
  roleId: string; newRole: string; password: string;
}): Promise<{ id: string; role: string }> {
  const res = await supabase.rpc("admin_reassign_user_role", {
    p_role_id: args.roleId, p_new_role: args.newRole, p_password: args.password,
  });
  const row = mustHaveData(res, "adminReassignUserRole") as Record<string, unknown>;
  return { id: row.id as string, role: row.role as string };
}

export async function adminRemoveUserRole(args: { roleId: string; password: string }): Promise<void> {
  const res = await supabase.rpc("admin_remove_user_role", { p_role_id: args.roleId, p_password: args.password });
  if (res.error) throw new Error(`adminRemoveUserRole: ${res.error.message}`);
}

export async function getProfileFeatures(profileType: string): Promise<string[]> {
  const res = await supabase.from("profile_features").select("feature_key").eq("profile_type", profileType);
  return mustHaveData(res, "getProfileFeatures").map((r) => r.feature_key as string);
}

export async function adminSetProfileFeatures(args: {
  profileType: string; featureKeys: string[]; password: string;
}): Promise<void> {
  const res = await supabase.rpc("admin_set_profile_features", {
    p_profile_type: args.profileType, p_feature_keys: args.featureKeys, p_password: args.password,
  });
  if (res.error) throw new Error(`adminSetProfileFeatures: ${res.error.message}`);
}

export async function adminSetConsoleRoleTabs(args: {
  role: string; tabKeys: string[]; password: string;
}): Promise<void> {
  const res = await supabase.rpc("admin_set_console_role_tabs", {
    p_role: args.role, p_tab_keys: args.tabKeys, p_password: args.password,
  });
  if (res.error) throw new Error(`adminSetConsoleRoleTabs: ${res.error.message}`);
}

// ============================================================================
// Notifications / payment links — supabase/migrations/0015_notifications_and_
// payment_links.sql. Notifications are generated server-side (an additive
// `perform create_notification(...)` inside deposit_to_wallet/apply_wallet_
// transfer/convert_between_wallets), never inserted directly from here.
// ============================================================================

export interface AppNotification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

function toAppNotification(r: Record<string, unknown>): AppNotification {
  return {
    id: r.id as string, userId: r.user_id as string, kind: r.kind as string,
    title: r.title as string, body: r.body as string, read: Boolean(r.read), createdAt: r.created_at as string,
  };
}

export async function listNotificationsForUser(userId: string): Promise<AppNotification[]> {
  const res = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return mustHaveData(res, "listNotificationsForUser").map(toAppNotification);
}

export async function markNotificationRead(notificationId: string): Promise<AppNotification> {
  const res = await supabase.rpc("mark_notification_read", { p_notification_id: notificationId });
  return toAppNotification(mustHaveData(res, "markNotificationRead") as Record<string, unknown>);
}

export interface AppPaymentLink {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  note: string | null;
  slug: string;
  status: "active" | "redeemed" | "expired";
  createdAt: string;
}

function toAppPaymentLink(r: Record<string, unknown>): AppPaymentLink {
  return {
    id: r.id as string, userId: r.user_id as string, amount: Number(r.amount), currency: r.currency as string,
    note: (r.note as string) ?? null, slug: r.slug as string, status: r.status as AppPaymentLink["status"], createdAt: r.created_at as string,
  };
}

export async function createPaymentLink(args: { userId: string; amount: number; currency: string; note?: string }): Promise<AppPaymentLink> {
  const res = await supabase.rpc("create_payment_link", {
    p_user_id: args.userId, p_amount: args.amount, p_currency: args.currency, p_note: args.note ?? null,
  });
  return toAppPaymentLink(mustHaveData(res, "createPaymentLink") as Record<string, unknown>);
}

export async function listPaymentLinksForUser(userId: string): Promise<AppPaymentLink[]> {
  const res = await supabase.from("payment_links").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return mustHaveData(res, "listPaymentLinksForUser").map(toAppPaymentLink);
}

export async function getPaymentLinkBySlug(slug: string): Promise<AppPaymentLink | null> {
  const res = await supabase.rpc("get_payment_link_by_slug", { p_slug: slug });
  const row = mustNotError(res, "getPaymentLinkBySlug") as Record<string, unknown> | null;
  return row ? toAppPaymentLink(row) : null;
}

export async function redeemPaymentLink(args: { slug: string; payerUserId: string }): Promise<AppTransfer> {
  const res = await supabase.rpc("redeem_payment_link", { p_slug: args.slug, p_payer_user_id: args.payerUserId });
  return toAppTransfer(mustHaveData(res, "redeemPaymentLink") as Record<string, unknown>);
}

// ============================================================================
// Bills — supabase/migrations/0016. Paying a bill reuses applyWalletTransfer
// directly from the frontend (type "payment"), no dedicated RPC here.
// ============================================================================

export interface AppBiller {
  id: string;
  name: string;
  meta: string | null;
  category: string | null;
  currency: string;
}

export async function listBillBillers(): Promise<AppBiller[]> {
  const res = await supabase.from("bill_billers").select("*");
  return mustHaveData(res, "listBillBillers").map((r) => ({
    id: r.id as string, name: r.name as string, meta: (r.meta as string) ?? null,
    category: (r.category as string) ?? null, currency: r.currency as string,
  }));
}

export interface AppBillSubscription {
  userId: string;
  billerId: string;
  autoPay: boolean;
  paused: boolean;
}

export async function listBillSubscriptionsForUser(userId: string): Promise<AppBillSubscription[]> {
  const res = await supabase.from("bill_subscriptions").select("*").eq("user_id", userId);
  return mustHaveData(res, "listBillSubscriptionsForUser").map((r) => ({
    userId: r.user_id as string, billerId: r.biller_id as string, autoPay: Boolean(r.auto_pay), paused: Boolean(r.paused),
  }));
}

export async function upsertBillSubscription(args: {
  userId: string; billerId: string; autoPay?: boolean; paused?: boolean;
}): Promise<AppBillSubscription> {
  const res = await supabase.rpc("upsert_bill_subscription", {
    p_user_id: args.userId, p_biller_id: args.billerId, p_auto_pay: args.autoPay ?? null, p_paused: args.paused ?? null,
  });
  const row = mustHaveData(res, "upsertBillSubscription") as Record<string, unknown>;
  return { userId: row.user_id as string, billerId: row.biller_id as string, autoPay: Boolean(row.auto_pay), paused: Boolean(row.paused) };
}

// ============================================================================
// Payouts — supabase/migrations/0016. create_payout_batch debits the
// owner's wallet via the existing apply_wallet_transfer RPC internally.
// ============================================================================

export interface AppPayoutItem { id: string; batchId: string; recipientLabel: string; amount: number }
export interface AppPayoutBatch {
  id: string;
  ownerUserId: string;
  label: string;
  currency: string;
  totalAmount: number;
  status: "open" | "pending" | "settled";
  createdAt: string;
}

function toAppPayoutBatch(r: Record<string, unknown>): AppPayoutBatch {
  return {
    id: r.id as string, ownerUserId: r.owner_user_id as string, label: r.label as string, currency: r.currency as string,
    totalAmount: Number(r.total_amount), status: r.status as AppPayoutBatch["status"], createdAt: r.created_at as string,
  };
}

export async function listPayoutBatchesForUser(userId: string): Promise<AppPayoutBatch[]> {
  const res = await supabase.from("payout_batches").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false });
  return mustHaveData(res, "listPayoutBatchesForUser").map(toAppPayoutBatch);
}

export async function listPayoutItems(batchId: string): Promise<AppPayoutItem[]> {
  const res = await supabase.from("payout_items").select("*").eq("batch_id", batchId);
  return mustHaveData(res, "listPayoutItems").map((r) => ({
    id: r.id as string, batchId: r.batch_id as string, recipientLabel: r.recipient_label as string, amount: Number(r.amount),
  }));
}

export async function createPayoutBatch(args: {
  userId: string; label: string; currency: string; items: { recipientLabel: string; amount: number }[]; note?: string;
}): Promise<AppPayoutBatch> {
  const res = await supabase.rpc("create_payout_batch", {
    p_user_id: args.userId, p_label: args.label, p_currency: args.currency,
    p_items: args.items.map((i) => ({ recipient_label: i.recipientLabel, amount: i.amount })), p_note: args.note ?? null,
  });
  return toAppPayoutBatch(mustHaveData(res, "createPayoutBatch") as Record<string, unknown>);
}

// ============================================================================
// Groups — supabase/migrations/0016. Members are real registered users,
// found via the existing resolve_email_by_identifier RPC (same as p2p's
// real-recipient lookup). Mass-payment reuses applyWalletTransfer directly
// from the frontend (type "transfer"), once per selected member.
// ============================================================================

export interface AppGroup {
  id: string;
  ownerUserId: string;
  name: string;
  type: "employees" | "friends" | "volunteers" | "officials" | "private" | "vip";
  currency: string;
  createdAt: string;
}

function toAppGroup(r: Record<string, unknown>): AppGroup {
  return {
    id: r.id as string, ownerUserId: r.owner_user_id as string, name: r.name as string,
    type: r.type as AppGroup["type"], currency: r.currency as string, createdAt: r.created_at as string,
  };
}

export async function listGroupsForUser(userId: string): Promise<AppGroup[]> {
  const res = await supabase.from("groups").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false });
  return mustHaveData(res, "listGroupsForUser").map(toAppGroup);
}

// A plain client insert here would fail: groups has an audit trigger
// (log_audit_event, 0003) that isn't SECURITY DEFINER, and audit_events has
// RLS enabled with zero policies — every audited table's writes go through
// a SECURITY DEFINER RPC for exactly this reason (see 0017's own comment,
// added after this one was initially a plain insert and failed live).
export async function createGroup(args: { ownerUserId: string; name: string; type: AppGroup["type"]; currency: string }): Promise<AppGroup> {
  const res = await supabase.rpc("create_group", {
    p_owner_user_id: args.ownerUserId, p_name: args.name, p_type: args.type, p_currency: args.currency,
  });
  return toAppGroup(mustHaveData(res, "createGroup") as Record<string, unknown>);
}

export interface AppGroupMember {
  id: string;
  groupId: string;
  userId: string;
  customAmount: number | null;
  maskedEmail: string;
}

export async function listGroupMembers(args: { groupId: string; ownerUserId: string }): Promise<AppGroupMember[]> {
  const res = await supabase.rpc("list_group_members", { p_group_id: args.groupId, p_owner_user_id: args.ownerUserId });
  return mustHaveData(res, "listGroupMembers").map((r: Record<string, unknown>) => ({
    id: r.id as string, groupId: r.group_id as string, userId: r.user_id as string,
    customAmount: r.custom_amount === null ? null : Number(r.custom_amount), maskedEmail: r.masked_email as string,
  }));
}

export async function addGroupMember(args: {
  groupId: string; ownerUserId: string; identifier: string; customAmount?: number;
}): Promise<AppGroupMember> {
  const res = await supabase.rpc("add_group_member", {
    p_group_id: args.groupId, p_owner_user_id: args.ownerUserId, p_identifier: args.identifier, p_custom_amount: args.customAmount ?? null,
  });
  const row = mustHaveData(res, "addGroupMember") as Record<string, unknown>;
  return { id: row.id as string, groupId: row.group_id as string, userId: row.user_id as string, customAmount: row.custom_amount === null ? null : Number(row.custom_amount), maskedEmail: "" };
}

// Same reasoning as createGroup above — group_members also has an audit
// trigger, so a plain client-side delete fails RLS on audit_events.
export async function removeGroupMember(args: { memberId: string; ownerUserId: string }): Promise<void> {
  const res = await supabase.rpc("remove_group_member", { p_member_id: args.memberId, p_owner_user_id: args.ownerUserId });
  if (res.error) throw new Error(`removeGroupMember: ${res.error.message}`);
}

// ============================================================================
// Disputes — supabase/migrations/0016/0017. Creation and resolution both go
// through SECURITY DEFINER RPCs — dispute_cases has an audit trigger, so a
// plain client insert fails RLS on audit_events (see createGroup's comment
// above for the full explanation); resolution is admin-password-gated like
// every other admin action in this codebase.
// ============================================================================

export interface AppDispute {
  id: string;
  userId: string;
  transferId: string | null;
  reason: string;
  status: "open" | "resolved";
  resolution: string | null;
  createdAt: string;
}

function toAppDispute(r: Record<string, unknown>): AppDispute {
  return {
    id: r.id as string, userId: r.user_id as string, transferId: (r.transfer_id as string) ?? null, reason: r.reason as string,
    status: r.status as AppDispute["status"], resolution: (r.resolution as string) ?? null, createdAt: r.created_at as string,
  };
}

export async function listDisputesForUser(userId: string): Promise<AppDispute[]> {
  const res = await supabase.from("dispute_cases").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return mustHaveData(res, "listDisputesForUser").map(toAppDispute);
}

export async function createDispute(args: { userId: string; transferId?: string; reason: string }): Promise<AppDispute> {
  const res = await supabase.rpc("create_dispute", { p_user_id: args.userId, p_reason: args.reason, p_transfer_id: args.transferId ?? null });
  return toAppDispute(mustHaveData(res, "createDispute") as Record<string, unknown>);
}

export async function adminResolveDispute(args: { caseId: string; resolution: string; password: string }): Promise<AppDispute> {
  const res = await supabase.rpc("admin_resolve_dispute", { p_case_id: args.caseId, p_resolution: args.resolution, p_password: args.password });
  return toAppDispute(mustHaveData(res, "adminResolveDispute") as Record<string, unknown>);
}

// ============================================================================
// API keys — supabase/migrations/0016. The raw key is only ever returned
// once, at creation — never stored, never re-readable.
// ============================================================================

export interface AppApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  status: "active" | "revoked";
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listApiKeysForUser(userId: string): Promise<AppApiKey[]> {
  const res = await supabase.from("api_keys").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return mustHaveData(res, "listApiKeysForUser").map((r) => ({
    id: r.id as string, name: r.name as string, prefix: r.prefix as string, permissions: (r.permissions as string[]) ?? [],
    status: r.status as AppApiKey["status"], createdAt: r.created_at as string, lastUsedAt: (r.last_used_at as string) ?? null,
  }));
}

export async function createApiKey(args: { userId: string; name: string; permissions: string[] }): Promise<AppApiKey & { plaintextKey: string }> {
  const res = await supabase.rpc("create_api_key", { p_user_id: args.userId, p_name: args.name, p_permissions: args.permissions });
  const row = (mustHaveData(res, "createApiKey") as Record<string, unknown>[])[0];
  return {
    id: row.id as string, name: row.name as string, prefix: row.prefix as string, plaintextKey: row.plaintext_key as string,
    permissions: (row.permissions as string[]) ?? [], status: "active", createdAt: row.created_at as string, lastUsedAt: null,
  };
}

export async function revokeApiKey(args: { keyId: string; userId: string }): Promise<AppApiKey> {
  const res = await supabase.rpc("revoke_api_key", { p_key_id: args.keyId, p_user_id: args.userId });
  const row = mustHaveData(res, "revokeApiKey") as Record<string, unknown>;
  return {
    id: row.id as string, name: row.name as string, prefix: row.prefix as string, permissions: (row.permissions as string[]) ?? [],
    status: row.status as AppApiKey["status"], createdAt: row.created_at as string, lastUsedAt: (row.last_used_at as string) ?? null,
  };
}

// ============================================================================
// Fundraise — supabase/migrations/0018. Donations reuse applyWalletTransfer
// internally (inside donate_to_campaign) and atomically bump `raised`.
// ============================================================================

export interface AppCampaign {
  id: string;
  ownerUserId: string;
  title: string;
  story: string;
  category: string;
  goal: number;
  currency: string;
  raised: number;
  deadline: string | null;
  createdAt: string;
}

function toAppCampaign(r: Record<string, unknown>): AppCampaign {
  return {
    id: r.id as string, ownerUserId: r.owner_user_id as string, title: r.title as string, story: r.story as string,
    category: r.category as string, goal: Number(r.goal), currency: r.currency as string, raised: Number(r.raised),
    deadline: (r.deadline as string) ?? null, createdAt: r.created_at as string,
  };
}

export async function listCampaigns(): Promise<AppCampaign[]> {
  const res = await supabase.from("fundraise_campaigns").select("*").order("created_at", { ascending: false });
  return mustHaveData(res, "listCampaigns").map(toAppCampaign);
}

export async function createCampaign(args: {
  ownerUserId: string; title: string; story: string; category: string; goal: number; currency: string; deadline?: string;
}): Promise<AppCampaign> {
  const res = await supabase.rpc("create_campaign", {
    p_owner_user_id: args.ownerUserId, p_title: args.title, p_story: args.story, p_category: args.category,
    p_goal: args.goal, p_currency: args.currency, p_deadline: args.deadline ?? null,
  });
  return toAppCampaign(mustHaveData(res, "createCampaign") as Record<string, unknown>);
}

export async function donateToCampaign(args: { userId: string; campaignId: string; amount: number; note?: string }): Promise<AppCampaign> {
  const res = await supabase.rpc("donate_to_campaign", { p_user_id: args.userId, p_campaign_id: args.campaignId, p_amount: args.amount, p_note: args.note ?? null });
  return toAppCampaign(mustHaveData(res, "donateToCampaign") as Record<string, unknown>);
}

// ============================================================================
// Travel — supabase/migrations/0018. book_travel_item looks up the price
// server-side, never trusts the client's displayed price.
// ============================================================================

export interface AppFlight {
  id: string; airline: string; airlineCode: string; origin: string; destination: string; departure: string; arrival: string; duration: string;
  stops: number; price: number; currency: string; class: string; seatsLeft: number; rating: number; memberDiscountPercent: number; amenities: string[];
}
export interface AppHotel {
  id: string; name: string; location: string; stars: number; pricePerNight: number; currency: string; rating: number; reviewCount: number;
  amenities: string[]; distance: string; memberDiscountPercent: number; category: string; emoji: string;
}
export interface AppTravelBooking { id: string; userId: string; kind: "flight" | "hotel"; itemId: string; amount: number; currency: string; bookedAt: string }

// Migration 0062 columns fall back to neutral values, so a catalogue row from before 0062 still renders.
export async function listFlights(): Promise<AppFlight[]> {
  const res = await supabase.from("travel_flights").select("*").order("origin").order("departure");
  return mustHaveData(res, "listFlights").map((r) => ({
    id: r.id, airline: r.airline, airlineCode: r.airline_code ?? String(r.airline).slice(0, 2).toUpperCase(), origin: r.origin, destination: r.destination,
    departure: r.departure, arrival: r.arrival, duration: r.duration, stops: Number(r.stops ?? 0), price: Number(r.price), currency: r.currency, class: r.class,
    seatsLeft: Number(r.seats_left ?? 20), rating: Number(r.rating ?? 4.5), memberDiscountPercent: Number(r.member_discount_percent ?? 0), amenities: (r.amenities as string[] | null) ?? [],
  }));
}

export async function listHotels(): Promise<AppHotel[]> {
  const res = await supabase.from("travel_hotels").select("*").order("name");
  return mustHaveData(res, "listHotels").map((r) => ({
    id: r.id, name: r.name, location: r.location, stars: r.stars, pricePerNight: Number(r.price_per_night), currency: r.currency,
    rating: Number(r.rating ?? 4.5), reviewCount: Number(r.review_count ?? 0), amenities: (r.amenities as string[] | null) ?? [], distance: r.distance ?? "",
    memberDiscountPercent: Number(r.member_discount_percent ?? 0), category: r.category ?? "Standard", emoji: r.emoji ?? "🏨",
  }));
}

export async function bookTravelItem(args: { userId: string; kind: "flight" | "hotel"; itemId: string; note?: string }): Promise<AppTravelBooking> {
  const res = await supabase.rpc("book_travel_item", { p_user_id: args.userId, p_kind: args.kind, p_item_id: args.itemId, p_note: args.note ?? null });
  const row = mustHaveData(res, "bookTravelItem") as Record<string, unknown>;
  return {
    id: row.id as string, userId: row.user_id as string, kind: row.kind as AppTravelBooking["kind"], itemId: row.item_id as string,
    amount: Number(row.amount), currency: row.currency as string, bookedAt: row.booked_at as string,
  };
}

// ---- Migration 0062: dated bookings, pay-in-three, cancel/refund, favourites, reviews ----

export interface BookTravelArgs {
  userId: string; kind: "flight" | "hotel"; itemId: string;
  /** Departure date (flights) or check-in date (hotels), YYYY-MM-DD. */
  travelDate: string; nights?: number; passengers?: number; installments?: boolean; note?: string;
}
export interface BookTravelResult {
  bookingId: string; planId: string | null; reference: string; title: string; kind: "flight" | "hotel";
  amount: number; discount: number; currency: string; chargedNow: number; installments: boolean;
}

export async function bookTravel(args: BookTravelArgs): Promise<BookTravelResult> {
  const res = await supabase.rpc("book_travel", {
    p_user_id: args.userId, p_kind: args.kind, p_item_id: args.itemId, p_travel_date: args.travelDate,
    p_nights: args.nights ?? 1, p_passengers: args.passengers ?? 1, p_installments: args.installments ?? false, p_note: args.note ?? null,
  });
  const r = mustHaveData(res, "bookTravel") as Record<string, unknown>;
  return {
    bookingId: r.booking_id as string, planId: (r.plan_id as string | null) ?? null, reference: r.reference as string, title: r.title as string,
    kind: r.kind as "flight" | "hotel", amount: Number(r.amount), discount: Number(r.discount), currency: r.currency as string,
    chargedNow: Number(r.charged_now), installments: Boolean(r.installments),
  };
}

export async function cancelTravelBooking(args: { userId: string; bookingId: string }): Promise<{ refunded: number; currency: string; reference: string }> {
  const res = await supabase.rpc("cancel_travel_booking", { p_user_id: args.userId, p_booking_id: args.bookingId });
  const r = mustHaveData(res, "cancelTravelBooking") as Record<string, unknown>;
  return { refunded: Number(r.refunded), currency: r.currency as string, reference: r.reference as string };
}

// ---- Migration 0063 + the travel-search Edge Function: live partner offers (Amadeus) ----

export interface PartnerFlightOffer {
  quoteId: string; offerId: string; provider: "amadeus"; airline: string; airlineCode: string; origin: string; destination: string;
  departure: string; arrival: string; departureDate: string; duration: string; stops: number; cabin: "economy" | "business";
  seatsLeft: number | null; price: number; currency: string; passengers: number;
}
export interface PartnerHotelOffer {
  quoteId: string; offerId: string; provider: "amadeus"; hotelId: string; name: string; cityCode: string; country: string;
  checkIn: string; checkOut: string; nights: number; guests: number; room: string; price: number; perNight: number; currency: string;
}

export type PartnerSearchErrorCode = "not_configured" | "rate_limited" | "bad_input" | "unauthorized" | "upstream";

export class PartnerSearchError extends Error {
  constructor(public code: PartnerSearchErrorCode, message: string) {
    super(message);
  }
}

async function invokeTravelSearch<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("travel-search", { body });
  if (error) {
    // The function is not deployed (or unreachable): the same "not connected yet" state as missing keys.
    if ((error as { name?: string }).name === "FunctionsFetchError") throw new PartnerSearchError("not_configured", error.message);
    let code: PartnerSearchErrorCode = "upstream";
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = (await ctx.json()) as { error?: PartnerSearchErrorCode; message?: string };
        if (payload.error) code = payload.error;
        else if ((ctx as Response).status === 404) code = "not_configured";
        if (payload.message) message = payload.message;
      } catch {
        // keep the generic upstream error
      }
    }
    throw new PartnerSearchError(code, message);
  }
  return data as T;
}

export async function searchPartnerFlights(args: { origin: string; destination: string; date: string; passengers: number; currency?: string }): Promise<PartnerFlightOffer[]> {
  const res = await invokeTravelSearch<{ offers: PartnerFlightOffer[] }>({ action: "flights", ...args });
  return res.offers ?? [];
}

export async function searchPartnerHotels(args: { place: string; checkIn: string; checkOut: string; guests: number; currency?: string }): Promise<PartnerHotelOffer[]> {
  const res = await invokeTravelSearch<{ offers: PartnerHotelOffer[] }>({ action: "hotels", ...args });
  return res.offers ?? [];
}

export async function bookPartnerQuote(args: { userId: string; quoteId: string; installments?: boolean; note?: string }): Promise<BookTravelResult> {
  const res = await supabase.rpc("book_partner_quote", { p_user_id: args.userId, p_quote_id: args.quoteId, p_installments: args.installments ?? false, p_note: args.note ?? null });
  const r = mustHaveData(res, "bookPartnerQuote") as Record<string, unknown>;
  return {
    bookingId: r.booking_id as string, planId: (r.plan_id as string | null) ?? null, reference: r.reference as string, title: r.title as string,
    kind: r.kind as "flight" | "hotel", amount: Number(r.amount), discount: Number(r.discount), currency: r.currency as string,
    chargedNow: Number(r.charged_now), installments: Boolean(r.installments),
  };
}

export interface AppTravelBookingRecord {
  id: string; reference: string; kind: "flight" | "hotel"; itemId: string; title: string; amount: number; currency: string; status: "confirmed" | "cancelled";
  travelDate: string | null; nights: number; passengers: number; bookedAt: string; refundedAmount: number; discountAmount: number;
  /** Where the offer came from: the PayRus catalogue or a partner platform. */
  source: "payrus" | "amadeus";
}

export async function listTravelBookings(userId: string): Promise<AppTravelBookingRecord[]> {
  const res = await supabase.from("travel_bookings").select("*").eq("user_id", userId).order("booked_at", { ascending: false });
  return mustHaveData(res, "listTravelBookings").map((r) => ({
    id: r.id, reference: r.reference, kind: r.kind, itemId: r.item_id, title: r.title ?? "", amount: Number(r.amount), currency: r.currency, status: r.status,
    travelDate: r.travel_date ?? null, nights: Number(r.nights ?? 1), passengers: Number(r.passengers ?? 1), bookedAt: r.booked_at,
    refundedAmount: Number(r.refunded_amount ?? 0), discountAmount: Number(r.discount_amount ?? 0), source: (r.source ?? "payrus") as "payrus" | "amadeus",
  }));
}

export async function listTravelFavorites(userId: string): Promise<string[]> {
  const res = await supabase.from("travel_favorites").select("kind, item_id").eq("user_id", userId);
  return mustHaveData(res, "listTravelFavorites").map((r) => `${r.kind}:${r.item_id}`);
}

/** Returns true when the item is now a favourite, false when it was removed. */
export async function toggleTravelFavorite(args: { userId: string; kind: "flight" | "hotel"; itemId: string }): Promise<boolean> {
  const res = await supabase.rpc("toggle_travel_favorite", { p_user_id: args.userId, p_kind: args.kind, p_item_id: args.itemId });
  return Boolean(mustHaveData(res, "toggleTravelFavorite"));
}

export interface AppTravelReview {
  id: string; userName: string; country: string | null; kind: "flight" | "hotel"; itemId: string; entity: string; rating: number; comment: string;
  verified: boolean; createdAt: string; mine: boolean;
}

export async function listTravelReviews(userId?: string): Promise<AppTravelReview[]> {
  const res = await supabase.from("travel_reviews").select("*").order("created_at", { ascending: false }).limit(60);
  return mustHaveData(res, "listTravelReviews").map((r) => ({
    id: r.id, userName: r.user_name, country: r.country ?? null, kind: r.kind, itemId: r.item_id, entity: r.entity, rating: Number(r.rating),
    comment: r.comment, verified: Boolean(r.verified), createdAt: r.created_at, mine: !!userId && r.user_id === userId,
  }));
}

export async function addTravelReview(args: { userId: string; kind: "flight" | "hotel"; itemId: string; rating: number; comment: string }): Promise<string> {
  const res = await supabase.rpc("add_travel_review", { p_user_id: args.userId, p_kind: args.kind, p_item_id: args.itemId, p_rating: args.rating, p_comment: args.comment });
  return mustHaveData(res, "addTravelReview") as string;
}

// ============================================================================
// Savings — supabase/migrations/0018. Pots/tontines/investment products.
// ============================================================================

export interface AppSavingsPot {
  id: string; userId: string; name: string; category: string | null; targetAmount: number; currentAmount: number;
  currency: string; monthlyContrib: number; interestRate: number; dueDate: string | null;
}

function toAppSavingsPot(r: Record<string, unknown>): AppSavingsPot {
  return {
    id: r.id as string, userId: r.user_id as string, name: r.name as string, category: (r.category as string) ?? null,
    targetAmount: Number(r.target_amount), currentAmount: Number(r.current_amount), currency: r.currency as string,
    monthlyContrib: Number(r.monthly_contrib ?? 0), interestRate: Number(r.interest_rate ?? 0), dueDate: (r.due_date as string) ?? null,
  };
}

export async function listSavingsPotsForUser(userId: string): Promise<AppSavingsPot[]> {
  const res = await supabase.from("savings_pots").select("*").eq("user_id", userId);
  return mustHaveData(res, "listSavingsPotsForUser").map(toAppSavingsPot);
}

export async function createSavingsPot(args: {
  userId: string; name: string; category?: string; targetAmount: number; currency: string;
  monthlyContrib?: number; interestRate?: number; dueDate?: string;
}): Promise<AppSavingsPot> {
  const res = await supabase.rpc("create_savings_pot", {
    p_user_id: args.userId, p_name: args.name, p_category: args.category ?? null, p_target_amount: args.targetAmount,
    p_currency: args.currency, p_monthly_contrib: args.monthlyContrib ?? 0, p_interest_rate: args.interestRate ?? 0, p_due_date: args.dueDate ?? null,
  });
  return toAppSavingsPot(mustHaveData(res, "createSavingsPot") as Record<string, unknown>);
}

export async function contributeToPot(args: { userId: string; potId: string; amount: number }): Promise<AppSavingsPot> {
  const res = await supabase.rpc("contribute_to_pot", { p_user_id: args.userId, p_pot_id: args.potId, p_amount: args.amount });
  return toAppSavingsPot(mustHaveData(res, "contributeToPot") as Record<string, unknown>);
}

export interface AppTontineCircle {
  id: string; name: string; currency: string; potAmount: number; potBalance: number;
  frequency: string; totalRounds: number; currentRound: number; nextPayoutDate: string | null;
}

function toAppTontineCircle(r: Record<string, unknown>): AppTontineCircle {
  return {
    id: r.id as string, name: r.name as string, currency: r.currency as string, potAmount: Number(r.pot_amount),
    potBalance: Number(r.pot_balance), frequency: r.frequency as string, totalRounds: r.total_rounds as number, currentRound: r.current_round as number,
    nextPayoutDate: (r.next_payout_date as string) ?? null,
  };
}

// Opportunistic settlement (0020): every read of the circle list first
// settles any circle whose payout is due — a global, not owner-scoped,
// sweep (a rotating pot pays out regardless of which user's session
// happens to trigger it). Best-effort: a settlement failure here must
// never block the ordinary read that every page relying on this list
// depends on.
export async function listTontineCircles(): Promise<AppTontineCircle[]> {
  try {
    await supabase.rpc("process_due_tontine_payouts");
  } catch {
    // best-effort — the read below still returns whatever's current
  }
  const res = await supabase.from("tontine_circles").select("*");
  return mustHaveData(res, "listTontineCircles").map(toAppTontineCircle);
}

export async function joinTontine(args: { userId: string; circleId: string }): Promise<{ id: string; position: number }> {
  const res = await supabase.rpc("join_tontine", { p_user_id: args.userId, p_circle_id: args.circleId });
  const row = mustHaveData(res, "joinTontine") as Record<string, unknown>;
  return { id: row.id as string, position: row.position as number };
}

export async function contributeToTontine(args: { userId: string; circleId: string; amount: number }): Promise<AppTontineCircle> {
  const res = await supabase.rpc("contribute_to_tontine", { p_user_id: args.userId, p_circle_id: args.circleId, p_amount: args.amount });
  return toAppTontineCircle(mustHaveData(res, "contributeToTontine") as Record<string, unknown>);
}

export async function createTontineCircle(args: {
  ownerUserId: string; name: string; currency: string; potAmount: number; frequency: "weekly" | "monthly"; totalRounds: number;
}): Promise<AppTontineCircle> {
  const res = await supabase.rpc("create_tontine_circle", {
    p_owner_user_id: args.ownerUserId, p_name: args.name, p_currency: args.currency,
    p_pot_amount: args.potAmount, p_frequency: args.frequency, p_total_rounds: args.totalRounds,
  });
  return toAppTontineCircle(mustHaveData(res, "createTontineCircle") as Record<string, unknown>);
}

export interface AppInvestmentProduct { id: string; name: string; description: string | null; apy: number; minAmount: number; currency: string; duration: string | null; risk: "low" | "medium" | "high" }

export async function listInvestmentProducts(): Promise<AppInvestmentProduct[]> {
  const res = await supabase.from("investment_products").select("*");
  return mustHaveData(res, "listInvestmentProducts").map((r) => ({
    id: r.id, name: r.name, description: r.description, apy: Number(r.apy), minAmount: Number(r.min_amount),
    currency: r.currency, duration: r.duration, risk: r.risk,
  }));
}

export async function investInProduct(args: { userId: string; productId: string; amount: number }): Promise<{ id: string; amount: number }> {
  const res = await supabase.rpc("invest_in_product", { p_user_id: args.userId, p_product_id: args.productId, p_amount: args.amount });
  const row = mustHaveData(res, "investInProduct") as Record<string, unknown>;
  return { id: row.id as string, amount: Number(row.amount) };
}

// ============================================================================
// Invest — supabase/migrations/0018. Pitches + investments; repayment
// schedule generated at investment time, resolution stays manual/admin.
// ============================================================================

export interface AppPitch {
  id: string; ownerUserId: string | null; title: string; description: string | null; founder: string | null; category: string | null;
  goal: number; raised: number; currency: string; returnPct: number; timelineMonths: number; risk: "low" | "medium" | "high"; location: string | null;
  impactJobs: number | null; impactHouseholds: number | null; impactCo2: number | null;
}

function toAppPitch(r: Record<string, unknown>): AppPitch {
  return {
    id: r.id as string, ownerUserId: r.owner_user_id as string | null, title: r.title as string, description: r.description as string | null,
    founder: r.founder as string | null, category: r.category as string | null, goal: Number(r.goal), raised: Number(r.raised),
    currency: r.currency as string, returnPct: Number(r.return_pct), timelineMonths: r.timeline_months as number,
    risk: r.risk as "low" | "medium" | "high", location: r.location as string | null,
    impactJobs: r.impact_jobs == null ? null : Number(r.impact_jobs), impactHouseholds: r.impact_households == null ? null : Number(r.impact_households),
    impactCo2: r.impact_co2 == null ? null : Number(r.impact_co2),
  };
}

export async function listPitches(): Promise<AppPitch[]> {
  const res = await supabase.from("investment_pitches").select("*");
  return mustHaveData(res, "listPitches").map(toAppPitch);
}

export async function createPitch(args: {
  ownerUserId: string; title: string; description: string; founder: string; category: string;
  goal: number; currency: string; returnPct: number; timelineMonths: number; risk?: "low" | "medium" | "high"; location?: string;
  impactJobs?: number; impactHouseholds?: number; impactCo2?: number;
}): Promise<AppPitch> {
  const res = await supabase.rpc("create_pitch", {
    p_owner_user_id: args.ownerUserId, p_title: args.title, p_description: args.description, p_founder: args.founder,
    p_category: args.category, p_goal: args.goal, p_currency: args.currency, p_return_pct: args.returnPct,
    p_timeline_months: args.timelineMonths, p_risk: args.risk ?? "medium", p_location: args.location ?? null,
    p_impact_jobs: args.impactJobs ?? null, p_impact_households: args.impactHouseholds ?? null, p_impact_co2: args.impactCo2 ?? null,
  });
  return toAppPitch(mustHaveData(res, "createPitch") as Record<string, unknown>);
}

export interface AppPlatformImpact { totalRaised: number; totalBackers: number; totalJobs: number; totalHouseholds: number; totalCo2: number }

export async function getPlatformImpact(): Promise<AppPlatformImpact> {
  const res = await supabase.rpc("get_platform_impact");
  const row = mustHaveData(res, "getPlatformImpact")[0] as Record<string, unknown> | undefined;
  return {
    totalRaised: Number(row?.total_raised ?? 0), totalBackers: Number(row?.total_backers ?? 0),
    totalJobs: Number(row?.total_jobs ?? 0), totalHouseholds: Number(row?.total_households ?? 0), totalCo2: Number(row?.total_co2 ?? 0),
  };
}

export interface AppSectorPopularity { sector: string; backers: number }

export async function getSectorPopularity(): Promise<AppSectorPopularity[]> {
  const res = await supabase.rpc("get_sector_popularity");
  return mustHaveData(res, "getSectorPopularity").map((r: Record<string, unknown>) => ({ sector: r.sector as string, backers: Number(r.backers) }));
}

export interface AppPitchInvestment { id: string; userId: string; pitchId: string; amount: number; currency: string; returnPct: number; timelineMonths: number; investedAt: string }

// Opportunistic settlement (0020): resolves this user's own overdue
// repayments (crediting their wallet) before every read — best-effort,
// never blocks the read itself if settlement fails.
export async function listPitchInvestmentsForUser(userId: string): Promise<AppPitchInvestment[]> {
  try {
    await supabase.rpc("process_due_pitch_repayments", { p_user_id: userId });
  } catch {
    // best-effort
  }
  const res = await supabase.from("pitch_investments").select("*").eq("user_id", userId);
  return mustHaveData(res, "listPitchInvestmentsForUser").map((r) => ({
    id: r.id, userId: r.user_id, pitchId: r.pitch_id, amount: Number(r.amount), currency: r.currency,
    returnPct: Number(r.return_pct), timelineMonths: r.timeline_months, investedAt: r.invested_at,
  }));
}

export interface AppPitchRepayment { investmentId: string; month: number; amount: number; currency: string; dueDate: string; status: "pending" | "paid" | "cancelled" }

export async function listPitchRepayments(investmentId: string): Promise<AppPitchRepayment[]> {
  const res = await supabase.from("pitch_repayments").select("*").eq("investment_id", investmentId).order("month");
  return mustHaveData(res, "listPitchRepayments").map((r) => ({
    investmentId: r.investment_id, month: r.month, amount: Number(r.amount), currency: r.currency, dueDate: r.due_date, status: r.status,
  }));
}

export async function investInPitch(args: { userId: string; pitchId: string; amount: number }): Promise<AppPitchInvestment> {
  // PRS-INV-005: the standard risk disclosure is logged as accepted before the position is created.
  const ack = await supabase.rpc("accept_risk_disclosure", { p_user_id: args.userId, p_kind: "pitch", p_object_id: args.pitchId, p_version: "risk-v1" });
  // PGRST202 = migration 0067 not applied yet on this project: keep working (the server then has no disclosure log to enforce).
  if (ack.error && ack.error.code !== "PGRST202") throw new Error(ack.error.message);
  const res = await supabase.rpc("invest_in_pitch", { p_user_id: args.userId, p_pitch_id: args.pitchId, p_amount: args.amount });
  const row = mustHaveData(res, "investInPitch") as Record<string, unknown>;
  return {
    id: row.id as string, userId: row.user_id as string, pitchId: row.pitch_id as string, amount: Number(row.amount),
    currency: row.currency as string, returnPct: Number(row.return_pct), timelineMonths: row.timeline_months as number, investedAt: row.invested_at as string,
  };
}

// ============================================================================
// Games — supabase/migrations/0018. Real money end to end — placeBet debits
// the stake, resolveBet is server-authoritative (the outcome is decided
// inside the RPC, never trusted from the client).
// ============================================================================

export interface AppGameBet {
  id: string; userId: string; kind: "sports" | "lotto" | "scratch"; stakeAmount: number; currency: string;
  meta: Record<string, unknown>; status: "pending" | "won" | "lost"; payoutAmount: number | null; placedAt: string; resolvedAt: string | null;
}

function toAppGameBet(r: Record<string, unknown>): AppGameBet {
  return {
    id: r.id as string, userId: r.user_id as string, kind: r.kind as AppGameBet["kind"], stakeAmount: Number(r.stake_amount),
    currency: r.currency as string, meta: (r.meta as Record<string, unknown>) ?? {}, status: r.status as AppGameBet["status"],
    payoutAmount: r.payout_amount == null ? null : Number(r.payout_amount), placedAt: r.placed_at as string, resolvedAt: (r.resolved_at as string) ?? null,
  };
}

export async function placeBet(args: { userId: string; kind: AppGameBet["kind"]; stakeAmount: number; currency: string; meta?: Record<string, unknown> }): Promise<AppGameBet> {
  const res = await supabase.rpc("place_bet", { p_user_id: args.userId, p_kind: args.kind, p_stake_amount: args.stakeAmount, p_currency: args.currency, p_meta: args.meta ?? {} });
  return toAppGameBet(mustHaveData(res, "placeBet") as Record<string, unknown>);
}

export async function resolveBet(args: { betId: string; userId: string }): Promise<AppGameBet> {
  const res = await supabase.rpc("resolve_bet", { p_bet_id: args.betId, p_user_id: args.userId });
  return toAppGameBet(mustHaveData(res, "resolveBet") as Record<string, unknown>);
}

// ============================================================================
// Phase 4 (0019) — fills the gaps deliberately deferred from Phase 3:
// savings' loyalty/expense-report/corporate-card sub-domain, travel's
// 3-installment split payment, and the invest leaderboard. Tontine
// creation and pitch submission are added above, alongside their
// existing sections.
// ============================================================================

export interface AppLoyaltyAccount {
  id: string; userId: string; venueName: string; venueCategory: string; points: number; pointsValue: number;
  currency: string; monthlySpend: number; spendLimit: number; cashbackRate: number;
}

function toAppLoyaltyAccount(r: Record<string, unknown>): AppLoyaltyAccount {
  return {
    id: r.id as string, userId: r.user_id as string, venueName: r.venue_name as string, venueCategory: r.venue_category as string,
    points: Number(r.points), pointsValue: Number(r.points_value), currency: r.currency as string,
    monthlySpend: Number(r.monthly_spend), spendLimit: Number(r.spend_limit), cashbackRate: Number(r.cashback_rate),
  };
}

export async function listLoyaltyAccountsForUser(userId: string): Promise<AppLoyaltyAccount[]> {
  const res = await supabase.from("loyalty_accounts").select("*").eq("user_id", userId);
  return mustHaveData(res, "listLoyaltyAccountsForUser").map(toAppLoyaltyAccount);
}

export async function linkLoyaltyVenue(args: {
  userId: string; venueName: string; venueCategory: string; currency: string; spendLimit?: number; cashbackRate?: number;
}): Promise<AppLoyaltyAccount> {
  const res = await supabase.rpc("link_loyalty_venue", {
    p_user_id: args.userId, p_venue_name: args.venueName, p_venue_category: args.venueCategory, p_currency: args.currency,
    p_spend_limit: args.spendLimit ?? 50000, p_cashback_rate: args.cashbackRate ?? 8,
  });
  return toAppLoyaltyAccount(mustHaveData(res, "linkLoyaltyVenue") as Record<string, unknown>);
}

export async function setLoyaltySpendLimit(args: { userId: string; accountId: string; spendLimit: number }): Promise<AppLoyaltyAccount> {
  const res = await supabase.rpc("set_loyalty_spend_limit", { p_user_id: args.userId, p_account_id: args.accountId, p_spend_limit: args.spendLimit });
  return toAppLoyaltyAccount(mustHaveData(res, "setLoyaltySpendLimit") as Record<string, unknown>);
}

export async function recordVenueSpend(args: { userId: string; accountId: string; amount: number }): Promise<AppLoyaltyAccount> {
  const res = await supabase.rpc("record_venue_spend", { p_user_id: args.userId, p_account_id: args.accountId, p_amount: args.amount });
  return toAppLoyaltyAccount(mustHaveData(res, "recordVenueSpend") as Record<string, unknown>);
}

export async function redeemLoyaltyReward(args: { userId: string; accountId: string; pointsCost: number; rewardLabel: string }): Promise<AppLoyaltyAccount> {
  const res = await supabase.rpc("redeem_loyalty_reward", {
    p_user_id: args.userId, p_account_id: args.accountId, p_points_cost: args.pointsCost, p_reward_label: args.rewardLabel,
  });
  return toAppLoyaltyAccount(mustHaveData(res, "redeemLoyaltyReward") as Record<string, unknown>);
}

export interface AppLoyaltySpendMonth { m: string; spend: number }

// Real month-by-month history from loyalty_spend_events (0020), one row
// per record_venue_spend call — zero-filled for months with no spend
// rather than only showing months that happened to have activity.
export async function listLoyaltySpendHistory(accountId: string): Promise<AppLoyaltySpendMonth[]> {
  const start = new Date();
  start.setMonth(start.getMonth() - 5);
  start.setDate(1);
  const res = await supabase.from("loyalty_spend_events").select("amount, occurred_at").eq("account_id", accountId).gte("occurred_at", start.toISOString());
  const rows = mustHaveData(res, "listLoyaltySpendHistory");

  const months: { key: string; label: string }[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 6; i++) {
    months.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, label: cursor.toLocaleDateString("en-US", { month: "short" }) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const totals = new Map(months.map((m) => [m.key, 0]));
  for (const r of rows) {
    const d = new Date(r.occurred_at as string);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + Number(r.amount));
  }

  return months.map((m) => ({ m: m.label, spend: totals.get(m.key) ?? 0 }));
}

export interface AppExpenseReport {
  id: string; userId: string; title: string; amount: number; currency: string; category: string;
  status: "pending" | "approved" | "rejected"; employeeName: string | null; project: string | null; submittedAt: string;
}

function toAppExpenseReport(r: Record<string, unknown>): AppExpenseReport {
  return {
    id: r.id as string, userId: r.user_id as string, title: r.title as string, amount: Number(r.amount), currency: r.currency as string,
    category: r.category as string, status: r.status as AppExpenseReport["status"], employeeName: (r.employee_name as string) ?? null,
    project: (r.project as string) ?? null, submittedAt: r.submitted_at as string,
  };
}

export async function listExpenseReportsForUser(userId: string): Promise<AppExpenseReport[]> {
  const res = await supabase.from("expense_reports").select("*").eq("user_id", userId).order("submitted_at", { ascending: false });
  return mustHaveData(res, "listExpenseReportsForUser").map(toAppExpenseReport);
}

export async function submitExpenseReport(args: {
  userId: string; title: string; amount: number; currency: string; category: string; project?: string; employeeName?: string;
}): Promise<AppExpenseReport> {
  const res = await supabase.rpc("submit_expense_report", {
    p_user_id: args.userId, p_title: args.title, p_amount: args.amount, p_currency: args.currency, p_category: args.category,
    p_project: args.project ?? null, p_employee_name: args.employeeName ?? null,
  });
  return toAppExpenseReport(mustHaveData(res, "submitExpenseReport") as Record<string, unknown>);
}

export interface AppCorporateCard {
  id: string; ownerUserId: string; holderName: string; role: string; limitAmount: number; spentAmount: number; currency: string;
}

function toAppCorporateCard(r: Record<string, unknown>): AppCorporateCard {
  return {
    id: r.id as string, ownerUserId: r.owner_user_id as string, holderName: r.holder_name as string, role: r.role as string,
    limitAmount: Number(r.limit_amount), spentAmount: Number(r.spent_amount), currency: r.currency as string,
  };
}

export async function listCorporateCardsForUser(ownerUserId: string): Promise<AppCorporateCard[]> {
  const res = await supabase.from("corporate_cards").select("*").eq("owner_user_id", ownerUserId);
  return mustHaveData(res, "listCorporateCardsForUser").map(toAppCorporateCard);
}

export async function createCorporateCard(args: {
  ownerUserId: string; holderName: string; role: string; limitAmount: number; currency: string;
}): Promise<AppCorporateCard> {
  const res = await supabase.rpc("create_corporate_card", {
    p_owner_user_id: args.ownerUserId, p_holder_name: args.holderName, p_role: args.role, p_limit_amount: args.limitAmount, p_currency: args.currency,
  });
  return toAppCorporateCard(mustHaveData(res, "createCorporateCard") as Record<string, unknown>);
}

export interface AppTravelInstallment { id: string; planId: string; seq: number; amount: number; currency: string; dueDate: string; status: "pending" | "paid" | "cancelled" }
export interface AppTravelInstallmentPlan { id: string; bookingId: string; userId: string; totalAmount: number; currency: string; feeAmount: number }

function toAppTravelInstallmentPlan(r: Record<string, unknown>): AppTravelInstallmentPlan {
  return {
    id: r.id as string, bookingId: r.booking_id as string, userId: r.user_id as string,
    totalAmount: Number(r.total_amount), currency: r.currency as string, feeAmount: Number(r.fee_amount),
  };
}

export async function bookTravelItemInstallments(args: { userId: string; kind: "flight" | "hotel"; itemId: string; note?: string }): Promise<AppTravelInstallmentPlan> {
  const res = await supabase.rpc("book_travel_item_installments", { p_user_id: args.userId, p_kind: args.kind, p_item_id: args.itemId, p_note: args.note ?? null });
  return toAppTravelInstallmentPlan(mustHaveData(res, "bookTravelItemInstallments") as Record<string, unknown>);
}

export async function listTravelInstallments(planId: string): Promise<AppTravelInstallment[]> {
  const res = await supabase.from("travel_installments").select("*").eq("plan_id", planId).order("seq");
  return mustHaveData(res, "listTravelInstallments").map((r) => ({
    id: r.id, planId: r.plan_id, seq: r.seq, amount: Number(r.amount), currency: r.currency, dueDate: r.due_date, status: r.status,
  }));
}

export interface AppTravelInstallmentPlanWithInstallments extends AppTravelInstallmentPlan { installments: AppTravelInstallment[] }

// Opportunistic settlement (0020): charges any of this user's overdue
// installments before every read — best-effort, never blocks the read.
export async function listTravelInstallmentPlansForUser(userId: string): Promise<AppTravelInstallmentPlanWithInstallments[]> {
  try {
    await supabase.rpc("process_due_travel_installments", { p_user_id: userId });
  } catch {
    // best-effort
  }
  const res = await supabase.from("travel_installment_plans").select("*, travel_installments(*)").eq("user_id", userId).order("created_at", { ascending: false });
  return mustHaveData(res, "listTravelInstallmentPlansForUser").map((r: Record<string, unknown>) => ({
    ...toAppTravelInstallmentPlan(r),
    installments: ((r.travel_installments as Record<string, unknown>[]) ?? [])
      .map((i) => ({
        id: i.id as string, planId: i.plan_id as string, seq: i.seq as number, amount: Number(i.amount),
        currency: i.currency as string, dueDate: i.due_date as string, status: i.status as "pending" | "paid" | "cancelled",
      }))
      .sort((a, b) => a.seq - b.seq),
  }));
}

export interface AppLeaderboardRow { userId: string; username: string | null; pitchesCount: number; avgReturnPct: number; totalXaf: number }

export async function getInvestorLeaderboard(limit = 20): Promise<AppLeaderboardRow[]> {
  const res = await supabase.rpc("get_investor_leaderboard", { p_limit: limit });
  return mustHaveData(res, "getInvestorLeaderboard").map((r: Record<string, unknown>) => ({
    userId: r.user_id as string, username: r.username as string | null, pitchesCount: Number(r.pitches_count),
    avgReturnPct: Number(r.avg_return_pct), totalXaf: Number(r.total_xaf),
  }));
}

// ---------------------------------------------------------------------------
// Transaction detail (migration 0050): everything about one of the caller's transactions by reference —
// the transfer, its fee, the FX side of a remittance and the payout that follows it.
// ---------------------------------------------------------------------------
export interface TransactionDetail {
  transfer: { id: string; reference: string; type: AppTransfer["type"]; state: string; amount: number; currency: string; note: string | null; createdAt: string; partnerTxId: string | null };
  fee: number | null;
  wallet: { id: string; provider: string; currency: string } | null;
  remittance: { fromCurrency: string; toCurrency: string; amount: number; fee: number; fxCost: number; receiveAmount: number; marginRate: number } | null;
  payout: {
    id: string; receiverId: string | null; receiverName: string; country: string | null; deliveryMethod: PayoutMethod; provider: string | null; accountMasked: string | null;
    status: PayoutRow["status"]; pickupCode: string | null; agentName: string | null; agentAddress: string | null; pickupCountry: string | null; pickupCurrency: string | null;
    pickupAmount: number | null; receiveAmount: number; toCurrency: string; channelType: string | null; createdAt: string;
  } | null;
}

// Returns null when the transaction is not the caller's, or when migration 0050 has not been applied yet.
export async function getTransactionDetail(reference: string): Promise<TransactionDetail | null> {
  const res = await supabase.rpc("transaction_detail", { p_reference: reference });
  if (res.error) return null;
  const d = res.data as Record<string, Record<string, unknown> | number | null> | null;
  if (!d) return null;
  const tr = d.transfer as Record<string, unknown>;
  const rem = d.remittance as Record<string, unknown> | null;
  const pay = d.payout as Record<string, unknown> | null;
  const wal = d.wallet as Record<string, unknown> | null;
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    transfer: { id: tr.id as string, reference: tr.reference as string, type: tr.type as AppTransfer["type"], state: tr.state as string, amount: Number(tr.amount), currency: tr.currency as string, note: (tr.note as string) ?? null, createdAt: tr.created_at as string, partnerTxId: (tr.partner_tx_id as string) ?? null },
    fee: num(d.fee),
    wallet: wal ? { id: wal.id as string, provider: wal.provider as string, currency: wal.currency as string } : null,
    remittance: rem ? { fromCurrency: rem.from_currency as string, toCurrency: rem.to_currency as string, amount: Number(rem.amount), fee: Number(rem.fee), fxCost: Number(rem.fx_cost), receiveAmount: Number(rem.receive_amount), marginRate: Number(rem.margin_rate) } : null,
    payout: pay ? {
      id: pay.id as string, receiverId: (pay.receiver_id as string) ?? null, receiverName: pay.receiver_name as string, country: (pay.country as string) ?? null, deliveryMethod: pay.delivery_method as PayoutMethod,
      provider: (pay.provider as string) ?? null, accountMasked: (pay.account_masked as string) ?? null, status: pay.status as PayoutRow["status"], pickupCode: (pay.pickup_code as string) ?? null,
      agentName: (pay.agent_name as string) ?? null, agentAddress: (pay.agent_address as string) ?? null, pickupCountry: (pay.pickup_country as string) ?? null, pickupCurrency: (pay.pickup_currency as string) ?? null,
      pickupAmount: num(pay.pickup_amount), receiveAmount: Number(pay.receive_amount), toCurrency: pay.to_currency as string, channelType: (pay.channel_type as string) ?? null, createdAt: pay.created_at as string,
    } : null,
  };
}
