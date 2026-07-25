"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalSettings } from "@/hooks/use-local-settings";
import { useTranslationSession } from "@/hooks/use-translation-session";
import { t } from "@/lib/i18n/translate";
import { LanguageControls } from "./language-controls";
import { SessionButton } from "./session-button";
import { StatusBar } from "./status-bar";
import { TopNav } from "./top-nav";
import { TranslationPane } from "./translation-pane";
import type { TranslationSessionState } from "@/types/translation";

const CONTROLS_PANEL_ID = "translator-controls-panel";

function isInactiveState(state: TranslationSessionState): boolean {
  return state === "idle" || state === "stopped" || state === "error";
}

export function TranslatorScreen() {
  const { settings } = useLocalSettings();
  const session = useTranslationSession({
    silenceDurationMs: settings.silenceDurationMs,
    autoDetectDefault: settings.autoDetectDefault,
    uiLanguage: settings.uiLanguage,
  });
  const [controlsExpanded, setControlsExpanded] = useState(true);

  const isControlsDisabled =
    session.state === "requesting_permission" ||
    session.state === "connecting" ||
    session.state === "stopping";

  // Prioritize subtitle area over chrome: the moment a session goes active,
  // auto-collapse the language/status controls (still manually reopenable).
  // On error, force them back open — the error message lives inside this
  // panel and must never be silently hidden behind a collapsed state.
  const previousStateRef = useRef(session.state);
  useEffect(() => {
    const wasInactive = isInactiveState(previousStateRef.current);
    const isNowActive = !isInactiveState(session.state);
    if (wasInactive && isNowActive) {
      setControlsExpanded(false);
    }
    if (session.state === "error") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setControlsExpanded(true);
    }
    previousStateRef.current = session.state;
  }, [session.state]);

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
          uiLanguage={settings.uiLanguage}
          ariaHidden
        />
      </div>

      <div className="flex flex-col items-center gap-2 bg-[var(--color-paper-2)] px-4 py-2">
        <div
          id={CONTROLS_PANEL_ID}
          className={`grid w-full transition-[grid-template-rows] duration-(--dur-short) ease-(--ease-out) ${
            controlsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="flex w-full items-center justify-between gap-3 overflow-hidden pt-1">
            <LanguageControls
              sourceLanguage={session.sourceLanguage}
              disabled={isControlsDisabled}
              onSelectLanguage={session.setSourceLanguage}
            />
            <TopNav uiLanguage={settings.uiLanguage} />
          </div>
        </div>

        <SessionButton
          state={session.state}
          isSpeaking={session.isSpeaking}
          uiLanguage={settings.uiLanguage}
          onStart={session.start}
          onStop={session.stop}
        />

        <div
          id={`${CONTROLS_PANEL_ID}-status`}
          className={`grid w-full transition-[grid-template-rows] duration-(--dur-short) ease-(--ease-out) ${
            controlsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="flex flex-col items-center gap-2 overflow-hidden pt-1">
            <StatusBar
              uiLanguage={settings.uiLanguage}
              errorMessage={session.errorMessage}
              autoDetectNotice={session.autoDetectNotice}
              currentRms={session.currentRms}
            />
          </div>
        </div>

        <button
          type="button"
          aria-expanded={controlsExpanded}
          aria-controls={`${CONTROLS_PANEL_ID} ${CONTROLS_PANEL_ID}-status`}
          onClick={() => setControlsExpanded((current) => !current)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-pill)] text-[var(--color-muted)] transition-colors duration-(--dur-fast) ease-(--ease-out) hover:text-[var(--color-ink)]"
        >
          <span aria-hidden="true" className={`transition-transform duration-(--dur-short) ease-(--ease-out) ${controlsExpanded ? "" : "rotate-180"}`}>
            ▲
          </span>
          <span className="sr-only">
            {t(settings.uiLanguage, controlsExpanded ? "操作パネルを隠す" : "操作パネルを表示する")}
          </span>
        </button>
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
          uiLanguage={settings.uiLanguage}
        />
      </div>
    </div>
  );
}
