import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";

import en from "@/locales/en/common.json";
import InstallButton from "./install-button.tsx";

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
