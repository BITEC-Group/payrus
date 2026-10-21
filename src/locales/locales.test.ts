import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import en from "./en/common.json";
import es from "./es/common.json";
import fr from "./fr/common.json";
import pt from "./pt/common.json";

const LANGS = { fr, pt, es } as const;
const SRC = path.resolve(__dirname, "..");
const placeholders = (s: unknown) => (typeof s === "string" ? (s.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map((x) => x.replace(/\s/g, "")).sort().join(",") : "");

describe("locale files", () => {
  const enKeys = Object.keys(en);

  it.each(Object.entries(LANGS))("%s has exactly the same keys as en", (_lng, dict) => {
    const keys = new Set(Object.keys(dict));
    expect(enKeys.filter((k) => !keys.has(k))).toEqual([]);
    expect([...keys].filter((k) => !(k in en))).toEqual([]);
  });

  it.each(Object.entries(LANGS))("%s keeps every {{placeholder}} of the English text", (_lng, dict) => {
    const bad = enKeys.filter((k) => placeholders((en as Record<string, unknown>)[k]) !== placeholders((dict as Record<string, unknown>)[k]));
    expect(bad).toEqual([]);
  });

  it.each(Object.entries(LANGS))("%s has no empty translations", (_lng, dict) => {
    const empty = Object.entries(dict).filter(([, v]) => typeof v === "string" && v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("every literal t(\"key\") used in code exists in en", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) { if (f.name !== "locales") walk(p); }
        else if (/\.(tsx?)$/.test(f.name) && !/\.test\./.test(f.name)) files.push(p);
      }
    };
    walk(SRC);
    const known = new Set(enKeys);
    // plural keys are written as key_one / key_other and used as the base key
    const has = (k: string) => known.has(k) || known.has(`${k}_one`) || known.has(`${k}_other`);
    const missing: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*["'`]([\w.-]+)["'`]/g)) if (!has(m[1]) && m[1].includes(".")) missing.push(`${path.relative(SRC, f)}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
});

describe("no hardcoded user-facing text in JSX", () => {
  it("every JSX text node goes through t() (small allowlist of symbols and a product name)", () => {
    const require = createRequire(import.meta.url);
    const ts = require("typescript");
    const ALLOW = new Set(["% APY", "Micro-Equity Agricole ·"]);
    const found: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) { if (f.name !== "locales") walk(p); continue; }
        if (!p.endsWith(".tsx") || /\.test\./.test(f.name)) continue;
        const sf = ts.createSourceFile(p, readFileSync(p, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const visit = (n: { kind: number; text?: string; getStart: () => number; forEachChild?: unknown }) => {
          if (ts.isJsxText(n)) {
            const t = (n as unknown as { text: string }).text.replace(/&\w+;/g, " ").replace(/\s+/g, " ").trim();
            if (t && (t.match(/[A-Za-zÀ-ÿ]/g) ?? []).length >= 2 && !/^[\W\d_]+$/.test(t) && !ALLOW.has(t)) {
              const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
              found.push(`${path.relative(SRC, p)}:${line + 1} "${t.slice(0, 50)}"`);
            }
          }
          ts.forEachChild(n, visit);
        };
        visit(sf);
      }
    };
    walk(SRC);
    expect(found).toEqual([]);
  });
});
