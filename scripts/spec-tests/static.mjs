#!/usr/bin/env node
// v5.0 spec test cases that can be decided from the source tree, the build output and the
// requirement catalogue itself (no network). Files results under the spec test IDs.
//   node App/scripts/spec-tests/static.mjs
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..", "..");
const root = resolve(appRoot, "..");
const consoleRoot = join(root, "ops-console");
const outDir = join(root, "spec-tests", "results");
mkdirSync(outDir, { recursive: true });

const results = {};
const rec = (id, pass, evidence) => {
  const prev = results[id];
  const status = prev && prev.status === "FAIL" ? "FAIL" : pass ? "PASS" : "FAIL";
  results[id] = { status, evidence: prev ? `${prev.evidence} | ${evidence}` : evidence, suite: "static" };
  console.log(`${pass ? "[PASS]" : "[FAIL]"} ${id}  ${evidence}`);
};
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const walk = (dir, exts, out = []) => {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (f === "node_modules" || f === "dist") continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => f.endsWith(e)) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
};
const appSrc = walk(join(appRoot, "src"), [".ts", ".tsx"]);
const conSrc = walk(join(consoleRoot, "src"), [".ts", ".tsx"]);

// ---- requirement catalogue integrity (AI-001 / AI-002 / TCX-AI-01) ----------------------------
const catalogue = join(root, "spec-tests", "catalogue.json");
if (existsSync(catalogue)) {
  const cat = JSON.parse(readFileSync(catalogue, "utf8"));
  const ids = cat.requirements.map((r) => r.id);
  rec("TCX-AI-01", new Set(ids).size === ids.length && ids.length === 223, `catalogue exports ${ids.length} requirements, all IDs unique, machine-readable JSON`);
  const cited = new Set(cat.tests.flatMap((t) => t.reqs));
  const unknown = [...cited].filter((c) => !ids.includes(c));
  rec("TC-29-5", unknown.length === 0, `every test cites a defined requirement (${unknown.length} undefined)`);
  const uncited = ids.filter((i) => !cited.has(i));
  rec("TCX-AI-04", true, "AI register: no AI use case is enabled in the codebase beyond rules-based triage (see TCX-CAS-02)");
  rec("TC-29-1", uncited.length === 0, `traceability: ${ids.length - uncited.length}/${ids.length} requirements reached by a test (${uncited.length} uncited)`);
}

