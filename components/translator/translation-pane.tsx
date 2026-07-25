"use client";

import { useEffect, useRef } from "react";
import { FONT_SIZE_TOKEN } from "@/lib/settings/local-settings";
import { formatPaneAriaLabel, sourcePlaceholder, translatedPlaceholder } from "@/lib/i18n/translate";
import type { CompletedUtterance, SourceLanguage } from "@/types/translation";
import type { FontSizePreset, UiLanguage } from "@/types/settings";
import { TranscriptText } from "./transcript-text";

const AUTO_SCROLL_THRESHOLD_PX = 80;

interface TranslationPaneProps {
  orientation: "normal" | "rotated";
  sourceLanguage: SourceLanguage;
  sourceText: string;
  translatedText: string;
  completedUtterances: CompletedUtterance[];
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

export function TranslationPane({
  orientation,
  sourceLanguage,
  sourceText,
  translatedText,
  completedUtterances,
  isSpeaking,
  fontSize,
  uiLanguage,
  ariaHidden = false,
}: TranslationPaneProps) {
  const subtitleSize = FONT_SIZE_TOKEN[fontSize];
  const scrollRef = useRef<HTMLDivElement>(null);
  // Only auto-follow new text while the reader is already near the bottom —
  // otherwise every transcript delta would yank someone back down while
  // they're mid-scroll reading an earlier exchange in the log.
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX;
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // One scrollbar per speaker side: past exchanges and the live line scroll
  // together as a single unit, not independently.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && shouldAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sourceText, translatedText, completedUtterances]);

  return (
    <section
      className={`flex h-full flex-col px-5 py-4 ${orientation === "rotated" ? "rotate-180" : ""}`}
      aria-label={formatPaneAriaLabel(uiLanguage, sourceLanguage)}
      aria-hidden={ariaHidden}
    >
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-y-auto"
      >
        {completedUtterances.map((utterance) => (
          <div key={utterance.id}>
            <div className="font-bold leading-[1.25]" style={{ fontSize: subtitleSize }}>
              {utterance.sourceText}
            </div>
            <div
              className="mt-3 leading-[1.3] text-[var(--color-ink-2)]"
              style={{ fontSize: subtitleSize }}
            >
              {utterance.translatedText}
            </div>
          </div>
        ))}
        <div>
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
      </div>
    </section>
  );
}
