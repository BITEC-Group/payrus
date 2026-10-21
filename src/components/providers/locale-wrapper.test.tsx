import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import i18n from "@/i18n.ts";

import LocaleWrapper from "./locale-wrapper.tsx";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:lng/*" element={<LocaleWrapper><div>page</div></LocaleWrapper>} />
      </Routes>
    </MemoryRouter>,
  );

describe("LocaleWrapper", () => {
  beforeEach(() => {
    document.documentElement.lang = "en";
  });

  it("sets <html lang> when the URL language is already the active one (direct load of /fr/...)", async () => {
    await i18n.changeLanguage("fr");
    document.documentElement.lang = "en"; // as index.html ships it
    renderAt("/fr/dashboard");
    await waitFor(() => expect(document.documentElement.lang).toBe("fr"));
  });

  it("switches the language and <html lang> when the URL language differs", async () => {
    await i18n.changeLanguage("fr");
    renderAt("/pt/dashboard");
    await waitFor(() => expect(document.documentElement.lang).toBe("pt"));
    expect(i18n.language).toBe("pt");
  });

  it.each(["en", "fr", "pt", "es"])("keeps <html lang> in step for %s", async (lng) => {
    await i18n.changeLanguage(lng);
    document.documentElement.lang = "xx";
    renderAt(`/${lng}/wallet`);
    await waitFor(() => expect(document.documentElement.lang).toBe(lng));
    expect(document.documentElement.dir).toBe("ltr");
  });
});
