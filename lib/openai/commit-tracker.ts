import type { TranscriptionCommitResult } from "@/types/translation";

interface PendingCommit {
  resolve: (result: TranscriptionCommitResult) => void;
  // The item_id this commit is paired to. Starts as a best guess (the most
  // recent delta's item_id at the time commit() was called) and is NOT
  // trusted for resolveCompleted() matching until `acknowledged` is true —
  // see noteCommitted().
  itemId: string | null;
  acknowledged: boolean;
  fallbackText: string;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

export interface TranscriptionCommitTrackerOptions {
  commitTimeoutMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

const DEFAULT_COMMIT_TIMEOUT_MS = 5_000;

// Pairs input_audio_buffer.commit calls with the eventual authoritative
// transcript from conversation.item.input_audio_transcription.completed,
// via item_id (every delta/completed event carries one). Text is
// accumulated per item_id — not into one shared buffer — so a delayed delta
// for an item that already committed can't bleed into the next utterance's
// fallback text.
//
// commit()'s item_id is only a guess (the most recent delta seen so far) —
// if a commit fires before any delta for the new utterance has arrived, it
// would otherwise inherit the previous utterance's item_id. The guess is
// only trusted once input_audio_buffer.committed confirms/corrects it via
// noteCommitted(); resolveCompleted() only matches against acknowledged
// pending commits, so a completed event can never resolve the wrong one
// just because commit()'s guess happened to collide with it. Because
// completed can also arrive before the committed ack, an unmatched
// completed is stashed and applied once a pending commit is acknowledged
// with that item_id.
//
// Caller contract: noteCommitted() acknowledges the OLDEST not-yet-
// acknowledged pending entry, i.e. it assumes committed acks arrive in the
// same order commit() was called. This app's caller (the v2 finalize flow)
// always awaits one commitUtterance() call to resolve before the next
// utterance can start a new one, so commits are inherently serialized and
// this holds. If a future caller ever fires commit() concurrently for
// multiple in-flight utterances, this ordering assumption would need an
// explicit request/ack id instead of FIFO position.
export class TranscriptionCommitTracker {
  private readonly textByItemId = new Map<string, string>();
  private currentItemId: string | null = null;
  private readonly pending: PendingCommit[] = [];
  private readonly stashedCompletions = new Map<string, string>();
  private readonly commitTimeoutMs: number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;

  constructor(options: TranscriptionCommitTrackerOptions = {}) {
    this.commitTimeoutMs = options.commitTimeoutMs ?? DEFAULT_COMMIT_TIMEOUT_MS;
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  }

  appendDelta(itemId: string, delta: string): void {
    this.currentItemId = itemId;
    this.textByItemId.set(itemId, (this.textByItemId.get(itemId) ?? "") + delta);
  }

  /** Registers a pending commit, guessing the item_id from the most recent
   * delta (if any) for the fallback text. The guess is unacknowledged until
   * `noteCommitted` confirms it. */
  commit(): Promise<TranscriptionCommitResult> {
    const guessedItemId = this.currentItemId;
    this.currentItemId = null;
    const fallbackText = guessedItemId ? (this.textByItemId.get(guessedItemId) ?? "") : "";
    if (guessedItemId) {
      this.textByItemId.delete(guessedItemId);
    }

    return new Promise((resolve) => {
      const entry = {
        resolve,
        itemId: guessedItemId,
        acknowledged: false,
        fallbackText,
      } as PendingCommit;
      entry.timeoutHandle = this.setTimeoutFn(() => {
        this.removePending(entry);
        resolve({ transcript: entry.fallbackText, source: "fallback" });
      }, this.commitTimeoutMs);
      this.pending.push(entry);
    });
  }

  /** Confirms (or corrects) the guessed item_id for the oldest
   * not-yet-acknowledged pending commit against the server's
   * input_audio_buffer.committed ack — this is what makes a pending commit
   * eligible to be resolved by resolveCompleted(). */
  noteCommitted(itemId: string): void {
    const entry = this.pending.find((candidate) => !candidate.acknowledged);
    if (!entry) {
      return;
    }
    entry.itemId = itemId;
    entry.acknowledged = true;
    this.resolveIfStashed(entry);
  }

  /** Resolves the pending commit acknowledged with this exact item_id. A
   * commit that's only guessed (not yet acknowledged) is never matched, so
   * a completed event can't resolve the wrong pending commit just because
   * an unconfirmed guess happened to collide with it. If no acknowledged
   * commit matches, the transcript is stashed for noteCommitted() to pick
   * up once the binding is confirmed. */
  resolveCompleted(itemId: string, transcript: string): void {
    const entry = this.pending.find(
      (candidate) => candidate.acknowledged && candidate.itemId === itemId,
    );
    if (!entry) {
      this.stashCompletion(itemId, transcript);
      return;
    }
    this.clearTimeoutFn(entry.timeoutHandle);
    this.removePending(entry);
    entry.resolve({ transcript, source: "completed" });
  }

  /** Resolves every pending commit with its accumulated text — used on
   * close so no caller is left awaiting a commit forever. */
  flushAll(): void {
    const snapshot = [...this.pending];
    this.pending.length = 0;
    for (const entry of snapshot) {
      this.clearTimeoutFn(entry.timeoutHandle);
      entry.resolve({ transcript: entry.fallbackText, source: "fallback" });
    }
    this.textByItemId.clear();
    this.stashedCompletions.clear();
  }

  // Stashed completions are for the narrow race where completed arrives
  // before the committed ack that would bind it. If nothing ever claims it
  // (e.g. the ack never arrives, or arrives for a different item_id), drop
  // it after commitTimeoutMs instead of holding it indefinitely.
  private stashCompletion(itemId: string, transcript: string): void {
    this.stashedCompletions.set(itemId, transcript);
    const handle = this.setTimeoutFn(() => {
      this.stashedCompletions.delete(itemId);
    }, this.commitTimeoutMs);
    (handle as unknown as { unref?: () => void }).unref?.();
  }

  private resolveIfStashed(entry: PendingCommit): void {
    if (!entry.itemId) {
      return;
    }
    const stashed = this.stashedCompletions.get(entry.itemId);
    if (stashed === undefined) {
      return;
    }
    this.stashedCompletions.delete(entry.itemId);
    this.clearTimeoutFn(entry.timeoutHandle);
    this.removePending(entry);
    entry.resolve({ transcript: stashed, source: "completed" });
  }

  private removePending(entry: PendingCommit): void {
    const index = this.pending.indexOf(entry);
    if (index >= 0) {
      this.pending.splice(index, 1);
    }
  }
}
