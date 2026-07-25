import type { Utterance, UtteranceLanguage } from "@/types/conversation";

interface UtteranceListProps {
  utterances: Utterance[];
}

const LANGUAGE_LABEL: Record<UtteranceLanguage, string> = { ja: "日本語", en: "English" };

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function UtteranceList({ utterances }: UtteranceListProps) {
  return (
    <ul className="flex flex-col gap-3 p-4">
      {utterances.map((utterance) => (
        <li
          key={utterance.id}
          className="rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4"
        >
          <div className="flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-muted)]">
            <span className="rounded-full bg-[var(--color-paper-3)] px-2 py-0.5 font-medium">
              {LANGUAGE_LABEL[utterance.sourceLanguage]}
            </span>
            <span className="font-mono">{formatTime(utterance.createdAt)}</span>
          </div>
          <p className="mt-2 text-[length:var(--text-md)] font-bold">{utterance.sourceText}</p>
          <p className="text-[length:var(--text-sm)] text-[var(--color-ink-2)]">
            {utterance.translatedText}
          </p>
        </li>
      ))}
    </ul>
  );
}
