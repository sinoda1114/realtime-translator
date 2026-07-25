"use client";

import { useEffect, useRef } from "react";

interface TranscriptTextProps {
  text: string;
  isSpeaking: boolean;
  emptyPlaceholder: string;
}

export function TranscriptText({ text, isSpeaking, emptyPlaceholder }: TranscriptTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [text]);

  return (
    <div ref={containerRef} className="max-h-[6.5em] overflow-y-auto">
      {text.length === 0 ? (
        <span className="text-[var(--color-muted)]">{emptyPlaceholder}</span>
      ) : (
        <span>
          {text}
          {isSpeaking && (
            <span
              aria-hidden="true"
              className="ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] animate-pulse bg-current align-middle motion-reduce:animate-none"
            />
          )}
        </span>
      )}
    </div>
  );
}
