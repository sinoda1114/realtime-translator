"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { ErrorMessage } from "@/components/ui/error-message";
import { ConversationList } from "@/components/history/conversation-list";
import { useDeviceId } from "@/hooks/use-device-id";
import type { ConversationSummary } from "@/types/conversation";

export default function HistoryPage() {
  const deviceId = useDeviceId();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!deviceId) {
      return;
    }
    try {
      const response = await fetch(`/api/conversations?deviceId=${encodeURIComponent(deviceId)}`);
      const body = await response.json();
      if (!body.success) {
        throw new Error();
      }
      setConversations(body.data);
      setError(null);
    } catch {
      setError("履歴を取得できませんでした");
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    // Async data fetch on mount; setState happens after an awaited network call,
    // not synchronously within the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (conversationId: string) => {
      if (!deviceId) {
        return;
      }
      const confirmed = window.confirm("この会話を削除しますか？元に戻せません。");
      if (!confirmed) {
        return;
      }
      try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
          method: "DELETE",
          headers: { "x-device-id": deviceId },
        });
        const body = await response.json();
        if (!body.success) {
          throw new Error();
        }
        setConversations((current) => current?.filter((c) => c.id !== conversationId) ?? null);
      } catch {
        setError("削除に失敗しました");
      }
    },
    [deviceId],
  );

  return (
    <AppShell title="履歴">
      {error && <ErrorMessage message={error} />}
      {isLoading ? (
        <div className="p-4 text-center text-[length:var(--text-sm)] text-[var(--color-muted)]">
          読み込み中...
        </div>
      ) : (
        <ConversationList conversations={conversations ?? []} onDelete={handleDelete} />
      )}
    </AppShell>
  );
}
