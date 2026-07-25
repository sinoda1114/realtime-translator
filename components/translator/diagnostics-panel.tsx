"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n/translate";
import {
  clearRecordedLogs,
  getRecordedLogs,
  subscribeToRecordedLogs,
  type RecordedLog,
} from "@/lib/logger";
import type { UiLanguage } from "@/types/settings";

const LEVEL_COLOR: Record<RecordedLog["level"], string> = {
  info: "var(--color-muted)",
  warn: "var(--color-accent)",
  error: "var(--color-danger)",
};

function formatFields(fields: RecordedLog["fields"]): string {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return "";
  }
  return entries.map(([key, value]) => `${key}=${value}`).join(" ");
}

/**
 * Shows the in-memory log buffer on screen. Exists because the failures that
 * matter only reproduce on a phone, where opening a browser console isn't
 * practical — this makes the same diagnostic trail readable (and screenshot-
 * able) without any desktop tooling. Off by default; enabled from settings.
 */
interface DiagnosticsPanelProps {
  uiLanguage: UiLanguage;
}

export function DiagnosticsPanel({ uiLanguage }: DiagnosticsPanelProps) {
  const [logs, setLogs] = useState<readonly RecordedLog[]>(() => [...getRecordedLogs()]);

  useEffect(() => {
    // Copy on every change: getRecordedLogs() returns the live array, and
    // React would skip the re-render if the same reference came back.
    return subscribeToRecordedLogs(() => setLogs([...getRecordedLogs()]));
  }, []);

  return (
    <section
      aria-label={t(uiLanguage, "診断ログ")}
      className="flex max-h-48 w-full flex-col gap-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-2 font-mono text-[length:var(--text-xs)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-[var(--color-ink)]">
          {t(uiLanguage, "診断ログ")} ({logs.length})
        </span>
        <button
          type="button"
          onClick={() => clearRecordedLogs()}
          className="min-h-11 rounded-[var(--radius-pill)] px-3 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          {t(uiLanguage, "クリア")}
        </button>
      </div>
      {logs.length === 0 ? (
        <p className="text-[var(--color-muted)]">{t(uiLanguage, "まだログはありません")}</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {/* Newest first: the phone screen only fits a few lines, and the
              most recent events are the ones being investigated. */}
          {[...logs].reverse().map((log, index) => (
            <li key={`${log.atMs}-${index}`} style={{ color: LEVEL_COLOR[log.level] }}>
              <span className="text-[var(--color-muted)]">{(log.atMs / 1000).toFixed(1)}s </span>
              {log.event}
              {formatFields(log.fields) && <span className="opacity-70"> {formatFields(log.fields)}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
