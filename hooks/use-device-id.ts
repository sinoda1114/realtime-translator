"use client";

import { useState } from "react";

const DEVICE_ID_STORAGE_KEY = "realtime-translator:device-id";

function readOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
}

export function useDeviceId(): string | null {
  const [deviceId] = useState<string | null>(readOrCreateDeviceId);

  return deviceId;
}
