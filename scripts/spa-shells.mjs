#!/usr/bin/env node
// TCX-NEW-06 (OPS-010): a monitor or crawler that requests /<locale>/<route> directly must get HTTP 200, not GitHub
// Pages' 404 followed by a client-side redirect. After the build, write a copy of index.html (the SPA shell) at every
// static <locale>/<route>/index.html so Pages serves it with 200. Dynamic routes (":param") keep the 404.html fallback.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.DIST_DIR ?? join(root, "dist");
if (!existsSync(join(dist, "index.html"))) { console.log("spa-shells: no dist/index.html, skipping"); process.exit(0); }

const app = readFileSync(join(root, "src", "App.tsx"), "utf8");
const routes = [...new Set([...app.matchAll(/<Route\s+path="([^":*]+)"/g)].map((m) => m[1]).filter((p) => !p.startsWith("/") && !p.includes(":")))];
const localesDir = join(root, "src", "locales");
const locales = readdirSync(localesDir).filter((d) => statSync(join(localesDir, d)).isDirectory());

let n = 0;
for (const lng of locales) {
  for (const route of ["", ...routes]) {
    const dir = join(dist, lng, route);
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(dist, "index.html"), join(dir, "index.html"));
    n++;
  }
}
console.log(`spa-shells: wrote ${n} shells (${locales.length} locales × ${routes.length + 1} routes)`);
