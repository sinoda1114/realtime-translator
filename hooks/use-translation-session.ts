"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTargetLanguage } from "@/lib/translation/direction";
import { formatAutoDetectNotice, t } from "@/lib/i18n/translate";
import { appendCompletedUtterance } from "@/lib/translation/completed-utterances";
import {
  createAutoDetectState,
  detectLanguage,
  updateAutoDetectState,
  type AutoDetectState,
} from "@/lib/translation/language-detector";
import { MockTranslationClient } from "@/lib/translation/mock-translation-client";
import { RealtimeTranslationClient } from "@/lib/openai/realtime-client";
import {
  getTranscriptBufferCompleteness,
  snapshotTranscriptBuffer,
} from "@/lib/translation/transcript-buffer";
import { clientEnv } from "@/lib/env";
import { useDeviceId } from "@/hooks/use-device-id";
import { useMicrophone } from "@/hooks/use-microphone";
import { useSilenceDetector } from "@/hooks/use-silence-detector";
import { useTranscriptBuffer } from "@/hooks/use-transcript-buffer";
import type {
  CompletedUtterance,
  RealtimeConnectionState,
  SourceLanguage,
  TargetLanguage,
  TranslationClient,
  TranslationSessionState,
} from "@/types/translation";
import type { UiLanguage } from "@/types/settings";

const DEFAULT_SILENCE_DURATION_MS = 900;

export interface UseTranslationSessionOptions {
  silenceDurationMs?: number;
  autoDetectDefault?: boolean;
  uiLanguage?: UiLanguage;
}

export interface UseTranslationSessionResult {
  state: TranslationSessionState;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  autoDetect: boolean;
  isSpeaking: boolean;
  sourceText: string;
  translatedText: string;
  completedUtterances: CompletedUtterance[];
  errorMessage: string | null;
  autoDetectNotice: string | null;
  isMockMode: boolean;
  currentRms: number | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setSourceLanguage: (language: SourceLanguage) => void;
  setAutoDetect: (value: boolean) => void;
}

function mapPermissionError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "マイクの利用が許可されていません";
  }
  return "マイクを利用できません";
}

