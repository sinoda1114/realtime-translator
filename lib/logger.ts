type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

export interface RecordedLog {
  level: LogLevel;
  event: string;
  fields: LogFields;
  /**
   * Milliseconds since the first client-side log of this page's lifetime
   * (not since page load). Relative on purpose — no wall-clock timestamp
   * means nothing here can be correlated back to when a user spoke.
   */
  atMs: number;
}

// Keeps the most recent log entries in memory so the app can show them
// on-screen (see the diagnostics panel). Needed because the real failures
// only reproduce on a phone, where opening a browser console isn't
// practical. Client-side only and never persisted; entries hold the same
// event names/fields already passed to console, which by convention exclude
// user speech (see eventShapeFields in transcription-client.ts).
const MAX_RECORDED_LOGS = 40;
const recorded: RecordedLog[] = [];
const listeners = new Set<() => void>();
let startedAtMs: number | null = null;

function record(level: LogLevel, event: string, fields: LogFields): void {
  if (typeof window === "undefined") {
    return; // server-side logs aren't viewable in the client panel
  }
  startedAtMs ??= performance.now();
  recorded.push({ level, event, fields, atMs: Math.round(performance.now() - startedAtMs) });
  if (recorded.length > MAX_RECORDED_LOGS) {
    recorded.splice(0, recorded.length - MAX_RECORDED_LOGS);
  }
  listeners.forEach((listener) => listener());
}

/** Snapshot of the recorded log buffer, oldest first. */
export function getRecordedLogs(): readonly RecordedLog[] {
  return recorded;
}

/** Subscribe to buffer changes; returns an unsubscribe function. */
export function subscribeToRecordedLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearRecordedLogs(): void {
  recorded.length = 0;
  listeners.forEach((listener) => listener());
}

function log(level: LogLevel, event: string, fields?: LogFields): void {
  const payload = { level, event, ...fields };
  const serialized = JSON.stringify(payload);

  record(level, event, fields ?? {});

  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  info: (event: string, fields?: LogFields) => log("info", event, fields),
  warn: (event: string, fields?: LogFields) => log("warn", event, fields),
  error: (event: string, fields?: LogFields) => log("error", event, fields),
};
