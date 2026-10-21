import type { TFunction } from "i18next";

/**
 * Notifications are written by the database in English, with values spliced in ("USD 787.71 added to your wallet").
 * This maps the messages the backend is known to produce onto locale keys (dbnotif.*) so they follow the language switch;
 * anything unrecognised is shown as written.
 */
const TITLES: Record<string, string> = {
  "Deposit received": "dbnotif.title.deposit",
  "Currency converted": "dbnotif.title.convert",
  "Remittance sent": "dbnotif.title.remittance",
  "Transfer sent": "dbnotif.title.transfer",
  "Payment sent": "dbnotif.title.paymentSent",
  "Payout sent": "dbnotif.title.payoutSent",
  "Transaction completed": "dbnotif.title.txCompleted",
  "Transaction updated": "dbnotif.title.txUpdated",
  "Transaction cancelled": "dbnotif.title.txCancelled",
  "Card issued": "dbnotif.title.cardIssued",
  "Wallet created": "dbnotif.title.walletCreated",
  "Payment link paid": "dbnotif.title.paymentLinkPaid",
  "Cash picked up": "dbnotif.title.cashPickedUp",
  "Money delivered": "dbnotif.title.moneyDelivered",
  "Account restricted": "dbnotif.title.accountRestricted",
  "Added to a workspace": "dbnotif.title.addedToWorkspace",
  "Sensitive data accessed (break-glass)": "dbnotif.title.breakGlass",
};

const BODIES: Array<[RegExp, string, (m: RegExpMatchArray) => Record<string, string>]> = [
  [/^([A-Z]{3}) ([\d.,]+) added to your wallet$/, "dbnotif.body.added", (m) => ({ currency: m[1], amount: m[2] })],
  [/^([A-Z]{3}) ([\d.,]+) converted to ([A-Z]{3})$/, "dbnotif.body.converted", (m) => ({ currency: m[1], amount: m[2], to: m[3] })],
  [/^([A-Z]{3}) ([\d.,]+) sent$/, "dbnotif.body.sent", (m) => ({ currency: m[1], amount: m[2] })],
  [/^Your virtual card ending (\d{4}) is ready\.$/, "dbnotif.body.cardReady", (m) => ({ last4: m[1] })],
  [/^Your ([A-Z]{3}) wallet is ready\. Top it up to start using it\.$/, "dbnotif.body.walletReady", (m) => ({ currency: m[1] })],
  [/^Sending from your wallet is temporarily restricted\.$/, "dbnotif.body.restricted", () => ({})],
  [/^Your test account is ready\. No email confirmation and no two-factor code are needed\. Your starter wallet and virtual card open in ([A-Z]{3})(?: \(([^)]*)\))? with a zero balance: top up to start\. Sample contacts are in your address book to send money to\. Everything here is simulated, so no real money moves\.$/, "dbnotif.body.welcome", (m) => ({ currency: m[1], country: m[2] ? ` (${m[2]})` : "" })],
  [/^Your test account is ready\. No email confirmation and no two-factor code are needed\. Choose a profile to open your starter wallet and virtual card\. Sample contacts are in your address book to send money to\. Everything here is simulated, so no real money moves\.$/, "dbnotif.body.welcomeNoCurrency", () => ({})],
];

export function localizeNotification(n: { title: string; body: string }, t: TFunction): { title: string; body: string } {
  let title = n.title;
  let body = n.body;
  const welcome = n.title.match(/^Welcome to PayRus, (.+)!$/);
  if (welcome) title = t("dbnotif.title.welcome", { name: welcome[1] });
  else if (TITLES[n.title]) title = t(TITLES[n.title]);
  for (const [re, key, params] of BODIES) {
    const m = n.body.match(re);
    if (m) { body = t(key, params(m)); break; }
  }
  return { title, body };
}

/** Notes the backend writes on transfers ("Game bet: sports", "Payout to Amina") in the active language; any other note is shown as written. */
const NOTES: Array<[RegExp, string, (m: RegExpMatchArray) => Record<string, string>]> = [
  [/^Game bet: (.+)$/, "dbnote.gameBet", (m) => ({ kind: m[1] })],
  [/^Game bet win: (.+)$/, "dbnote.gameBetWin", (m) => ({ kind: m[1] })],
  [/^Travel installment charge$/, "dbnote.travelInstallment", () => ({})],
  [/^(.+) \(instalment (\d+)\/(\d+)\)$/, "dbnote.instalment", (m) => ({ item: m[1], n: m[2], total: m[3] })],
  [/^Travel demo funds$/, "dbnote.travelDemoFunds", () => ({})],
  [/^Refund: (.+)$/, "dbnote.refund", (m) => ({ item: m[1] })],
  [/^Fundraise: (.+)$/, "dbnote.fundraise", (m) => ({ title: m[1] })],
  [/^Payout to (.+)$/, "dbnote.payoutTo", (m) => ({ name: m[1] })],
  [/^Tontine payout: (.+)$/, "dbnote.tontinePayout", (m) => ({ x: m[1] })],
  [/^Tontine: (.+)$/, "dbnote.tontine", (m) => ({ x: m[1] })],
  [/^Invest: (.+)$/, "dbnote.invest", (m) => ({ x: m[1] })],
  [/^Savings: (.+)$/, "dbnote.savings", (m) => ({ x: m[1] })],
  [/^Bill: (.+)$/, "dbnote.bill", (m) => ({ x: m[1] })],
  [/^Bills$/, "dbnote.bills", () => ({})],
  [/^Loyalty spend: (.+)$/, "dbnote.loyaltySpend", (m) => ({ x: m[1] })],
  [/^Expense reimbursement: (.+)$/, "dbnote.expenseReimbursement", (m) => ({ x: m[1] })],
  [/^Sandbox test funds$/, "dbnote.sandboxFunds", () => ({})],
  [/^Pitch repayment$/, "dbnote.pitchRepayment", () => ({})],
];

export function localizeTransferNote(note: string, t: TFunction): string {
  for (const [re, key, params] of NOTES) {
    const m = note.match(re);
    if (m) return t(key, params(m));
  }
  return note;
}
