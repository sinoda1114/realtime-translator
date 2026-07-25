"use client";

import { useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { ErrorMessage } from "@/components/ui/error-message";
import { SettingsForm } from "@/components/settings/settings-form";
import { useDeviceId } from "@/hooks/use-device-id";
import { useLocalSettings } from "@/hooks/use-local-settings";
import { clientEnv } from "@/lib/env";
import { formatDeletedNotice, t } from "@/lib/i18n/translate";

export default function SettingsPage() {
  const { settings, updateSettings } = useLocalSettings();
  const deviceId = useDeviceId();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleDeleteAll = async () => {
    if (!deviceId) {
      return;
    }
    const confirmed = window.confirm(
      t(settings.uiLanguage, "すべての履歴を削除しますか？元に戻せません。"),
    );
    if (!confirmed) {
      return;
    }
    try {
      const response = await fetch("/api/conversations", {
        method: "DELETE",
        headers: { "x-device-id": deviceId },
      });
      const body = await response.json();
      if (!body.success) {
        throw new Error();
      }
      setNotice(formatDeletedNotice(settings.uiLanguage, body.data.deletedCount));
      setError(null);
    } catch {
      setError(t(settings.uiLanguage, "削除に失敗しました"));
    }
  };

  return (
    <AppShell title="設定" uiLanguage={settings.uiLanguage}>
      {error && <ErrorMessage message={error} />}
      {notice && (
        <p className="p-2 text-center text-[length:var(--text-sm)] font-medium text-[var(--color-accent)]">
          {notice}
        </p>
      )}
      <SettingsForm
        settings={settings}
        isMockMode={clientEnv.NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION}
        onUpdate={updateSettings}
        onDeleteAll={handleDeleteAll}
      />
    </AppShell>
  );
}
