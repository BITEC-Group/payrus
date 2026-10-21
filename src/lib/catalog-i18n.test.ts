import i18n from "i18next";
import { beforeAll, describe, expect, it } from "vitest";

import en from "@/locales/en/common.json";
import es from "@/locales/es/common.json";
import fr from "@/locales/fr/common.json";
import pt from "@/locales/pt/common.json";

import { catText, localizeApproval, localizeKind, localizeModule, localizeSubProfile, statusText } from "./catalog-i18n.ts";
import type { InstModule, PendingApproval, RecordKind, SubProfile } from "./institutional.ts";

beforeAll(async () => {
  await i18n.init({
    resources: { en: { common: en }, fr: { common: fr }, pt: { common: pt }, es: { common: es } },
    lng: "en", fallbackLng: "en", defaultNS: "common", ns: ["common"],
    keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false },
  });
});

const sub: SubProfile = {
  slug: "ngo", parentRole: "ngo", category: "public_sector", label: "NGO / Association",
  description: "Non-profit & civil society with donor collection tools", badge: "NGO", features: ["Donor collection", "Grant tracking"],
  enhancedKyc: false, relationshipMgr: false, sortOrder: 1,
};
const mod: InstModule & { subProfile: string | null } = { moduleKey: "invoicing", label: "Invoicing & billing", description: "Customer invoices, vendor bills, credit notes, ageing", icon: "x", sortOrder: 1, subProfile: null };
const kind: RecordKind = {
  slug: "invoice", moduleKey: "invoicing", label: "Invoice", pluralLabel: "Customer invoices", sortOrder: 1, parentKind: null, calc: "invoice",
  statuses: ["draft", "sent", "paid"], initialStatus: "draft", transitions: { draft: ["sent"] }, settle: "in", settleStatus: "paid",
  approvalStatus: null, approvalThreshold: null,
  fields: [{ key: "terms", label: "Payment terms", type: "select", options: ["Immediate", "30 days"] }],
};

describe("catalog translation", () => {
  it.each([
    ["en", "Invoice", "Invoice"], ["fr", "Invoice", "Facture"], ["pt", "Invoice", "Fatura"], ["es", "Invoice", "Factura"],
    ["fr", "30 days", "30 jours"], ["pt", "Quota share", "Quota-parte"], ["es", "Policyholder", "Tomador"],
  ])("%s: %s -> %s", async (lng, text, expected) => {
    await i18n.changeLanguage(lng);
    expect(catText(i18n.t, text)).toBe(expected);
  });

  it("shows text without a translation as written", async () => {
    await i18n.changeLanguage("fr");
    expect(catText(i18n.t, "Something new")).toBe("Something new");
    expect(catText(i18n.t, "")).toBe("");
  });

  it.each([["fr", "Brouillon"], ["pt", "Rascunho"], ["es", "Borrador"], ["en", "Draft"]])("status draft in %s", async (lng, expected) => {
    await i18n.changeLanguage(lng);
    expect(statusText(i18n.t, "draft")).toBe(expected);
  });

  it("formats an unknown status as a sentence", async () => {
    await i18n.changeLanguage("fr");
    expect(statusText(i18n.t, "partly_paid")).toBe("Partly paid");
    expect(statusText(i18n.t, "pending_approval")).toBe("En attente d'approbation");
    expect(statusText(i18n.t, "written_off")).toBe("Passé en perte");
  });

  it("translates sub-profile, module, kind and approval text", async () => {
    await i18n.changeLanguage("es");
    expect(localizeSubProfile(i18n.t, sub)).toMatchObject({ label: "ONG / asociación", badge: "ONG", features: ["Recaudación de donaciones", "Seguimiento de subvenciones"] });
    expect(localizeModule(i18n.t, mod)).toMatchObject({ label: "Facturación y cobros", subProfile: null });
    expect(localizeKind(i18n.t, kind)).toMatchObject({ label: "Factura", pluralLabel: "Facturas de clientes" });
    const approval = { kindLabel: "Invoice" } as PendingApproval;
    expect(localizeApproval(i18n.t, approval).kindLabel).toBe("Factura");
  });

  it("leaves slugs, statuses, transitions and select options as stored", async () => {
    await i18n.changeLanguage("fr");
    const out = localizeKind(i18n.t, kind);
    expect(out.slug).toBe("invoice");
    expect(out.statuses).toEqual(["draft", "sent", "paid"]);
    expect(out.transitions).toEqual({ draft: ["sent"] });
    expect(out.fields[0]).toMatchObject({ key: "terms", label: "Conditions de paiement", options: ["Immediate", "30 days"] });
  });

  it("has every catalog entry in all four languages", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("cat."));
    expect(keys.length).toBeGreaterThan(350);
    for (const [name, loc] of Object.entries({ fr, pt, es }) as [string, Record<string, string>][]) {
      expect(keys.filter((k) => !loc[k]), name).toEqual([]);
    }
  });
});
