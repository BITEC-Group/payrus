import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The App and the Console are served from the same site (…/payrus/ and …/PayRus-Console/). A manifest "id" of "./"
// resolves to the site root for both, which makes browsers treat them as ONE app (installing one hides or replaces
// the other). Each needs its own explicit id.
const manifest = JSON.parse(readFileSync(join(process.cwd(), "public", "site.webmanifest"), "utf8")) as {
  id?: string; name: string; short_name: string; start_url: string; scope: string; display: string; icons: { src: string; purpose?: string }[];
};

describe("web app manifest", () => {
  it("has its own identity, not the site root", () => {
    expect(manifest.id).toBe("/payrus/");
    expect(manifest.id).not.toBe("./");
    expect(manifest.id).not.toBe("/");
  });

  it("stays inside its own folder, so it cannot overlap the Console", () => {
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
  });

  it("is installable: name, standalone display and 192/512 icons", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map((i) => i.src)).toEqual(expect.arrayContaining(["icon/icon-192.png", "icon/icon-512.png"]));
  });
});
