"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  parseStoredSettings,
} from "@/lib/settings/local-settings";
import type { LocalSettings } from "@/types/settings";

export interface UseLocalSettingsResult {
  settings: LocalSettings;
  updateSettings: (partial: Partial<LocalSettings>) => void;
}

export function useLocalSettings(): UseLocalSettingsResult {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Read localStorage after mount to avoid an SSR/client hydration mismatch;
    // the initial render intentionally matches the server-rendered defaults.
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings(parseStoredSettings(raw));
      return;
    }
    // First-ever visit: resolve the theme from the OS/browser preference
    // instead of hardcoding light, then persist it as the explicit choice.
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setSettings({ ...DEFAULT_SETTINGS, theme: prefersDark ? "dark" : "light" });
  }, []);

  useEffect(() => {
    // The <html lang> attribute is server-rendered as "ja"; keep it in sync
    // with the client-only stored preference for assistive tech / browser UI.
    document.documentElement.lang = settings.uiLanguage;
  }, [settings.uiLanguage]);

  useEffect(() => {
    // tokens.css reads this attribute to force light/dark regardless of the
    // OS-level prefers-color-scheme media query.
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const updateSettings = useCallback((partial: Partial<LocalSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...partial };
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
