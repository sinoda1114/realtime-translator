import type { SourceLanguage, TargetLanguage } from "@/types/translation";

export interface RequestTranslationInput {
  text: string;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  deviceId: string;
  signal?: AbortSignal;
}

export class TranslateApiError extends Error {}

// Single choke point for all client-side translation requests. Today only
// the v2 finalize flow calls this with a complete utterance; a future
// throttled "interim translation" (translating partial live speech) would
// call this same function with partial text — no restructuring needed. The
// `signal` param already lets a caller supersede an in-flight request with a
// newer one, which interim translation would need.
export async function requestTranslation(input: RequestTranslationInput): Promise<string> {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: input.deviceId,
      text: input.text,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    throw new TranslateApiError(`translate request failed: ${response.status}`);
  }

  const body = (await response.json()) as { data?: { translatedText?: string } };
  const translatedText = body.data?.translatedText;
  if (typeof translatedText !== "string" || translatedText.length === 0) {
    throw new TranslateApiError("translate response had no text");
  }
  return translatedText;
}
