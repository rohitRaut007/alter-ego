import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES, LanguageProvider, TRANSLATIONS, useLanguage } from "./i18n";

function Probe({ k, fallback }: { k: string; fallback?: string }) {
  const { t, language, setLanguage } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="text">{t(k, fallback)}</span>
      <button onClick={() => setLanguage("hi")}>hi</button>
      <button onClick={() => setLanguage("xx")}>bad</button>
    </div>
  );
}

describe("i18n", () => {
  it("ships the legacy language set with a complete English base", () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(
      expect.arrayContaining(["en-US", "hi", "es", "de", "fr", "zh", "ja", "pt", "ko"]),
    );
    expect(Object.keys(TRANSLATIONS["en-US"]!).length).toBeGreaterThan(500);
  });

  it("falls back to the supplied text for unknown keys", () => {
    render(
      <LanguageProvider>
        <Probe k="no_such_key" fallback="Fallback copy" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("text").textContent).toBe("Fallback copy");
  });

  it("switches language, persists it, and ignores unsupported codes", () => {
    render(
      <LanguageProvider>
        <Probe k="nav_dashboard" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("text").textContent).toBe("Dashboard");
    act(() => screen.getByText("hi").click());
    expect(screen.getByTestId("lang").textContent).toBe("hi");
    expect(screen.getByTestId("text").textContent).not.toBe("Dashboard");
    expect(localStorage.getItem("alter_ego_lang")).toBe("hi");
    act(() => screen.getByText("bad").click());
    expect(screen.getByTestId("lang").textContent).toBe("hi");
  });

  it("no longer claims the product is built on a vendor it does not use", () => {
    for (const dict of Object.values(TRANSLATIONS)) {
      for (const [k, v] of Object.entries(dict)) {
        if (k.startsWith("auth_")) expect(v).not.toMatch(/supabase/i);
      }
    }
  });
});
