/**
 * Where "install this site as an app" works through the browser's own menus instead of an install event.
 * - ios:        iPhone/iPad in Safari or another full browser: Share > Add to Home Screen
 * - ios-inapp:  an in-app browser on iPhone/iPad (Facebook, Instagram, Gmail, ...): cannot install, the link must be opened in Safari first
 * - mac-safari: Safari 17+ on a Mac: File > Add to Dock
 * - none:       everything else (Chrome/Edge/Samsung use beforeinstallprompt; Firefox cannot install)
 */
export type InstallPlatform = "ios" | "ios-inapp" | "mac-safari" | "none";

interface NavLike { userAgent: string; platform?: string; maxTouchPoints?: number }

const IN_APP = /(FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|Twitter|Snapchat|TikTok|BytedanceWebview|MicroMessenger|GSA\/|Pinterest|WhatsApp)/i;
const FULL_IOS_BROWSER = /(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/;

export function detectInstallPlatform(nav: NavLike = navigator): InstallPlatform {
  const ua = nav.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch support tells them apart.
  const ios = /iphone|ipad|ipod/i.test(ua) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
  if (ios) {
    // Safari and the other full browsers carry a "Safari/" token; embedded web views usually do not.
    if (IN_APP.test(ua) || (!/Safari\//.test(ua) && !FULL_IOS_BROWSER.test(ua))) return "ios-inapp";
    return "ios";
  }
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/(Chrome|Chromium|Edg|OPR|Firefox)/.test(ua)) {
    const version = Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0);
    if (version >= 17) return "mac-safari"; // "Add to Dock" arrived in Safari 17
  }
  return "none";
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** Copies a link to the clipboard. */
export async function copyLink(url: string): Promise<"copied" | "failed"> {
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/**
 * A real action from the install how-to. Websites cannot start "Add to Home Screen" themselves, but they can open the
 * system Share sheet (which lists it); where that is unavailable the link is copied instead.
 */
export async function shareOrCopyLink(data: { title: string; text: string; url: string }): Promise<ShareResult> {
  try {
    if (typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare(data))) {
      await navigator.share(data);
      return "shared";
    }
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return "cancelled"; // the person closed the sheet
  }
  return copyLink(data.url);
}
