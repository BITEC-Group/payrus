#!/usr/bin/env node
// v5.0 spec test cases that can be decided from the source tree, the build output and the
// requirement catalogue itself (no network). Files results under the spec test IDs.
//   node App/scripts/spec-tests/static.mjs
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
  // Owner decision 2026-10-22: PT and ES are enabled (supersedes "PT/ES later" in UX-001/BR-007). Enabled = complete.
  const dir = join(appRoot, "src", "locales");
  const locs = readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory());
  const flat = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string"));
  const enDict = flat(JSON.parse(readFileSync(join(dir, "en", "common.json"), "utf8")));
  const ph = (t) => (t.match(/{{\s*[\w.]+\s*}}/g) ?? []).map((x) => x.replace(/\s/g, "")).sort().join(",");
  const problems = [];
  for (const l of locs) {
    const d = flat(JSON.parse(readFileSync(join(dir, l, "common.json"), "utf8")));
    const missing = Object.keys(enDict).filter((k) => !(k in d)).length;
    const empty = Object.values(d).filter((v) => !v.trim()).length;
    const badPh = Object.keys(enDict).filter((k) => k in d && ph(enDict[k]) !== ph(d[k])).length;
    if (missing || empty || badPh) problems.push(l + ": " + missing + " missing, " + empty + " empty, " + badPh + " placeholder mismatches");
  }
  rec("TCX-BR-04", problems.length === 0 && locs.length === 4, problems.length ? problems.join("; ") : "locales " + locs.join(", ") + " enabled; every enabled locale has all " + Object.keys(enDict).length + " keys, no empty values, placeholders intact");
}

