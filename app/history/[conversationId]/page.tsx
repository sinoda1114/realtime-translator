"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { ErrorMessage } from "@/components/ui/error-message";
import { UtteranceList } from "@/components/history/utterance-list";
import { useDeviceId } from "@/hooks/use-device-id";
import { useLocalSettings } from "@/hooks/use-local-settings";
import { t } from "@/lib/i18n/translate";
import type { ConversationDetail } from "@/types/conversation";

interface HistoryDetailPageProps {
  params: Promise<{ conversationId: string }>;
}

export default function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const { conversationId } = use(params);
  const router = useRouter();
  const deviceId = useDeviceId();
  const { settings } = useLocalSettings();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}?deviceId=${encodeURIComponent(deviceId)}`,
        );
        const body = await response.json();
        if (!body.success) {
          throw new Error();
        }
        if (!cancelled) {
          setConversation(body.data);
        }
      } catch {
        if (!cancelled) {
          setError(t(settings.uiLanguage, "会話が見つかりませんでした"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, deviceId, settings.uiLanguage]);

  const handleDelete = useCallback(async () => {
    if (!deviceId) {
      return;
    }
    const confirmed = window.confirm(
      t(settings.uiLanguage, "この会話を削除しますか？元に戻せません。"),
    );
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
      router.push("/history");
    } catch {
      setError(t(settings.uiLanguage, "削除に失敗しました"));
    }
  }, [conversationId, deviceId, router, settings.uiLanguage]);

  return (
    <AppShell title="会話詳細" uiLanguage={settings.uiLanguage}>
      {error && <ErrorMessage message={error} />}
      {conversation && (
        <>
          <UtteranceList utterances={conversation.utterances} uiLanguage={settings.uiLanguage} />
          <div className="flex justify-center p-4">
            <button
              type="button"
              onClick={handleDelete}
              className="min-h-11 rounded-[var(--radius-pill)] bg-[var(--color-danger)]/10 px-6 text-[length:var(--text-sm)] font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/15"
            >
              {t(settings.uiLanguage, "この会話を削除")}
            </button>
          </div>
        </>
      )}
    </AppShell>
  );
}
