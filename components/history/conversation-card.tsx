"use client";

import Link from "next/link";
import type { ConversationSummary } from "@/types/conversation";

interface ConversationCardProps {
  conversation: ConversationSummary;
  onDelete: (id: string) => void;
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: number, endedAt: number | null): string {
  if (!endedAt) {
    return "進行中";
  }
  const totalSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分${seconds}秒`;
}

export function ConversationCard({ conversation, onDelete }: ConversationCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4">
      <div className="flex items-center justify-between text-[length:var(--text-xs)] font-mono text-[var(--color-muted)]">
        <span>{formatDateTime(conversation.startedAt)}</span>
        <span>{formatDuration(conversation.startedAt, conversation.endedAt)}</span>
      </div>
      <div className="text-[length:var(--text-xs)] text-[var(--color-muted)]">
        発話 {conversation.utteranceCount} 件
      </div>
      <Link href={`/history/${conversation.id}`} className="flex flex-col gap-1 py-1">
        <p className="truncate text-[length:var(--text-md)] font-bold">
          {conversation.firstSourceText ?? "（発話なし）"}
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
          削除
        </button>
      </div>
    </div>
  );
}
