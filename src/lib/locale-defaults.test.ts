import { afterEach, describe, expect, it } from "vitest";
import "./locale-defaults.ts";

// TCX-NEW-04: numbers follow the app language, not the browser's.
describe("locale defaults", () => {
  afterEach(() => { document.documentElement.lang = "en"; });

  it("uses a decimal comma in French", () => {
    document.documentElement.lang = "fr";
    expect((0.7467).toLocaleString(undefined, { maximumFractionDigits: 4 })).toBe("0,7467");
  });

  it("uses a decimal point in English", () => {
    document.documentElement.lang = "en";
    expect((0.7467).toLocaleString(undefined, { maximumFractionDigits: 4 })).toBe("0.7467");
  });

  it("follows Portuguese and Spanish thousands separators", () => {
    document.documentElement.lang = "es";
    expect((1234567.5).toLocaleString(undefined, { maximumFractionDigits: 2 })).toMatch(/1\.234\.567,5/);
    document.documentElement.lang = "pt";
    expect((1234567.5).toLocaleString(undefined, { maximumFractionDigits: 2 })).toMatch(/1[s.]234[s.]567,5/);
  });

  it("an explicit locale still wins", () => {
    document.documentElement.lang = "fr";
    expect((0.7467).toLocaleString("en", { maximumFractionDigits: 4 })).toBe("0.7467");
  });
});
