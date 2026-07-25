interface TranscriptTextProps {
  text: string;
  isSpeaking: boolean;
  emptyPlaceholder: string;
}

/**
 * Scroll is owned by the parent TranslationPane (single scrollbar per
 * speaker side, shared between source and translated text) — this
 * component only renders content, no scroll container of its own.
 */
export function TranscriptText({ text, isSpeaking, emptyPlaceholder }: TranscriptTextProps) {
  if (text.length === 0) {
    return <span className="text-[var(--color-muted)]">{emptyPlaceholder}</span>;
  }

  return (
    <span>
      {text}
      {isSpeaking && (
        <span
          aria-hidden="true"
          className="ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] animate-pulse bg-current align-middle motion-reduce:animate-none"
        />
      )}
    </span>
  );
}
