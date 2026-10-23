import i18n from "i18next";
import { beforeAll, describe, expect, it } from "vitest";

import en from "@/locales/en/common.json";
import es from "@/locales/es/common.json";
import fr from "@/locales/fr/common.json";
import pt from "@/locales/pt/common.json";

import { localizeNotification, localizeTransferNote } from "./db-notifications.ts";
import { monthLabel, potDueLabel, txTypeLabel, weekdayName } from "./i18n-labels.ts";

beforeAll(async () => {
  await i18n.init({
    resources: { en: { common: en }, fr: { common: fr }, pt: { common: pt }, es: { common: es } },
    lng: "en", fallbackLng: "en", defaultNS: "common", ns: ["common"],
    keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false },
  });
});

describe("transaction type labels", () => {
  it.each([
    ["en", "deposit", "Top-up"], ["fr", "deposit", "Recharge"], ["pt", "deposit", "Carregamento"], ["es", "deposit", "Recarga"],
    ["en", "convert_out", "Conversion out"], ["fr", "convert_out", "Conversion sortante"], ["pt", "remittance", "Remessa"], ["es", "remittance", "Remesa"],
  ])("%s %s -> %s", async (lng, type, label) => {
    await i18n.changeLanguage(lng);
    expect(txTypeLabel(i18n.t, type)).toBe(label);
  });

  it("falls back to the raw type for an unknown type", async () => {
    await i18n.changeLanguage("fr");
    expect(txTypeLabel(i18n.t, "something_new")).toBe("something_new");
  });
});

describe("month labels", () => {
  it("follow the language", () => {
    expect(monthLabel("Mar", "en")).toBe("Mar");
    expect(monthLabel("Mar", "fr").toLowerCase()).toContain("mars");
    expect(monthLabel("Aug", "es").toLowerCase()).toContain("ago");
    expect(monthLabel("Aug", "pt").toLowerCase()).toContain("ago");
    expect(monthLabel("Foo", "fr")).toBe("Foo");
  });
});

describe("database notifications", () => {
  const cases: Array<[string, { title: string; body: string }, { title: string; body: string }]> = [
    ["fr", { title: "Deposit received", body: "USD 787.71 added to your wallet" }, { title: "Recharge reçue", body: "USD 787.71 ajoutés à votre portefeuille" }],
    ["pt", { title: "Currency converted", body: "XAF 80,000.00 converted to USD" }, { title: "Moeda convertida", body: "XAF 80,000.00 convertidos em USD" }],
    ["es", { title: "Wallet created", body: "Your AED wallet is ready. Top it up to start using it." }, { title: "Monedero creado", body: "Su monedero AED está listo. Recárguelo para empezar a usarlo." }],
    ["fr", { title: "Card issued", body: "Your virtual card ending 3640 is ready." }, { title: "Carte émise", body: "Votre carte virtuelle se terminant par 3640 est prête." }],
    ["fr", { title: "Welcome to PayRus, Amina!", body: "Your test account is ready. No email confirmation and no two-factor code are needed. Your starter wallet and virtual card open in XAF (Cameroon) with a zero balance: top up to start. Sample contacts are in your address book to send money to. Everything here is simulated, so no real money moves." }, { title: "Bienvenue sur PayRus, Amina !", body: "Votre compte de test est prêt. Aucune confirmation par e-mail ni code à deux facteurs n'est nécessaire. Votre portefeuille et votre carte virtuelle s'ouvrent en XAF (Cameroon) avec un solde nul : rechargez pour commencer. Des contacts d'exemple sont dans votre carnet d'adresses pour envoyer de l'argent. Tout est simulé ici : aucun argent réel n'est déplacé." }],
    ["fr", { title: "Second notice recorded", body: "INV-2026-000009 · Latepayer is 20 days overdue (5000.00 XAF)." }, { title: "Deuxième relance enregistrée", body: "INV-2026-000009 · Latepayer a 20 jours de retard (5000.00 XAF)." }],
    ["pt", { title: "Escalation rejected", body: "Your escalation (other) was rejected: closing it" }, { title: "Escalonamento rejeitado", body: "O seu escalonamento (outro) foi rejeitado: closing it" }],
  ];
  it.each(cases)("%s: %j", async (lng, input, expected) => {
    await i18n.changeLanguage(lng);
    expect(localizeNotification(input, i18n.t)).toEqual(expected);
  });

  it("shows an unrecognised message as written", async () => {
    await i18n.changeLanguage("fr");
    expect(localizeNotification({ title: "Something custom", body: "Free text from staff" }, i18n.t)).toEqual({ title: "Something custom", body: "Free text from staff" });
  });
});

