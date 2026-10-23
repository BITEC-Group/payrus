import { afterEach, describe, expect, it, vi } from "vitest";

import { copyLink, detectInstallPlatform, shareOrCopyLink } from "./install-platform.ts";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1";
const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.12.108 (iPhone14,5; iOS 17_4; en_US)";
const IPHONE_FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0.0;FBBV/1;FBDV/iPhone14,5]";
const IPHONE_WEBVIEW = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const MAC_SAFARI_17 = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const MAC_SAFARI_16 = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15";
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const MAC_FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";

describe("detectInstallPlatform", () => {
  it.each([
    ["iPhone Safari", { userAgent: IPHONE_SAFARI }, "ios"],
    ["iPhone Chrome", { userAgent: IPHONE_CHROME }, "ios"],
    ["iPad that reports itself as a Mac", { userAgent: MAC_SAFARI_17, platform: "MacIntel", maxTouchPoints: 5 }, "ios"],
    ["Instagram in-app browser", { userAgent: IPHONE_INSTAGRAM }, "ios-inapp"],
    ["Facebook in-app browser", { userAgent: IPHONE_FACEBOOK }, "ios-inapp"],
    ["a bare iOS web view", { userAgent: IPHONE_WEBVIEW }, "ios-inapp"],
    ["Mac Safari 17", { userAgent: MAC_SAFARI_17, platform: "MacIntel", maxTouchPoints: 0 }, "mac-safari"],
    ["Mac Safari 16 (no Add to Dock)", { userAgent: MAC_SAFARI_16, platform: "MacIntel", maxTouchPoints: 0 }, "none"],
    ["Mac Chrome", { userAgent: MAC_CHROME, platform: "MacIntel", maxTouchPoints: 0 }, "none"],
    ["Mac Firefox", { userAgent: MAC_FIREFOX, platform: "MacIntel", maxTouchPoints: 0 }, "none"],
    ["Android Chrome", { userAgent: ANDROID_CHROME, platform: "Linux armv81" }, "none"],
  ])("%s -> %s", (_name, nav, expected) => {
    expect(detectInstallPlatform(nav)).toBe(expected);
  });
});

describe("share and copy actions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ["share", "canShare", "clipboard"]) Reflect.deleteProperty(navigator, key); // remove the test doubles
  });

  const data = { title: "PayRus", text: "Install", url: "https://example.test/payrus/en" };
  const define = (key: string, value: unknown) => Object.defineProperty(navigator, key, { value, configurable: true });

  it("opens the system Share sheet when the browser has one", async () => {
    const share = vi.fn(async () => undefined);
    define("share", share);
    expect(await shareOrCopyLink(data)).toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
  });

  it("treats closing the Share sheet as a cancel, not an error", async () => {
    define("share", vi.fn(async () => { throw Object.assign(new Error("closed"), { name: "AbortError" }); }));
    expect(await shareOrCopyLink(data)).toBe("cancelled");
  });

  it("copies the link when there is no Share sheet", async () => {
    const writeText = vi.fn(async () => undefined);
    define("clipboard", { writeText });
    expect(await shareOrCopyLink(data)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("falls back to copying when sharing fails for another reason", async () => {
    define("share", vi.fn(async () => { throw new Error("NotAllowedError"); }));
    const writeText = vi.fn(async () => undefined);
    define("clipboard", { writeText });
    expect(await shareOrCopyLink(data)).toBe("copied");
  });

  it("reports a failure when nothing worked", async () => {
    define("clipboard", { writeText: vi.fn(async () => { throw new Error("denied"); }) });
    expect(await copyLink(data.url)).toBe("failed");
  });
});
