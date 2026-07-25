"use client";

import Link from "next/link";
import { formatDuration, formatUtteranceCount, localeFor, t } from "@/lib/i18n/translate";
import type { ConversationSummary } from "@/types/conversation";
import type { UiLanguage } from "@/types/settings";

interface ConversationCardProps {
  conversation: ConversationSummary;
  uiLanguage: UiLanguage;
  onDelete: (id: string) => void;
}

function formatDateTime(uiLanguage: UiLanguage, ms: number): string {
  return new Date(ms).toLocaleString(localeFor(uiLanguage), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConversationCard({ conversation, uiLanguage, onDelete }: ConversationCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4">
      <div className="flex items-center justify-between text-[length:var(--text-xs)] font-mono text-[var(--color-muted)]">
        <span>{formatDateTime(uiLanguage, conversation.startedAt)}</span>
        <span>{formatDuration(uiLanguage, conversation.startedAt, conversation.endedAt)}</span>
      </div>
      <div className="text-[length:var(--text-xs)] text-[var(--color-muted)]">
        {formatUtteranceCount(uiLanguage, conversation.utteranceCount)}
      </div>
      <Link href={`/history/${conversation.id}`} className="flex flex-col gap-1 py-1">
        <p className="truncate text-[length:var(--text-md)] font-bold">
          {conversation.firstSourceText ?? t(uiLanguage, "（発話なし）")}
        </p>
        <p className="truncate text-[length:var(--text-sm)] text-[var(--color-ink-2)]">
          {conversation.firstTranslatedText ?? ""}
        </p>
      </Link>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onDelete(conversation.id)}
          className="min-h-11 rounded-[var(--radius-pill)] bg-[var(--color-danger)]/10 px-4 text-[length:var(--text-xs)] font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/15"
        >
          {t(uiLanguage, "削除")}
        </button>
      </div>
    </div>
  );
}
