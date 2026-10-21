import i18n from "i18next";
import { beforeAll, describe, expect, it } from "vitest";

import { formatCompact } from "./format-compact.ts";

beforeAll(async () => {
  await i18n.init({ resources: { en: { common: {} }, fr: { common: {} }, pt: { common: {} }, es: { common: {} } }, lng: "en", fallbackLng: "en", defaultNS: "common", ns: ["common"] });
});

describe("formatCompact", () => {
  it.each([
    ["en", 12_800_000, "12.8M"], ["en", 4_000, "4K"],
    ["fr", 12_800_000, "12,8"], ["es", 12_800_000, "12,8"], ["pt", 12_800_000, "12,8"],
  ])("%s %d contains %s", async (lng, n, expected) => {
    await i18n.changeLanguage(lng);
    expect(formatCompact(n)).toContain(expected);
  });

  it("uses the language's decimal comma and keeps small numbers plain", async () => {
    await i18n.changeLanguage("fr");
    expect(formatCompact(12_800_000)).not.toContain(".");
    expect(formatCompact(250)).toBe("250");
  });
});
