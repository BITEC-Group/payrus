import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";

import en from "@/locales/en/common.json";
import InstallButton from "./install-button.tsx";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const instance = i18n.createInstance();
void instance.use(initReactI18next).init({
  resources: { en: { common: en } }, lng: "en", fallbackLng: "en", defaultNS: "common", ns: ["common"],
  keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false },
});

const renderButton = () => render(<I18nextProvider i18n={instance}><InstallButton /></I18nextProvider>);

function installEvent(outcome: "accepted" | "dismissed") {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  e.prompt = vi.fn(async () => undefined);
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

describe("InstallButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows nothing when the browser offers no install and it is not an iPhone", () => {
    renderButton();
    expect(screen.queryByText("Install app")).toBeNull();
  });

  it("on an iPhone, opens the Add to Home Screen how-to", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1");
    renderButton();
    fireEvent.click(screen.getByText("Install app"));
    expect(screen.getByText("Add PayRus to your home screen")).toBeInTheDocument();
    expect(screen.getByText(/Choose “Add to Home Screen”/)).toBeInTheDocument();
  });

  it("appears when the browser offers installation and triggers its prompt", async () => {
    renderButton();
    const e = installEvent("accepted");
    act(() => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
    await act(async () => { fireEvent.click(screen.getByText("Install app")); });
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Install app")).toBeNull();
  });

  it("hides again once the app has been installed", () => {
    renderButton();
    act(() => { window.dispatchEvent(installEvent("dismissed")); });
    expect(screen.getByText("Install app")).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event("appinstalled")); });
    expect(screen.queryByText("Install app")).toBeNull();
  });
});

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.12.108";
const define = (key: string, value: unknown) => Object.defineProperty(navigator, key, { value, configurable: true });

describe("InstallButton how-to actions", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    for (const key of ["share", "canShare", "clipboard", "platform", "maxTouchPoints"]) Reflect.deleteProperty(navigator, key);
  });

  it("iPhone: the main button opens the system Share sheet with the page link", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(IPHONE);
    const share = vi.fn(async () => undefined);
    define("share", share);
    renderButton();
    fireEvent.click(screen.getByText("Install app"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Open the Share menu" })); });
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]?.[0]).toMatchObject({ title: "PayRus", url: window.location.href.split("#")[0] });
  });

  it("iPhone: closing the Share sheet keeps the how-to open and shows no error", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(IPHONE);
    define("share", vi.fn(async () => { throw Object.assign(new Error("closed"), { name: "AbortError" }); }));
    renderButton();
    fireEvent.click(screen.getByText("Install app"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Open the Share menu" })); });
    expect(screen.getByText("Add PayRus to your home screen")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("iPhone without a Share sheet: the button copies the link and says so", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(IPHONE);
    const writeText = vi.fn(async () => undefined);
    define("clipboard", { writeText });
    renderButton();
    fireEvent.click(screen.getByText("Install app"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy link" })); });
    expect(writeText).toHaveBeenCalledWith(window.location.href.split("#")[0]);
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });

  it("in-app browser: explains that Safari is needed first", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(INSTAGRAM);
    renderButton();
    fireEvent.click(screen.getByText("Install app"));
    expect(screen.getByText(/in-app browser cannot install apps/i)).toBeInTheDocument();
  });

  it("Safari on a Mac: shows the Add to Dock steps and copies the link", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(MAC_SAFARI);
    define("platform", "MacIntel");
    define("maxTouchPoints", 0);
    const writeText = vi.fn(async () => undefined);
    define("clipboard", { writeText });
    define("share", vi.fn(async () => undefined)); // present, but a Mac cannot reach Add to Dock through it
    renderButton();
    fireEvent.click(screen.getByText("Install app"));
    expect(screen.getByText("Add PayRus to your Dock")).toBeInTheDocument();
    expect(screen.getByText(/Add to Dock/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy link" })); });
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
