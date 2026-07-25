import { getTargetLanguage } from "./direction";
import { logger } from "@/lib/logger";
import type {
  CompletedUtterance,
  SourceLanguage,
  TargetLanguage,
  TranscriptionCommitResult,
} from "@/types/translation";

export type V2FinalizePhase = "finalizing" | "saving" | "done";

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

    let commitResult: TranscriptionCommitResult;
    try {
      commitResult = await deps.commitUtterance();
    } catch {
      deps.onError("発話の確定に失敗しました");
      deps.setPhase("done");
      return;
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
