import { describe, expect, it } from "vitest";
import { classifyTransactionError, transactionErrorKey, transactionErrorMessage } from "./transaction-errors.ts";

const code = (message: string) => classifyTransactionError(new Error(message)).code;

describe("classifyTransactionError (the backend's real wording)", () => {
  it("explains an insufficient wallet balance with the amounts", () => {
    const e = classifyTransactionError(new Error("send_remittance: insufficient balance (need 208.00 EUR, have 50.00 EUR)"));
    expect(e.code).toBe("insufficient_balance");
    expect(e.params).toEqual({ need: "208.00", have: "50.00", currency: "EUR" });
  });
  it("copes with the older wording that has no currency tags, and with none at all", () => {
    expect(classifyTransactionError(new Error("apply_wallet_transfer: insufficient balance (need 1530.5, have 20)")).params).toMatchObject({ need: "1530.5", have: "20" });
    expect(classifyTransactionError(new Error("insufficient balance")).params).toEqual({});
  });
  it("names an unauthorised or blocked corridor", () => {
    expect(code("corridor_blocked:not_offered")).toBe("corridor_not_offered");
    expect(code("corridor_blocked:suspended")).toBe("corridor_suspended");
    expect(code("corridor_blocked:below_min")).toBe("corridor_below_min");
    expect(code("corridor_blocked:above_max")).toBe("corridor_above_max");
    expect(code("corridor_blocked:below_floor")).toBe("corridor_below_floor");
    expect(code("corridor_blocked:no_rate")).toBe("corridor_no_rate");
    expect(code("corridor_blocked:something_new")).toBe("corridor_invalid");
  });
  it("tells a missing wallet from a short one", () => {
    expect(code("send_remittance: open a wallet first - you have none that can fund this transfer")).toBe("no_wallet");
    expect(code("apply_wallet_transfer: user 123 has no wallet yet")).toBe("no_wallet");
  });
  it("recognises authorisation failures", () => {
    expect(code("not permitted: acting user does not match the signed-in account")).toBe("unauthorised");
    expect(code("permission denied for function book_travel")).toBe("permission");
    expect(code("new row violates row-level security policy for table \"audit_events\"")).toBe("permission");
    expect(code("JWT expired")).toBe("session");
    expect(code("this agent cannot pay out to this receiver")).toBe("agent_not_allowed");
    expect(code("only agents can pay out a pickup")).toBe("agents_only");
  });
  it("recognises payout route problems", () => {
    const e = classifyTransactionError(new Error("send_to_receiver: mobile money is not connected in CD yet"));
    expect(e.code).toBe("payout_not_connected");
    expect(e.params.country).toBe("CD");
    expect(code("this partner route is not live (contract not active or not funded)")).toBe("partner_not_live");
    expect(code("no pickup agent is available for that receiver yet")).toBe("no_agent");
  });
  it("recognises limits, roles, recipients and amounts", () => {
    expect(classifyTransactionError(new Error("5000 is above your approval limit of 1000")).params.limit).toBe("1000");
    expect(code("your role in this workspace does not allow this step (needs the approve permission)")).toBe("role_permission");
    expect(code("cannot send to yourself")).toBe("self_transfer");
    expect(code("unknown receiver")).toBe("unknown_recipient");
    expect(code("apply_wallet_transfer: amount must be positive")).toBe("bad_amount");
    expect(code("create_my_wallet: ZZZ is not a supported currency")).toBe("currency_unsupported");
    expect(code("book_partner_quote: this offer has expired - search again")).toBe("quote_expired");
  });
  it("recognises a dropped connection", () => {
    expect(code("Failed to fetch")).toBe("network");
    expect(code("TypeError: NetworkError when attempting to fetch resource.")).toBe("network");
  });
  it("leaves the unrecognised to the screen's own wording", () => {
    expect(code("something nobody has seen before")).toBe("unknown");
    expect(classifyTransactionError(undefined).code).toBe("unknown");
  });
});

describe("transactionErrorMessage", () => {
  const t = (key: string, options?: Record<string, unknown>) => `${key}${options && Object.keys(options).length ? JSON.stringify(options) : ""}`;

  it("uses the corridor wording already shown by the quote", () => {
    expect(transactionErrorKey("corridor_not_offered")).toBe("remittance.blocked.not_offered");
    expect(transactionErrorMessage(new Error("corridor_blocked:suspended"), t)).toBe("remittance.blocked.suspended");
  });
  it("passes the amounts through for a short balance and uses the plain wording without them", () => {
    expect(transactionErrorMessage(new Error("insufficient balance (need 10.00 USD, have 3.00 USD)"), t)).toContain("txerror.insufficient_balance");
    expect(transactionErrorMessage(new Error("insufficient balance"), t)).toBe("txerror.insufficient_balance_plain");
  });
  it("falls back to the screen's own message only when the failure is not recognised", () => {
    expect(transactionErrorMessage(new Error("kaboom"), t, "payments.paymentFailed")).toBe("payments.paymentFailed");
    expect(transactionErrorMessage(new Error("Failed to fetch"), t, "payments.paymentFailed")).toBe("txerror.network");
  });
});
