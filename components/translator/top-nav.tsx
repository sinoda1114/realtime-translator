import Link from "next/link";
import { t } from "@/lib/i18n/translate";
import type { ThemeMode, UiLanguage } from "@/types/settings";

const ICON_BUTTON_CLASS =
  "flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)]/90 text-[var(--color-ink-2)] backdrop-blur-sm transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]";

interface TopNavProps {
  uiLanguage: UiLanguage;
  theme: ThemeMode;
  onToggleTheme: () => void;
  showSourceText: boolean;
  onToggleShowSourceText: () => void;
}

const THEME_LABEL_JA: Record<ThemeMode, string> = {
  light: "ダークモードに切り替える",
  dark: "ライトモードに切り替える",
};

/**
 * Theme / history / settings utility nav. Sits in-flow at the top-right of
 * the middle control bar (not fixed to the viewport), so it never overlaps
 * the session button when the rest of the control bar collapses.
 */
export function TopNav({
  uiLanguage,
  theme,
  onToggleTheme,
  showSourceText,
  onToggleShowSourceText,
}: TopNavProps) {
  return (
    <nav aria-label={t(uiLanguage, "ユーティリティ")} className="flex gap-2">
      <button
        type="button"
        onClick={onToggleShowSourceText}
        aria-pressed={showSourceText}
        aria-label={t(uiLanguage, showSourceText ? "原文を隠す" : "原文を表示する")}
        className={ICON_BUTTON_CLASS}
      >
        {showSourceText ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="2.75" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 3.5l17 17" />
            <path d="M10.6 5.7C11 5.6 11.5 5.5 12 5.5c6 0 9.5 6.5 9.5 6.5a15.7 15.7 0 0 1-3.4 4.1M7 6.9A15.9 15.9 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.3 0 2.5-.3 3.6-.8" />
            <path d="M9.9 9.9a2.75 2.75 0 0 0 3.9 3.9" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={t(uiLanguage, THEME_LABEL_JA[theme])}
        className={ICON_BUTTON_CLASS}
      >
        {theme === "dark" ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2.5" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="21.5" y2="12" />
            <line x1="5.28" y1="5.28" x2="7" y2="7" />
            <line x1="17" y1="17" x2="18.72" y2="18.72" />
            <line x1="5.28" y1="18.72" x2="7" y2="17" />
            <line x1="17" y1="7" x2="18.72" y2="5.28" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <circle cx="12" cy="12" r="8" fill="currentColor" />
            <circle cx="16" cy="9" r="7" fill="var(--color-paper)" />
          </svg>
        )}
      </button>
      <Link href="/history" aria-label={t(uiLanguage, "履歴")} className={ICON_BUTTON_CLASS}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      </Link>
      <Link href="/settings" aria-label={t(uiLanguage, "設定")} className={ICON_BUTTON_CLASS}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" />
          <line x1="18.5" y1="12" x2="21.5" y2="12" />
          <line x1="16.6" y1="16.6" x2="18.72" y2="18.72" />
          <line x1="12" y1="18.5" x2="12" y2="21.5" />
          <line x1="7.4" y1="16.6" x2="5.28" y2="18.72" />
          <line x1="5.5" y1="12" x2="2.5" y2="12" />
          <line x1="7.4" y1="7.4" x2="5.28" y2="5.28" />
          <line x1="12" y1="5.5" x2="12" y2="2.5" />
          <line x1="16.6" y1="7.4" x2="18.72" y2="5.28" />
        </svg>
      </Link>
    </nav>
  );
}
