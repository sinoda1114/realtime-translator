"use client";

import { t } from "@/lib/i18n/translate";
import type { TranslationSessionState } from "@/types/translation";
import type { UiLanguage } from "@/types/settings";

interface SessionButtonProps {
  state: TranslationSessionState;
  isSpeaking: boolean;
  uiLanguage: UiLanguage;
  onStart: () => void;
  onStop: () => void;
}

const BUSY_STATES: TranslationSessionState[] = ["requesting_permission", "connecting", "stopping"];

const ACTIVE_STATES: TranslationSessionState[] = [
  "listening",
  "speaking",
  "finalizing",
  "saving",
  "reconnecting",
  "mock",
];

// Each busy state gets its own label so the button reads as progress,
// not a stuck spinner.
const BUSY_LABEL_JA: Partial<Record<TranslationSessionState, string>> = {
  requesting_permission: "マイク許可待ち",
  connecting: "接続中",
  stopping: "停止処理中",
};

export function SessionButton({ state, isSpeaking, uiLanguage, onStart, onStop }: SessionButtonProps) {
  const isBusy = BUSY_STATES.includes(state);
  const isActive = ACTIVE_STATES.includes(state);
  const busyLabelJa = BUSY_LABEL_JA[state];
  const label = busyLabelJa
    ? t(uiLanguage, busyLabelJa)
    : t(uiLanguage, isActive ? "翻訳を停止" : "翻訳を開始");

  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={isActive ? onStop : onStart}
      aria-label={label}
      className={[
        "relative flex min-h-14 min-w-52 items-center justify-center gap-2 rounded-[var(--radius-pill)]",
        "px-8 text-[length:var(--text-lg)] font-bold tracking-tight",
        "transition-transform duration-(--dur-fast) ease-(--ease-out)",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70",
        isActive
          ? "bg-[var(--color-danger)] text-[var(--color-danger-ink)]"
          : "bg-[var(--color-accent)] text-[var(--color-accent-ink)]",
      ].join(" ")}
    >
      {isBusy && (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
        />
      )}
      {!isBusy && isActive && (
        <span
          aria-hidden="true"
          className={[
            "h-2.5 w-2.5 rounded-full bg-current",
            isSpeaking ? "animate-pulse motion-reduce:animate-none" : "opacity-50",
          ].join(" ")}
        />
      )}
      {label}
    </button>
  );
}
