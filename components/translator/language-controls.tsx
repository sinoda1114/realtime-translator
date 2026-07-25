"use client";

import type { SourceLanguage } from "@/types/translation";

interface LanguageControlsProps {
  sourceLanguage: SourceLanguage;
  disabled: boolean;
  onSelectLanguage: (language: SourceLanguage) => void;
}

function LanguagePill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={[
        "min-h-11 min-w-24 rounded-[var(--radius-pill)] px-5 text-[length:var(--text-sm)] font-medium",
        "transition-colors duration-(--dur-fast) ease-(--ease-out)",
        "disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
          : "border border-[var(--color-rule)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// Auto-detect (experimental) has no toggle here anymore — its default is
// set in /settings (autoDetectDefault) and the underlying detection logic
// in useTranslationSession still runs when enabled from there.
export function LanguageControls({
  sourceLanguage,
  disabled,
  onSelectLanguage,
}: LanguageControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <LanguagePill
        active={sourceLanguage === "ja"}
        disabled={disabled}
        onClick={() => onSelectLanguage("ja")}
      >
        日本語
      </LanguagePill>
      <LanguagePill
        active={sourceLanguage === "en"}
        disabled={disabled}
        onClick={() => onSelectLanguage("en")}
      >
        English
      </LanguagePill>
    </div>
  );
}
