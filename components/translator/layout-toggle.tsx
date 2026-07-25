"use client";

import { t } from "@/lib/i18n/translate";
import type { UiLanguage, ViewMode } from "@/types/settings";

interface LayoutToggleProps {
  uiLanguage: UiLanguage;
  viewMode: ViewMode;
  onToggle: () => void;
}

const LABEL_JA: Record<ViewMode, string> = {
  facing: "隣並び表示に切り替える",
  shared: "対面表示に切り替える",
};

/**
 * Fixed top-center control — deliberately not folded into the middle
 * control bar's icon row (unlike history/settings/theme), since switching
 * layouts mid-conversation needs to be reachable at a glance, not tucked
 * away next to secondary utilities.
 */
export function LayoutToggle({ uiLanguage, viewMode, onToggle }: LayoutToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={t(uiLanguage, LABEL_JA[viewMode])}
      className="fixed top-3 left-1/2 z-10 flex min-h-11 min-w-11 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)]/90 text-[var(--color-ink-2)] backdrop-blur-sm transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
    >
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
        {viewMode === "facing" ? (
          <rect x="4" y="5" width="16" height="14" rx="2" />
        ) : (
          <>
            <rect x="4" y="3" width="16" height="8" rx="1.5" />
            <rect x="4" y="13" width="16" height="8" rx="1.5" />
          </>
        )}
      </svg>
    </button>
  );
}
