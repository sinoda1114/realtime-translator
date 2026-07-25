"use client";

import Link from "next/link";
import { useLocalSettings } from "@/hooks/use-local-settings";
import { useTranslationSession } from "@/hooks/use-translation-session";
import { LanguageControls } from "./language-controls";
import { SessionButton } from "./session-button";
import { StatusBar } from "./status-bar";
import { TranslationPane } from "./translation-pane";

export function TranslatorScreen() {
  const { settings } = useLocalSettings();
  const session = useTranslationSession({
    silenceDurationMs: settings.silenceDurationMs,
    autoDetectDefault: settings.autoDetectDefault,
  });

  const isControlsDisabled =
    session.state === "requesting_permission" ||
    session.state === "connecting" ||
    session.state === "stopping";

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-paper)] text-[var(--color-ink)]">
      <div className="flex-1 overflow-hidden border-b border-[var(--color-rule)]">
        <TranslationPane
          orientation="rotated"
          sourceLanguage={session.sourceLanguage}
          sourceText={session.sourceText}
          translatedText={session.translatedText}
          isSpeaking={session.isSpeaking}
          isFinal={false}
          fontSize={settings.fontSize}
          ariaHidden
        />
      </div>

      <div className="flex flex-col items-center gap-4 bg-[var(--color-paper-2)] px-4 py-5">
        <LanguageControls
          sourceLanguage={session.sourceLanguage}
          autoDetect={session.autoDetect}
          disabled={isControlsDisabled}
          onSelectLanguage={session.setSourceLanguage}
          onToggleAutoDetect={session.setAutoDetect}
        />
        <SessionButton state={session.state} onStart={session.start} onStop={session.stop} />
        <StatusBar
          state={session.state}
          isMockMode={session.isMockMode}
          errorMessage={session.errorMessage}
          autoDetectNotice={session.autoDetectNotice}
          currentRms={session.currentRms}
        />
        <div className="flex gap-5 text-[length:var(--text-xs)]">
          <Link
            href="/history"
            className="text-[var(--color-muted)] underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--color-ink)] hover:decoration-current"
          >
            履歴
          </Link>
          <Link
            href="/settings"
            className="text-[var(--color-muted)] underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--color-ink)] hover:decoration-current"
          >
            設定
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-hidden border-t border-[var(--color-rule)]">
        <TranslationPane
          orientation="normal"
          sourceLanguage={session.sourceLanguage}
          sourceText={session.sourceText}
          translatedText={session.translatedText}
          isSpeaking={session.isSpeaking}
          isFinal={false}
          fontSize={settings.fontSize}
        />
      </div>
    </div>
  );
}
