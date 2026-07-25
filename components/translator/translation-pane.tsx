import { FONT_SIZE_TOKEN } from "@/lib/settings/local-settings";
import type { SourceLanguage } from "@/types/translation";
import type { FontSizePreset } from "@/types/settings";
import { TranscriptText } from "./transcript-text";

interface TranslationPaneProps {
  orientation: "normal" | "rotated";
  sourceLanguage: SourceLanguage;
  sourceText: string;
  translatedText: string;
  isSpeaking: boolean;
  isFinal: boolean;
  fontSize: FontSizePreset;
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
  ariaHidden = false,
}: TranslationPaneProps) {
  const subtitleSize = FONT_SIZE_TOKEN[fontSize];

  return (
    <section
      className={`flex h-full flex-col justify-center gap-3 px-5 py-4 ${
        orientation === "rotated" ? "rotate-180" : ""
      }`}
      aria-label={`${LANGUAGE_LABEL[sourceLanguage]}の字幕`}
      aria-hidden={ariaHidden}
    >
      <span className="text-[length:var(--text-xs)] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {LANGUAGE_LABEL[sourceLanguage]}
      </span>
      <div
        className="font-bold leading-[1.25]"
        style={{ fontSize: subtitleSize }}
      >
        <TranscriptText
          text={sourceText}
          isSpeaking={isSpeaking}
          emptyPlaceholder="話すと原文が表示されます"
        />
      </div>
      <div
        className="leading-[1.3] text-[var(--color-ink-2)]"
        style={{ fontSize: subtitleSize }}
      >
        <TranscriptText
          text={translatedText}
          isSpeaking={isSpeaking}
          emptyPlaceholder="翻訳がここに表示されます"
        />
      </div>
    </section>
  );
}