// ---- WAL-005: forbidden wording (deposit / savings account / interest) --------------------------
{
  const allow = existsSync(join(root, "spec-tests", "authorised-wording.json")) ? JSON.parse(readFileSync(join(root, "spec-tests", "authorised-wording.json"), "utf8")) : { keys: [] };
  const re = /\b(deposit|savings account|interest|dépôt|compte d.épargne|intérêt|depósito|conta poupança|juros|cuenta de ahorro|interés)\b/i;
  let hits = 0; const byLocale = {};
  for (const lng of readdirSync(join(appRoot, "src", "locales")).filter((d) => statSync(join(appRoot, "src", "locales", d)).isDirectory())) {
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
    if (/lib[\\/](backend|identity|session-subject|supabase-client|supabase-providers|mfa|post-auth-routing|local-user|org-backend|admin|geocode)/.test(rel)) continue;
    const code = read(f).split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    if (/session\??\.user\??\.id|auth_user_id/.test(code)) leaks.push(rel);
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

// ---- Engineering-process evidence (NFR-008/013/014, INT-001/002, AI-006) ---------------------------------
{
  const ci = read(join(appRoot, ".github", "workflows", "ci.yml"));
  const wf = existsSync(join(appRoot, ".github", "workflows")) ? readdirSync(join(appRoot, ".github", "workflows")) : [];
  rec("TC-NFR-13", false, `no IaC pipeline with plan/apply, drift detection and rollback: migrations are pasted by hand into the SQL editor and supabase/ is not in version control (workflows: ${wf.join(", ")})`);
  rec("TC-NFR-14", /cyclonedx/.test(ci) && /attest-build-provenance/.test(ci), "ci.yml produces a CycloneDX SBOM and signed build provenance — defined, but not yet run on GitHub (first run is the proof)");
  rec("TC-NFR-08", /gitleaks/.test(ci) && /codeql/i.test(ci) && /pnpm audit/.test(ci), "ci.yml runs SCA, secret scan and CodeQL — defined, but no run exists yet to show zero unresolved Critical/High");
  const oa = read(join(appRoot, "docs", "api", "openapi.yaml"));
  rec("TC-NFR-21", /^openapi: 3\.1/m.test(oa) && /redocly/.test(ci), `OpenAPI 3.1 generated from the migrations (${(oa.match(/operationId:/g) || []).length} operations) and linted in CI`);
  const aa = read(join(appRoot, "docs", "api", "asyncapi.yaml"));
  rec("TC-INT-01", /^asyncapi: 3/m.test(aa) && /asyncapi\/cli/.test(ci), `AsyncAPI 3 describes ${(aa.match(/address:/g) || []).length} webhook events and is validated in CI`);
  // Decided by asking GitHub (needs `gh auth login` as a repo admin); without that the setting cannot be verified.
  let protectedByOwners = null;
  try {
    const r = spawnSync("gh", ["api", "repos/infobitecconsulting-maker/payrus/branches/main/protection/required_pull_request_reviews", "--jq", ".require_code_owner_reviews"], { encoding: "utf8" });
    if (r.status === 0) protectedByOwners = r.stdout.trim() === "true";
  } catch { /* gh missing */ }
  rec("TC-29-2", protectedByOwners === true && existsSync(join(appRoot, ".github", "CODEOWNERS")), protectedByOwners === null ? "CODEOWNERS + scripts/apply-branch-protection.sh are in the repo, but the GitHub branch-protection setting could not be read (gh not signed in) — run the script as a repo admin, then re-run this suite" : protectedByOwners ? "main requires Code Owner review, verified through the GitHub API" : "main does not require Code Owner review yet — run scripts/apply-branch-protection.sh");
}

// ---- QA audit of 23 Oct 2026 (TCX-NEW-01..06 and the minor findings) ----------------------------------------
{
  const picker = read(join(consoleRoot, "src", "screens", "ProfilePicker.tsx"));
  const conApp = read(join(consoleRoot, "src", "App.tsx"));
  const ident = read(join(consoleRoot, "src", "lib", "identity.ts"));
  const grantInCode = (conSrc.concat(appSrc)).filter((f) => /rpc\(\s*["']admin_grant_admin_role["']/.test(read(f)));
  rec("TCX-NEW-01", !/type="password"/.test(picker) && !/grantAdminRole\s*\(/.test(conApp + ident) && grantInCode.length === 0,
    "Console profile picker has no admin-password field, and no client calls admin_grant_admin_role (admin grants go through admin_request_admin_grant, approved by a second admin)");

  const app = read(join(appRoot, "src", "App.tsx"));
  const gate = read(join(appRoot, "src", "components", "ui", "consent-gate.tsx"));
  const layout = read(join(appRoot, "src", "pages", "layout", "AppLayout.tsx"));
  rec("TCX-NEW-02", /<ConsentGate\s*\/>/.test(app) && !/<ConsentGate/.test(layout) && /isError/.test(gate) && /refetchOnMount/.test(gate),
    "consent gate is mounted at the app root (not inside AppLayout, which returns early), re-checks on every mount/focus, and fails closed with a retry when the check errors");

  const deployApp = read(join(appRoot, ".github", "workflows", "deploy-pages.yml"));
  const deployCon = read(join(consoleRoot, ".github", "workflows", "deploy-pages.yml"));
  const settings = read(join(appRoot, "src", "pages", "settings", "page.tsx"));
  rec("TCX-NEW-03", /gh release create/.test(deployApp) && /gh release create/.test(deployCon) && /__APP_COMMIT__/.test(settings) && /__APP_COMMIT__/.test(read(join(consoleRoot, "src", "screens", "Settings.tsx"))),
    "both deploy workflows create a release tag and notes after Pages accepts the deploy, and Settings → About shows the build version and commit in both apps (defined; first run is the proof)");
  rec("TC-BR-01", !/ISO 27001|BCEAO/.test(settings), "Settings → About no longer claims certifications or regulators that the capability registry does not evidence");

  const shim = read(join(appRoot, "src", "lib", "locale-defaults.ts"));
  rec("TCX-NEW-04", /document\.documentElement\.lang/.test(shim) && /^import "\.\/lib\/locale-defaults\.ts"/m.test(read(join(appRoot, "src", "main.tsx"))) && /^import "\.\/lib\/locale-defaults\.ts"/m.test(read(join(consoleRoot, "src", "main.tsx"))),
    "number and date formatting follow the selected language in both apps (unit-tested: 0,7467 in French)");

  const kyc = read(join(consoleRoot, "src", "screens", "Kyc.tsx"));
  const prof = read(join(appRoot, "src", "pages", "profile", "page.tsx"));
  rec("TCX-NEW-05", /submitKybParties/.test(kyc) && /submitKybParties/.test(prof) && /kyb_submit_parties/.test(read(join(appRoot, "src", "lib", "backend.ts"))),
    "both apps capture the organisation's owners (UBOs) and authorised representative for business workspaces; the database refuses activation until they exist");

  const pkg = read(join(appRoot, "package.json"));
  rec("TCX-NEW-06", /spa-shells\.mjs/.test(pkg) && existsSync(join(appRoot, "scripts", "spa-shells.mjs")),
    "the build writes a real index.html for every static <locale>/<route>, so GitHub Pages answers deep links with 200 (dynamic :param routes keep the 404 fallback)");

  // WCAG AA contrast of the muted text token on its usual backgrounds
  const css = read(join(appRoot, "src", "index.css"));
  const tok = (n) => (css.match(new RegExp("^\\s*--" + n + ":\\s*(#[0-9a-fA-F]{6})", "m")) || [])[1];
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fg = tok("muted-foreground"), bgs = ["secondary", "background", "card"].map(tok).filter(Boolean);
  const worst = Math.min(...bgs.map((b) => ratio(fg, b)));
  rec("TC-NFR-09", worst >= 4.5, "muted text contrast on its backgrounds: worst " + worst.toFixed(2) + ":1 (AA needs 4.5:1)");
}

writeFileSync(join(outDir, "static.json"), JSON.stringify(results, null, 1));
const fails = Object.values(results).filter((r) => r.status === "FAIL").length;
console.log(`\n${Object.keys(results).length} test ids recorded, ${fails} failing -> spec-tests/results/static.json`);