describe("transfer notes written by the database", () => {
  const cases: Array<[string, string, string]> = [
    ["fr", "Game bet: sports", "Pari de jeu : sports"],
    ["es", "Game bet win: lotto", "Premio de apuesta: lotto"],
    ["pt", "Payout to Tito salumu", "Pagamento a Tito salumu"],
    ["fr", "Travel installment charge", "Prélèvement d'échéance de voyage"],
    ["fr", "Sofitel Abidjan (instalment 1/3)", "Sofitel Abidjan (échéance 1/3)"],
    ["es", "Air France KIN→CDG (instalment 2/3)", "Air France KIN→CDG (cuota 2/3)"],
    ["pt", "Serena Hotel (instalment 3/3)", "Serena Hotel (prestação 3/3)"],
    ["fr", "Bill: SEEG — Water", "Facture : SEEG — Water"],
    ["es", "Tontine: Njangi Douala Sud", "Tontina: Njangi Douala Sud"],
    ["pt", "Invest: Kinshasa Solar Micro-Grid", "Investimento: Kinshasa Solar Micro-Grid"],
    ["fr", "Sandbox test funds", "Fonds de test sandbox"],
    ["es", "Loyalty spend: Live-verify Cafe", "Gasto de fidelidad: Live-verify Cafe"],
    ["pt", "Refund: Serena Hotel Nairobi", "Reembolso: Serena Hotel Nairobi"],
    ["es", "Fundraise: Live-verify campaign", "Recaudación: Live-verify campaign"],
  ];
  it.each(cases)("%s: %s", async (lng, note, expected) => {
    await i18n.changeLanguage(lng);
    expect(localizeTransferNote(note, i18n.t)).toBe(expected);
  });

  it("shows any other note as written", async () => {
    await i18n.changeLanguage("fr");
    expect(localizeTransferNote("Birthday gift", i18n.t)).toBe("Birthday gift");
  });
});

describe("savings goal dates", () => {
  it("translates month-year dates, Ongoing and ISO dates", async () => {
    await i18n.changeLanguage("fr");
    expect(potDueLabel(i18n.t, "Ongoing", "fr")).toBe("En cours");
    expect(potDueLabel(i18n.t, "Sep 2026", "fr").toLowerCase()).toContain("sept");
    expect(potDueLabel(i18n.t, "Dec 2026", "es").toLowerCase()).toContain("dic");
    expect(potDueLabel(i18n.t, "2026-12-31", "pt").toLowerCase()).toContain("dez");
    expect(potDueLabel(i18n.t, "Someday", "fr")).toBe("Someday");
  });
});

describe("plan, card and bill labels", () => {
  it.each([
    ["fr", "Free", "Gratuit"], ["pt", "Grow", "Crescimento"], ["es", "Virtual", "Virtual"], ["fr", "Virtual", "Virtuelle"],
    ["pt", "Monthly subscription", "Subscrição mensal"], ["es", "Libreville · utilities", "Libreville · servicios públicos"],
    ["fr", "plans.value.priority", "prioritaire"], ["es", "savings.ongoing", "En curso"],
    ["fr", "Add Money", "Ajouter de l'argent"], ["pt", "Convert", "Converter"], ["es", "● live", "● en vivo"],
    ["fr", "Interbank", "Interbancaire"], ["pt", "Clearing", "Compensação"], ["es", "+12.4% vs yesterday", "+12,4 % respecto a ayer"],
    ["fr", "Society for Worldwide Interbank Financial Telecommunication", "Société de télécommunications financières interbancaires mondiales"],
    ["es", "travel.amenity.priority_boarding", "Embarque prioritario"], ["pt", "travel.amenity.lounge", "Sala VIP"],
    ["fr", "Smooth overnight flight, boarding was a little slow.", "Vol de nuit agréable, l'embarquement a été un peu lent."],
  ])("%s %s -> %s", async (lng, key, expected) => {
    await i18n.changeLanguage(lng);
    expect(i18n.t(key)).toBe(expected);
  });

  it("pluralises the pending-transaction count", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("stats.pendingTx", { count: 1 })).toBe("1 transaction");
    expect(i18n.t("stats.pendingTx", { count: 2 })).toBe("2 transactions");
  });
});

describe("weekday names", () => {
  it("names the weekday in the requested language", () => {
    expect(weekdayName(3, "en")).toBe("Wednesday");
    expect(weekdayName(3, "fr")).toBe("Mercredi");
    expect(weekdayName(3, "es")).toBe("Miércoles");
    expect(weekdayName(3, "pt").toLowerCase()).toContain("quarta");
  });
});
