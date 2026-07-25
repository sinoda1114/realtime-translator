import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLocalSettings } from "@/hooks/use-local-settings";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "@/lib/settings/local-settings";

function mockMatchMedia({ prefersDark, isLandscape }: { prefersDark: boolean; isLandscape: boolean }) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("dark") ? prefersDark : isLandscape,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("useLocalSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("resolves viewMode to shared and theme to dark on a first visit in landscape/dark", async () => {
    mockMatchMedia({ prefersDark: true, isLandscape: true });

    const { result } = renderHook(() => useLocalSettings());

    await waitFor(() => {
      expect(result.current.settings.viewMode).toBe("shared");
    });
    expect(result.current.settings.theme).toBe("dark");
  });

  test("resolves viewMode to facing and theme to light on a first visit in portrait/light", async () => {
    mockMatchMedia({ prefersDark: false, isLandscape: false });

    const { result } = renderHook(() => useLocalSettings());

    await waitFor(() => {
      expect(result.current.settings.viewMode).toBe("facing");
    });
    expect(result.current.settings.theme).toBe("light");
  });

  test("does not override an existing stored preference with device signals", async () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, viewMode: "shared", theme: "dark" }),
    );
    // If the device-signal branch ran anyway, it would flip these back.
    mockMatchMedia({ prefersDark: false, isLandscape: false });

    const { result } = renderHook(() => useLocalSettings());

    await waitFor(() => {
      expect(result.current.settings.viewMode).toBe("shared");
    });
    expect(result.current.settings.theme).toBe("dark");
  });
});
