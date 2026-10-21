import i18n from "i18next";
import { beforeAll, describe, expect, it } from "vitest";

import en from "@/locales/en/common.json";
import es from "@/locales/es/common.json";
import fr from "@/locales/fr/common.json";
import pt from "@/locales/pt/common.json";

import { localizeNotification, localizeTransferNote } from "./db-notifications.ts";
import { monthLabel, txTypeLabel } from "./i18n-labels.ts";

beforeAll(async () => {
  await i18n.init({
    resources: { en: { common: en }, fr: { common: fr }, pt: { common: pt }, es: { common: es } },
    lng: "en", fallbackLng: "en", defaultNS: "common", ns: ["common"],
    keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false },
  });
});

describe("transaction type labels", () => {
  it.each([
    ["en", "deposit", "Deposit"], ["fr", "deposit", "Dépôt"], ["pt", "deposit", "Depósito"], ["es", "deposit", "Depósito"],
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
    ["fr", { title: "Deposit received", body: "USD 787.71 added to your wallet" }, { title: "Dépôt reçu", body: "USD 787.71 ajoutés à votre portefeuille" }],
    ["pt", { title: "Currency converted", body: "XAF 80,000.00 converted to USD" }, { title: "Moeda convertida", body: "XAF 80,000.00 convertidos em USD" }],
    ["es", { title: "Wallet created", body: "Your AED wallet is ready. Top it up to start using it." }, { title: "Monedero creado", body: "Su monedero AED está listo. Recárguelo para empezar a usarlo." }],
    ["fr", { title: "Card issued", body: "Your virtual card ending 3640 is ready." }, { title: "Carte émise", body: "Votre carte virtuelle se terminant par 3640 est prête." }],
    ["fr", { title: "Welcome to PayRus, Amina!", body: "Your test account is ready. No email confirmation and no two-factor code are needed. Your starter wallet and virtual card open in XAF (Cameroon) with a zero balance: top up to start. Sample contacts are in your address book to send money to. Everything here is simulated, so no real money moves." }, { title: "Bienvenue sur PayRus, Amina !", body: "Votre compte de test est prêt. Aucune confirmation par e-mail ni code à deux facteurs n'est nécessaire. Votre portefeuille et votre carte virtuelle s'ouvrent en XAF (Cameroon) avec un solde nul : rechargez pour commencer. Des contacts d'exemple sont dans votre carnet d'adresses pour envoyer de l'argent. Tout est simulé ici : aucun argent réel n'est déplacé." }],
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
