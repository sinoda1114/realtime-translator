export interface TranscriptBufferState {
  sourceText: string;
  translatedText: string;
}

export function createEmptyTranscriptBuffer(): TranscriptBufferState {
  return { sourceText: "", translatedText: "" };
}

export function appendSourceDelta(
  state: TranscriptBufferState,
  delta: string,
): TranscriptBufferState {
  return { ...state, sourceText: state.sourceText + delta };
}

export function appendTranslationDelta(
  state: TranscriptBufferState,
  delta: string,
): TranscriptBufferState {
  return { ...state, translatedText: state.translatedText + delta };
}

export function trimTrailingWhitespace(text: string): string {
  return text.replace(/\s+$/u, "");
}

export function snapshotTranscriptBuffer(
  state: TranscriptBufferState,
): TranscriptBufferState {
  return {
    sourceText: trimTrailingWhitespace(state.sourceText),
    translatedText: trimTrailingWhitespace(state.translatedText),
  };
}

export function isTranscriptBufferEmpty(state: TranscriptBufferState): boolean {
  return (
    trimTrailingWhitespace(state.sourceText).length === 0 ||
    trimTrailingWhitespace(state.translatedText).length === 0
  );
}

export type TranscriptBufferCompleteness = "empty" | "partial" | "complete";

export function getTranscriptBufferCompleteness(
  state: TranscriptBufferState,
): TranscriptBufferCompleteness {
  const hasSource = trimTrailingWhitespace(state.sourceText).length > 0;
  const hasTranslated = trimTrailingWhitespace(state.translatedText).length > 0;

  if (hasSource && hasTranslated) {
    return "complete";
  }
  if (!hasSource && !hasTranslated) {
    return "empty";
  }
  return "partial";
}
