import type { CompletedUtterance } from "@/types/translation";

// Both people should be able to scroll back through the recent exchange
// without leaving the live session, but the pane isn't a full chat log —
// cap it and let /history hold the rest.
export const MAX_VISIBLE_UTTERANCES = 10;

export function appendCompletedUtterance(
  list: CompletedUtterance[],
  utterance: CompletedUtterance,
): CompletedUtterance[] {
  return [...list, utterance].slice(-MAX_VISIBLE_UTTERANCES);
}
