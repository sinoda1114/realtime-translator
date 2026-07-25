// The realtime translation API has no turn/utterance concept and no
// per-utterance id — elapsed_ms is the only (coarse, ~200ms-granularity)
// timing hint it provides. A translation delta claiming to be far ahead of
// the most recent source delta is more likely leaking in content we haven't
// transcribed yet than genuine simultaneous-interpretation lead.
export function isTranslationDeltaTooFarAhead(
  lastSourceElapsedMs: number | null,
  translationElapsedMs: number | undefined,
  limitMs: number,
): boolean {
  if (typeof translationElapsedMs !== "number" || lastSourceElapsedMs === null) {
    return false;
  }
  return translationElapsedMs - lastSourceElapsedMs > limitMs;
}
