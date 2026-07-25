import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TranscriptionCommitTracker } from "@/lib/openai/commit-tracker";

describe("TranscriptionCommitTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("resolves with the completed transcript once committed and completed arrive", async () => {
    const tracker = new TranscriptionCommitTracker();
    tracker.appendDelta("item-1", "Hel");
    tracker.appendDelta("item-1", "lo");

    const commitPromise = tracker.commit();
    tracker.noteCommitted("item-1");
    tracker.resolveCompleted("item-1", "Hello there");

    await expect(commitPromise).resolves.toEqual({
      transcript: "Hello there",
      source: "completed",
    });
  });

  test("falls back to the accumulated text for the committed item on timeout", async () => {
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 5000 });
    tracker.appendDelta("item-1", "partial text");

    const commitPromise = tracker.commit();
    vi.advanceTimersByTime(5000);

    await expect(commitPromise).resolves.toEqual({
      transcript: "partial text",
      source: "fallback",
    });
  });

  test("a completed event arriving after timeout does not resolve a second time", async () => {
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 1000 });
    tracker.appendDelta("item-1", "slow");

    const commitPromise = tracker.commit();
    tracker.noteCommitted("item-1");
    vi.advanceTimersByTime(1000);
    await commitPromise;

    // Late completed for the already-timed-out item — must not throw.
    expect(() => tracker.resolveCompleted("item-1", "slow response")).not.toThrow();
  });

  test("handles two overlapping pending commits, pairing each completed to its acknowledged item_id", async () => {
    const tracker = new TranscriptionCommitTracker();
    tracker.appendDelta("item-1", "first utterance");
    const firstCommit = tracker.commit();
    tracker.noteCommitted("item-1");

    tracker.appendDelta("item-2", "second utterance");
    const secondCommit = tracker.commit();
    tracker.noteCommitted("item-2");

    // Resolve out of order.
    tracker.resolveCompleted("item-2", "second final");
    tracker.resolveCompleted("item-1", "first final");

    await expect(firstCommit).resolves.toEqual({ transcript: "first final", source: "completed" });
    await expect(secondCommit).resolves.toEqual({ transcript: "second final", source: "completed" });
  });

  test("does not misattribute a later utterance's completed to an earlier pending commit", async () => {
    // Regression case: a completed for item-2 must never resolve the
    // pending commit for item-1, even though item-1 committed first and is
    // still the oldest pending entry.
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 10_000 });
    tracker.appendDelta("item-1", "first utterance");
    const firstCommit = tracker.commit();
    tracker.noteCommitted("item-1");

    tracker.appendDelta("item-2", "second utterance");
    const secondCommit = tracker.commit();
    tracker.noteCommitted("item-2");

    tracker.resolveCompleted("item-2", "second final");

    await expect(secondCommit).resolves.toEqual({ transcript: "second final", source: "completed" });

    // item-1 must still be pending — resolve it explicitly and confirm it
    // gets its own transcript, not anything from item-2.
    tracker.resolveCompleted("item-1", "first final");
    await expect(firstCommit).resolves.toEqual({ transcript: "first final", source: "completed" });
  });

  test("noteCommitted corrects a wrong item_id guess caused by a late delta for an already-committed item", async () => {
    // Regression case: commit()'s item_id is only a guess taken from the
    // most recently seen delta. If a late delta for utterance 1 arrives
    // after it already committed, and utterance 2 then commits before any
    // delta of its own has arrived, the guess would incorrectly inherit
    // item-1. noteCommitted's server ack must be able to correct that guess
    // rather than leaving the pending commit permanently mis-bound.
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 10_000 });

    tracker.appendDelta("item-1", "first utterance");
    const firstCommit = tracker.commit();

    // Late delta for item-1, arriving after it already committed.
    tracker.appendDelta("item-1", " (late fragment)");

    // Utterance 2 commits with no delta of its own yet — guess incorrectly
    // inherits item-1 from the late delta above.
    const secondCommit = tracker.commit();

    tracker.noteCommitted("item-1");
    tracker.noteCommitted("item-2");

    tracker.resolveCompleted("item-1", "first final");
    tracker.resolveCompleted("item-2", "second final");

    await expect(firstCommit).resolves.toEqual({ transcript: "first final", source: "completed" });
    await expect(secondCommit).resolves.toEqual({ transcript: "second final", source: "completed" });
  });

  test("resolveCompleted does not resolve an unacknowledged pending commit — it stashes until noteCommitted", async () => {
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 10_000 });
    tracker.appendDelta("item-1", "first utterance");
    const firstCommit = tracker.commit();
    // No noteCommitted call yet — the guess ("item-1") is unacknowledged.

    tracker.resolveCompleted("item-1", "final transcript");

    let resolved = false;
    void firstCommit.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    // The ack arrives and applies the stashed transcript.
    tracker.noteCommitted("item-1");

    await expect(firstCommit).resolves.toEqual({
      transcript: "final transcript",
      source: "completed",
    });
  });

  test("keeps delta text isolated per item_id so a late delta for a committed item cannot bleed into the next utterance's fallback", async () => {
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 1000 });
    tracker.appendDelta("item-1", "first");
    const firstCommit = tracker.commit();
    tracker.noteCommitted("item-1");

    // A late delta for item-1 arrives after it already committed.
    tracker.appendDelta("item-1", " (late fragment)");

    tracker.appendDelta("item-2", "second");
    const secondCommit = tracker.commit();
    tracker.noteCommitted("item-2");
    vi.advanceTimersByTime(1000);

    await firstCommit;
    await expect(secondCommit).resolves.toEqual({ transcript: "second", source: "fallback" });
  });

  test("flushAll resolves every pending commit with its item's accumulated text", async () => {
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 10_000 });
    tracker.appendDelta("item-1", "one");
    const first = tracker.commit();
    tracker.appendDelta("item-2", "two");
    const second = tracker.commit();

    tracker.flushAll();

    await expect(first).resolves.toEqual({ transcript: "one", source: "fallback" });
    await expect(second).resolves.toEqual({ transcript: "two", source: "fallback" });
  });

  test("a completed event arriving before noteCommitted is stashed and applied once acknowledged", async () => {
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 10_000 });
    const commitPromise = tracker.commit();

    // completed arrives referencing an item_id nothing is acknowledged for yet.
    tracker.resolveCompleted("item-1", "resolved text");

    // Now the committed ack acknowledges the pending entry — the stashed
    // transcript should apply immediately.
    tracker.noteCommitted("item-1");

    await expect(commitPromise).resolves.toEqual({
      transcript: "resolved text",
      source: "completed",
    });
  });

  test("a stashed completed with no matching ack is dropped after the commit timeout, not held forever", async () => {
    const tracker = new TranscriptionCommitTracker({ commitTimeoutMs: 1000 });

    // completed arrives for an item_id with no pending commit at all.
    tracker.resolveCompleted("orphan-item", "never claimed");

    // Advancing well past the timeout must not throw and must not leak —
    // there's no direct way to assert Map size from the public API, so this
    // just confirms the stash's own cleanup timer doesn't error.
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });
});
