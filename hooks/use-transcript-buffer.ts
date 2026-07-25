"use client";

import { useCallback, useState } from "react";
import {
  appendSourceDelta,
  appendTranslationDelta,
  createEmptyTranscriptBuffer,
  type TranscriptBufferState,
} from "@/lib/translation/transcript-buffer";

export interface UseTranscriptBufferResult {
  buffer: TranscriptBufferState;
  appendSource: (delta: string) => void;
  appendTranslation: (delta: string) => void;
  reset: () => void;
}

export function useTranscriptBuffer(): UseTranscriptBufferResult {
  const [buffer, setBuffer] = useState<TranscriptBufferState>(createEmptyTranscriptBuffer);

  const appendSource = useCallback((delta: string) => {
    setBuffer((current) => appendSourceDelta(current, delta));
  }, []);

  const appendTranslation = useCallback((delta: string) => {
    setBuffer((current) => appendTranslationDelta(current, delta));
  }, []);

  const reset = useCallback(() => {
    setBuffer(createEmptyTranscriptBuffer());
  }, []);

  return { buffer, appendSource, appendTranslation, reset };
}
