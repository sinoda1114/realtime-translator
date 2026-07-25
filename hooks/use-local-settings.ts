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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(parseStoredSettings(window.localStorage.getItem(SETTINGS_STORAGE_KEY)));
  }, []);

  const updateSettings = useCallback((partial: Partial<LocalSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...partial };
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