async function postJson(url: string, body: unknown, extraHeaders?: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`);
  }
  return response.json();
}

export function useTranslationSession(
  options: UseTranslationSessionOptions = {},
): UseTranslationSessionResult {
  const silenceDurationMs = options.silenceDurationMs ?? DEFAULT_SILENCE_DURATION_MS;
  const uiLanguage: UiLanguage = options.uiLanguage ?? "ja";
  const [state, setState] = useState<TranslationSessionState>("idle");
  const [sourceLanguage, setSourceLanguageState] = useState<SourceLanguage>("ja");
  const [autoDetect, setAutoDetect] = useState(options.autoDetectDefault ?? false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null);
  const [isMockSession, setIsMockSession] = useState(clientEnv.NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION);
  const [completedUtterances, setCompletedUtterances] = useState<CompletedUtterance[]>([]);

  const deviceId = useDeviceId();
  const { requestMicrophone, releaseMicrophone } = useMicrophone();
  const { buffer, appendSource, appendTranslation, reset } = useTranscriptBuffer();

  const clientRef = useRef<TranslationClient | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number>(0);
  const utteranceStartedAtRef = useRef<number | null>(null);
  const bufferRef = useRef(buffer);
  const sourceLanguageRef = useRef(sourceLanguage);
  const deviceIdRef = useRef(deviceId);
  const stateRef = useRef(state);
  const uiLanguageRef = useRef(uiLanguage);
  const autoDetectStateRef = useRef<AutoDetectState>(createAutoDetectState());
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The realtime API keeps streaming transcript/translation deltas for the
  // audio it already received even after we've locally finalized on silence
  // and reset the buffer — there's no ack tying a delta to "the utterance
  // that just ended" vs "the next one". Without this guard, those late
  // deltas land in the freshly-reset buffer and get shown as if they belong
  // to whatever is spoken next, producing translations that don't match the
  // visible original text. Deltas are dropped from the moment we finalize
  // until the silence detector confirms a new utterance has actually begun.
  //
  // Known limitations (no per-utterance id/generation from the API to do
  // this precisely):
  // - A delta legitimately belonging to the utterance that just finalized
  //   can arrive after the drop window opens and gets discarded, not
  //   appended to the completed entry. Trades completeness for correctness
  //   of what's on screen — silently swallowing a mismatched translation
  //   was judged worse than occasionally trimming a trailing word.
  // - If the API's delay outlasts the silence gap, a stale delta arriving
  //   just after onSpeechStart re-opens the gate can still leak through.
  //   This isn't fully closable without a response/item id to match deltas
  //   against; treat as a residual risk, not a guarantee.
  const acceptDeltasRef = useRef(true);
  useEffect(() => {
    bufferRef.current = buffer;
    sourceLanguageRef.current = sourceLanguage;
    deviceIdRef.current = deviceId;
    stateRef.current = state;
    uiLanguageRef.current = uiLanguage;
  });

  useEffect(() => {
    // useLocalSettings starts with a default (false) and only picks up the
    // real stored value after mount, so the useState initializer above
    // captures a stale default. Re-sync while idle so a saved "on" default
    // actually takes effect; never touch it mid-session.
    if (state === "idle" || state === "stopped" || state === "error") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoDetect(options.autoDetectDefault ?? false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.autoDetectDefault]);

  useEffect(() => {
    // Error/notice text is localized at the moment it's produced; if the UI
    // language changes while one is showing, clear it rather than leave a
    // stale-language message on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrorMessage(null);
    setAutoDetectNotice(null);
  }, [uiLanguage]);

  const targetLanguage = getTargetLanguage(sourceLanguage);

  const handleFinalize = useCallback(() => {
    const snapshot = snapshotTranscriptBuffer(bufferRef.current);
    const utteranceStartedAt = utteranceStartedAtRef.current;
    reset();
    utteranceStartedAtRef.current = null;
    acceptDeltasRef.current = false;

    const completeness = getTranscriptBufferCompleteness(snapshot);
    if (completeness === "empty") {
      setState((current) => (current === "speaking" ? "listening" : current));
      return;
    }
    if (completeness === "partial") {
      setErrorMessage(t(uiLanguageRef.current, "原文または翻訳が途中で終了しました"));
      setState((current) => (current === "speaking" ? "listening" : current));
      return;
    }

    // Surface the finished exchange in the on-screen log immediately — this
    // must not depend on the DB save below succeeding, since the whole point
    // is that both speakers can keep reading past turns without leaving the
    // live session.
    setCompletedUtterances((current) =>
      appendCompletedUtterance(current, {
        id: crypto.randomUUID(),
        sourceLanguage: sourceLanguageRef.current,
        sourceText: snapshot.sourceText,
        translatedText: snapshot.translatedText,
      }),
    );

    const conversationId = conversationIdRef.current;
    const currentDeviceId = deviceIdRef.current;
    if (!conversationId || !currentDeviceId) {
      setState((current) => (current === "speaking" ? "listening" : current));
      return;
    }

    setState("finalizing");
    const now = Date.now();
    const startedAtMs = utteranceStartedAt ?? now - 1;
    const startedOffsetMs = Math.max(0, startedAtMs - sessionStartedAtRef.current);
    const endedOffsetMs = Math.max(startedOffsetMs, now - sessionStartedAtRef.current);

    setState("saving");
    void postJson(`/api/conversations/${conversationId}/utterances`, {
      deviceId: currentDeviceId,
      sourceLanguage: sourceLanguageRef.current,
      targetLanguage: getTargetLanguage(sourceLanguageRef.current),
      sourceText: snapshot.sourceText,
      translatedText: snapshot.translatedText,
      startedOffsetMs,
      endedOffsetMs,
    })
      .catch(() => {
        setErrorMessage(t(uiLanguageRef.current, "履歴を保存できませんでした"));
      })
      .finally(() => {
        setState((current) => (current === "saving" || current === "finalizing" ? "listening" : current));
      });
  }, [reset]);

  const silenceDetector = useSilenceDetector({
    silenceDurationMs,
    onSpeechStart: () => {
      acceptDeltasRef.current = true;
      utteranceStartedAtRef.current = Date.now();
      setState("speaking");
    },
    onFinalize: handleFinalize,
    onError: (message) => {
      setErrorMessage(t(uiLanguageRef.current, message));
    },
  });

  const teardown = useCallback(async () => {
    silenceDetector.stop();
    await clientRef.current?.close();
    clientRef.current = null;
    releaseMicrophone();
  }, [releaseMicrophone, silenceDetector]);

  const start = useCallback(async () => {
    if (state !== "idle" && state !== "stopped" && state !== "error") {
      return;
    }
    if (!deviceId) {
      setErrorMessage(t(uiLanguageRef.current, "端末IDを準備中です。もう一度お試しください"));
      return;
    }

    // Defensively release any client/mic left over from a previous failed
    // attempt (e.g. retrying after an "error" state) before acquiring fresh ones.
    await teardown();

    setErrorMessage(null);
    setState("requesting_permission");
    reset();
    setCompletedUtterances([]);
    acceptDeltasRef.current = true;

    let stream: MediaStream;
    try {
      stream = await requestMicrophone();
    } catch (error: unknown) {
      setErrorMessage(t(uiLanguageRef.current, mapPermissionError(error)));
      setState("error");
      return;
    }

    setState("connecting");
    sessionStartedAtRef.current = Date.now();

    try {
      const created = await postJson("/api/conversations", {
        deviceId,
        mode: autoDetect ? "auto" : "manual",
      });
      conversationIdRef.current = (created as { data: { id: string } }).data.id;
    } catch {
      conversationIdRef.current = null;
      setErrorMessage(t(uiLanguageRef.current, "履歴を保存できませんでした"));
    }

    const forceMock = clientEnv.NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION;
    let clientSecret = "mock";
    let useMockClient = forceMock;

    if (!forceMock) {
      try {
        const tokenResult = (await postJson("/api/realtime/token", {
          targetLanguage,
          deviceId,
        })) as { data: { clientSecret: string | null; mock: boolean } };
        useMockClient = tokenResult.data.mock;
        clientSecret = tokenResult.data.clientSecret ?? "mock";
      } catch {
        setErrorMessage(t(uiLanguageRef.current, "翻訳セッションを開始できません"));
        setState("error");
        releaseMicrophone();
        return;
      }
    }

    setIsMockSession(useMockClient);

    const callbacks = {
      onSourceDelta: (delta: string) => {
        if (!acceptDeltasRef.current) {
          return;
        }
        appendSource(delta);
      },
      onTranslationDelta: (delta: string) => {
        if (!acceptDeltasRef.current) {
          return;
        }
        appendTranslation(delta);
      },
      onStateChange: (connectionState: RealtimeConnectionState) => {
        if (connectionState === "connected") {
          setState("listening");
          silenceDetector.start(stream);
        } else if (connectionState === "disconnected" && stateRef.current !== "stopping") {
          setErrorMessage(t(uiLanguageRef.current, "接続が切れました"));
          setState("error");
          void teardown();
        }
      },
      onError: (error: { message: string }) => {
        setErrorMessage(t(uiLanguageRef.current, error.message));
        setState("error");
        void teardown();
      },
    };

    const client = useMockClient
      ? new MockTranslationClient(callbacks)
      : new RealtimeTranslationClient(callbacks);

    clientRef.current = client;

    await client.connect({
      clientSecret,
      stream,
      targetLanguage,
    });
  }, [
    appendSource,
    appendTranslation,
    autoDetect,
    deviceId,
    releaseMicrophone,
    reset,
    requestMicrophone,
    silenceDetector,
    teardown,
    state,
    targetLanguage,
  ]);

  const stop = useCallback(async () => {
    if (state === "idle" || state === "stopped") {
      return;
    }
    setState("stopping");
    silenceDetector.flush();
    await teardown();

    const conversationId = conversationIdRef.current;
    if (conversationId && deviceId) {
      try {
        await fetch(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
          body: JSON.stringify({ endedAt: Date.now() }),
        });
      } catch {
        // best-effort; conversation end timestamp is not critical for MVP
      }
    }
    conversationIdRef.current = null;

    setState("stopped");
  }, [deviceId, silenceDetector, state, teardown]);

  const switchLanguage = useCallback(
    (language: SourceLanguage) => {
      setSourceLanguageState(language);
      // Finalize (and save) any in-progress utterance using the current
      // buffer *before* clearing it, per spec: "切り替え前に現在の発話を確定する".
      silenceDetector.flush();
      reset();
      clientRef.current?.updateTargetLanguage(getTargetLanguage(language));
    },
    [reset, silenceDetector],
  );

  const setSourceLanguage = useCallback(
    (language: SourceLanguage) => {
      setAutoDetect(false);
      switchLanguage(language);
    },
    [switchLanguage],
  );

  useEffect(() => {
    if (!autoDetect) {
      autoDetectStateRef.current = createAutoDetectState();
      return;
    }

    const detection = detectLanguage(buffer.sourceText);
    const result = updateAutoDetectState(autoDetectStateRef.current, detection);
    autoDetectStateRef.current = result.state;

    if (result.confirmed && result.confirmed !== sourceLanguageRef.current) {
      const fromLanguage = sourceLanguageRef.current;
      const toLanguage = result.confirmed;
      switchLanguage(toLanguage);
      setAutoDetectNotice(formatAutoDetectNotice(uiLanguageRef.current, fromLanguage, toLanguage));
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
      noticeTimeoutRef.current = setTimeout(() => setAutoDetectNotice(null), 4000);
    }
  }, [autoDetect, buffer.sourceText, switchLanguage]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  const teardownRef = useRef(teardown);
  useEffect(() => {
    teardownRef.current = teardown;
  });

  useEffect(() => {
    return () => {
      void teardownRef.current();
    };
  }, []);

  return {
    state,
    sourceLanguage,
    targetLanguage,
    autoDetect,
    isSpeaking: silenceDetector.isSpeaking,
    sourceText: buffer.sourceText,
    translatedText: buffer.translatedText,
    completedUtterances,
    errorMessage,
    autoDetectNotice,
    isMockMode: isMockSession,
    currentRms: silenceDetector.currentRms,
    start,
    stop,
    setSourceLanguage,
    setAutoDetect,
  };
}