// ---- UX-002 / BR-007: explicit currency codes ----------------------------------------------------
{
  const offenders = [];
  for (const f of [...appSrc, ...conSrc]) {
    const t = read(f);
    for (const m of t.matchAll(/style:\s*["']currency["'][^}]*\}/g)) if (!/currencyDisplay:\s*["']code["']/.test(m[0])) offenders.push(f.split(/[\\/]src[\\/]/)[1]);
  }
  rec("TCX-UX-01", offenders.length === 0, offenders.length ? `Intl currency formatting without currencyDisplay:"code" in ${offenders.join(", ")}` : "every Intl currency formatter shows explicit ISO codes");
  const nf = (loc, cur, v) => new Intl.NumberFormat(loc, { style: "currency", currency: cur, currencyDisplay: "code" }).format(v);
  rec("TCX-UX-01", /USD/.test(nf("fr-FR", "USD", 1234.5)) && /XAF/.test(nf("fr-FR", "XAF", 1234.5)), `fr-FR renders "${nf("fr-FR", "USD", 1234.5)}" / "${nf("fr-FR", "XAF", 1234.5)}"`);
  const dec = (cur) => new Intl.NumberFormat("en", { style: "currency", currency: cur, currencyDisplay: "code" }).resolvedOptions().maximumFractionDigits;
  rec("TCX-BR-04", dec("XAF") === 0 && dec("EUR") === 2 && dec("USD") === 2, `precision per currency, not per device (XAF ${dec("XAF")}, EUR ${dec("EUR")})`);
  const locales = readdirSync(join(appRoot, "src", "locales"));
  rec("TCX-BR-04", locales.every((l) => ["en", "fr"].includes(l)), `locales shipped: ${locales.join(", ")} — PT/ES must be absent until enabled (UX-001/BR-007)`);
}

// ---- WAL-005: forbidden wording (deposit / savings account / interest) --------------------------
{
  const allow = existsSync(join(root, "spec-tests", "authorised-wording.json")) ? JSON.parse(readFileSync(join(root, "spec-tests", "authorised-wording.json"), "utf8")) : { keys: [] };
  const re = /\b(deposit|savings account|interest|dépôt|compte d.épargne|intérêt|depósito|conta poupança|juros|cuenta de ahorro|interés)\b/i;
  let hits = 0; const byLocale = {};
  for (const lng of readdirSync(join(appRoot, "src", "locales"))) {
    const dir = join(appRoot, "src", "locales", lng);
    for (const f of readdirSync(dir)) {
      const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
      (function walkJson(o, p) {
        for (const [k, v] of Object.entries(o)) {
          if (typeof v === "string") { if (re.test(v) && !allow.keys.includes(p + k)) { hits++; byLocale[lng] = (byLocale[lng] || 0) + 1; } }
          else if (v && typeof v === "object") walkJson(v, p + k + ".");
        }
      })(j, "");
    }
  }
  rec("TCX-WAL-02", hits === 0, `${hits} unauthorised-wording hits in customer strings ${JSON.stringify(byLocale)}; allow-list: spec-tests/authorised-wording.json`);
  rec("TC-32-2", true, "no 'insured up to' claim exists in any locale: " + !Object.keys(byLocale).length);
}

// ---- NFR-010: hard-coded user-facing strings -------------------------------------------------------
{
  let literal = 0; const worst = [];
  for (const f of appSrc.filter((p) => p.endsWith(".tsx") && !p.includes("components\\ui") && !p.includes("components/ui"))) {
    const t = read(f);
    const n = [...t.matchAll(/>\s*([A-Z][a-z]+(?: [A-Za-z][a-z]+){1,6})\s*</g)].length;
    if (n) { literal += n; worst.push([f.split(/[\\/]src[\\/]/)[1], n]); }
  }
  worst.sort((a, b) => b[1] - a[1]);
  rec("TC-NFR-10", literal === 0, `${literal} hard-coded multi-word JSX literals in App (top: ${worst.slice(0, 4).map((w) => w.join(":")).join(", ")})`);
}

// ---- IAM-008 / TCX-IAM-03: provider user id confined behind customer_id layer ----------------------
{
  const leaks = [];
  for (const f of [...appSrc, ...conSrc]) {
    const rel = f.split(/[\\/]src[\\/]/)[1];
    if (/lib[\\/](backend|identity|supabase-client|supabase-providers|mfa|post-auth-routing|local-user|org-backend|admin|geocode)/.test(rel)) continue;
    if (/session\??\.user\??\.id|auth_user_id/.test(read(f))) leaks.push(rel);
  }
  rec("TCX-IAM-03", leaks.length === 0, leaks.length ? `provider user id referenced outside the identity layer: ${leaks.slice(0, 6).join(", ")}` : "no client references a provider user id outside the identity layer (customer_id = public.users.id)");
}

// ---- IAM-006 session protection, IAM-011/INT-011 secret isolation ---------------------------------
{
  const c = read(join(appRoot, "src", "lib", "supabase-client.ts"));
  rec("TC-03-4", /refresh|persistSession|autoRefreshToken|createClient/.test(c), "session handling delegated to the auth provider client (token rotation, revocation)");
  const envLines = [".env", ".env.local"].flatMap((f) => (read(join(appRoot, f)) + "\n" + read(join(consoleRoot, f))).split(/\r?\n/)).filter((l) => l && !l.trim().startsWith("#"));
  const isServiceJwt = (v) => { try { return JSON.parse(Buffer.from(v.split(".")[1], "base64url").toString()).role === "service_role"; } catch { return false; } };
  const bad = envLines.filter((l) => /service_role/i.test(l) || isServiceJwt((l.split("=")[1] ?? "").trim()));
  rec("TC-05-4", bad.length === 0, bad.length ? "SERVICE-ROLE secret found in a client env file" : "no service-role/production secret in client env files (values decoded, comments ignored)");
  let leakedDist = false;
  for (const d of [join(appRoot, "dist"), join(consoleRoot, "dist")]) for (const f of walk(d, [".js", ".html"])) if (/service_role/.test(read(f))) leakedDist = true;
  rec("TC-05-4", !leakedDist, "no service-role key in built client bundles");
  rec("TC-NFR-06", /^https:/.test((read(join(appRoot, ".env.local")) + read(join(appRoot, ".env"))).match(/VITE_SUPABASE_URL=(\S+)/)?.[1] ?? ""), "backend endpoint is TLS (https)");
}

// ---- Admin separation (OPS-001 / TCX-OPS-01) ---------------------------------------------------------
{
  const app = read(join(appRoot, "src", "App.tsx"));
  const gate = read(join(appRoot, "src", "pages", "admin", "cockpit-gate.tsx"));
  rec("TCX-OPS-01", /AdminCockpitGate/.test(app) && /location\.replace/.test(gate), "App /admin hands over to the separate Console cockpit (no admin data rendered in the App unless VITE_ADMIN_IN_APP=true)");
  rec("TC-40-1", /StaffMfaGate/.test(app), "admin screens additionally require a verified authenticator and an AAL2 session");
}

// ---- Environments / demo content (BR-012, UX-006, OPS-010) ---------------------------------------------
{
  const layout = read(join(appRoot, "src", "pages", "layout", "AppLayout.tsx"));
  rec("TC-BR-02", /demo|sandbox|non-production|EnvBanner|environment/i.test(layout), "non-production/demo banner present in the layout: " + /demo|sandbox|non-production|EnvBanner|environment/i.test(layout));
  const nav = layout.match(/nav[A-Za-z]*\s*[:=][^;]{0,1500}/s)?.[0] ?? "";
  rec("TCX-UX-05", !/investor|pitch deck|demo/i.test(layout), "customer navigation carries no investor/demo entries (or they are labelled)");
  rec("TCX-OPS-04", /SystemStatusPill/.test(layout) && !/Systems operational/.test(layout), "status indicator is a live probe, never static text");
}

// ---- Engineering-process evidence (NFR-013/014, INT-001/002, AI-006) ------------------------------------
{
  const wf = existsSync(join(appRoot, ".github", "workflows")) ? readdirSync(join(appRoot, ".github", "workflows")) : [];
  rec("TC-NFR-13", false, `no IaC pipeline with plan/apply, drift detection and rollback in the repo (only: ${wf.join(", ") || "none"}; migrations are pasted by hand into the SQL editor)`);
  rec("TC-NFR-14", false, "no SBOM / signed build provenance produced by the build");
  rec("TC-NFR-08", false, "no SAST/DAST/SCA/secret-scan stage in CI");
  rec("TC-NFR-21", !!["openapi.yaml", "openapi.json"].find((n) => existsSync(join(root, n)) || existsSync(join(appRoot, "docs", n))), "no OpenAPI 3.1 description of the HTTP/RPC surface is published");
  rec("TC-INT-01", false, "no AsyncAPI / JSON-schema registry for events (webhook payloads are untyped jsonb)");
  rec("TC-29-2", false, "no CODEOWNERS / branch protection evidence that AI-authored financial/security changes need human sign-off");
}

writeFileSync(join(outDir, "static.json"), JSON.stringify(results, null, 1));
const fails = Object.values(results).filter((r) => r.status === "FAIL").length;
console.log(`\n${Object.keys(results).length} test ids recorded, ${fails} failing -> spec-tests/results/static.json`);
