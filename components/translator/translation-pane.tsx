"use client";

import { useEffect, useRef } from "react";
import { FONT_SIZE_TOKEN } from "@/lib/settings/local-settings";
import { formatPaneAriaLabel, sourcePlaceholder, translatedPlaceholder } from "@/lib/i18n/translate";
import type { SourceLanguage } from "@/types/translation";
import type { FontSizePreset, UiLanguage } from "@/types/settings";
import { TranscriptText } from "./transcript-text";

interface TranslationPaneProps {
  orientation: "normal" | "rotated";
  sourceLanguage: SourceLanguage;
  sourceText: string;
  translatedText: string;
  isSpeaking: boolean;
  isFinal: boolean;
  fontSize: FontSizePreset;
  uiLanguage: UiLanguage;
  /**
   * The rotated pane mirrors the same live data for the other person to read
   * upside-down. Screen readers don't need the visual-rotation trick, so the
   * duplicate pane is hidden from the accessibility tree to avoid announcing
   * every subtitle twice.
   */
  ariaHidden?: boolean;
}

const LANGUAGE_LABEL: Record<SourceLanguage, string> = {
  ja: "日本語",
  en: "English",
};

export function TranslationPane({
  orientation,
  sourceLanguage,
  sourceText,
  translatedText,
  isSpeaking,
  fontSize,
  uiLanguage,
  ariaHidden = false,
}: TranslationPaneProps) {
  const subtitleSize = FONT_SIZE_TOKEN[fontSize];
  const scrollRef = useRef<HTMLDivElement>(null);

  // One scrollbar per speaker side: source and translated text scroll
  // together as a single unit, not independently.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sourceText, translatedText]);

  return (
    <section
      className={`flex h-full flex-col justify-center gap-3 px-5 py-4 ${
        orientation === "rotated" ? "rotate-180" : ""
      }`}
      aria-label={formatPaneAriaLabel(uiLanguage, sourceLanguage)}
      aria-hidden={ariaHidden}
    >
      <span className="text-[length:var(--text-xs)] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {LANGUAGE_LABEL[sourceLanguage]}
      </span>
      <div ref={scrollRef} className="max-h-[11em] overflow-y-auto">
        <div className="font-bold leading-[1.25]" style={{ fontSize: subtitleSize }}>
          <TranscriptText
            text={sourceText}
            isSpeaking={isSpeaking}
            emptyPlaceholder={sourcePlaceholder(sourceLanguage)}
          />
        </div>
        <div
          className="mt-3 leading-[1.3] text-[var(--color-ink-2)]"
          style={{ fontSize: subtitleSize }}
        >
          <TranscriptText
            text={translatedText}
            isSpeaking={isSpeaking}
            emptyPlaceholder={translatedPlaceholder(sourceLanguage)}
          />
        </div>
      </div>
    </section>
  );
}
