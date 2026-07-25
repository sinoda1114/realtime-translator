import { getTargetLanguage } from "./direction";
import { logger } from "@/lib/logger";
import type {
  CompletedUtterance,
  SourceLanguage,
  TargetLanguage,
  TranscriptionCommitResult,
} from "@/types/translation";

export type V2FinalizePhase = "finalizing" | "saving" | "done";

// How long to wait before retrying a failed commitUtterance() once. Chosen
// to be a bit longer than the client's first reconnect backoff step (1s —
// see MAX_RECONNECT_ATTEMPTS/RECONNECT_BACKOFF_MS in transcription-client.ts)
// so that attempt has a realistic chance to have landed by the time we
// retry, without making the failure path noticeably sluggish when it can't
// actually recover (e.g. no refreshClientSecret, or genuinely offline).
const COMMIT_RETRY_DELAY_MS = 1500;

export interface SaveUtteranceInput {
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  sourceText: string;
  translatedText: string;
}

export interface V2FinalizeDeps {
  commitUtterance: () => Promise<TranscriptionCommitResult>;
  translate: (
    text: string,
    sourceLanguage: SourceLanguage,
    targetLanguage: TargetLanguage,
  ) => Promise<string>;
  getSourceLanguage: () => SourceLanguage;
  appendCompleted: (utterance: CompletedUtterance) => void;
  saveUtterance: (input: SaveUtteranceInput) => Promise<void>;
  onError: (messageKey: string) => void;
  setPhase: (phase: V2FinalizePhase) => void;
  createId?: () => string;
  delay?: (ms: number) => Promise<void>;
  /**
   * Whether the session is still running. Consulted before spending the
   * retry delay on a failed commit: when the user has pressed stop, the
   * client is being torn down and no retry can ever succeed, so waiting
   * 1.5s just to fail again is pure latency. Defaults to always-running
   * when omitted.
   */
  isSessionActive?: () => boolean;
}

// Orchestrates the v2 finalize flow: commit the audio buffer, wait for the
// authoritative transcript, translate it server-side, then display + save
// only once both source and translation are known to match. Unlike the v1
// path, a translation failure must not leave a mismatched or empty pair on
// screen — nothing is appended or saved if translate() rejects.
export function createV2FinalizeHandler(deps: V2FinalizeDeps): () => Promise<void> {
  return async function finalizeV2(): Promise<void> {
    const sourceLanguage = deps.getSourceLanguage();
    deps.setPhase("finalizing");

    const delay =
      deps.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

    let commitResult: TranscriptionCommitResult;
    try {
      commitResult = await deps.commitUtterance();
    } catch {
      // The most common cause is the WebRTC DataChannel having dropped
      // mid-session — the client already retries reconnecting in the
      // background (see scheduleReconnect() in transcription-client.ts),
      // but that recovery doesn't retroactively rescue THIS commit: the
      // channel-not-open check rejects synchronously the instant it's
      // called, with no awareness of an in-flight reconnect. Wait long
      // enough for the client's first reconnect attempt to have a
      // realistic chance to land, then retry exactly once before giving
      // up. Safe to retry: a rejected attempt never actually sent
      // input_audio_buffer.commit to the server, so nothing is duplicated.
      //
      // delay() itself is inside this try too: the injected implementation
      // is expected to never reject (the default setTimeout-based one
      // never does), but if it somehow did, that must fall through to the
      // same error/done handling below instead of rejecting finalizeV2()
      // itself and leaving the caller stuck in "finalizing".
      //
      // Skip the retry entirely when the session is already stopping: the
      // client is being torn down, so no retry can succeed and the wait is
      // wasted. (The caller also suppresses the error in that case — this
      // just avoids the pointless 1.5s.)
      if (deps.isSessionActive && !deps.isSessionActive()) {
        deps.onError("発話の確定に失敗しました");
        deps.setPhase("done");
        return;
      }
      try {
        await delay(COMMIT_RETRY_DELAY_MS);
        // Re-check after the wait: the user can press stop *during* the 1.5s,
        // and by then the client is being torn down — retrying would poke a
        // closing connection for a session that's over. Checked separately
        // from the pre-delay check above because that one only rules out a
        // session that was already stopping when the commit first failed.
        if (deps.isSessionActive && !deps.isSessionActive()) {
          deps.onError("発話の確定に失敗しました");
          deps.setPhase("done");
          return;
        }
        commitResult = await deps.commitUtterance();
      } catch {
        deps.onError("発話の確定に失敗しました");
        deps.setPhase("done");
        return;
      }
    }
    const sourceText = commitResult.transcript.trim();
    if (!sourceText) {
      // Diagnostic: an empty committed transcript means either the speaker
      // said nothing (routine — a silence-detector false trigger, expected
      // to happen somewhat often) or, more concerningly, delta/completed
      // events weren't recognized upstream (see transcription-client.ts's
      // *_missing_fields warnings) and the tracker fell back to nothing.
      // Silent in the UI either way (no error makes sense to show for
      // "nothing was said"), but the two cases are distinguishable by
      // commitResult.source: "completed" means the server itself confirmed
      // an empty transcript (routine, logged at info to avoid warn-fatigue
      // burying the real signal); "fallback" means the 5s timeout fired
      // with no completed event at all, which is the more suspicious case
      // worth a warn-level trail.
      if (commitResult.source === "fallback") {
        logger.warn("v2_finalize.empty_transcript_fallback", {});
      } else {
        logger.info("v2_finalize.empty_transcript", {});
      }
      deps.setPhase("done");
      return;
    }

    const targetLanguage = getTargetLanguage(sourceLanguage);

    let translatedText: string;
    try {
      translatedText = await deps.translate(sourceText, sourceLanguage, targetLanguage);
    } catch {
      deps.onError("翻訳に失敗しました");
      deps.setPhase("done");
      return;
    }

    deps.appendCompleted({
      id: (deps.createId ?? (() => crypto.randomUUID()))(),
      sourceLanguage,
      sourceText,
      translatedText,
    });

    deps.setPhase("saving");
    try {
      await deps.saveUtterance({ sourceLanguage, targetLanguage, sourceText, translatedText });
    } catch {
      deps.onError("履歴を保存できませんでした");
    } finally {
      deps.setPhase("done");
    }
  };
}
