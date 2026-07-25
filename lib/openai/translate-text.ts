import { serverEnv } from "@/lib/env";

const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const LANGUAGE_NAME: Record<"ja" | "en", string> = { ja: "Japanese", en: "English" };

export interface TranslateTextInput {
  text: string;
  sourceLanguage: "ja" | "en";
  targetLanguage: "ja" | "en";
  safetyIdentifier: string;
}

interface OpenAiResponsesResult {
  output_text?: string;
  output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
}

function extractOutputText(result: OpenAiResponsesResult): string {
  if (typeof result.output_text === "string") {
    return result.output_text;
  }
  // Fallback for API shapes that omit the output_text convenience field.
  for (const item of result.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return "";
}

export async function translateText(input: TranslateTextInput): Promise<string> {
  const response = await fetch(RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": input.safetyIdentifier,
    },
    body: JSON.stringify({
      model: serverEnv.OPENAI_TRANSLATE_TEXT_MODEL,
      // No `temperature` — gpt-5-nano and other reasoning-family models
      // reject/ignore sampling params like temperature; only pass params
      // that are safe across the whole gpt-5 family.
      max_output_tokens: 1000,
      instructions:
        `You are a translation engine. Translate the user's ${LANGUAGE_NAME[input.sourceLanguage]} ` +
        `text into natural ${LANGUAGE_NAME[input.targetLanguage]}. Output ONLY the translation — ` +
        "no quotes, no explanation, no commentary.",
      input: input.text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`OpenAI translate request failed: ${response.status} ${errorBody}`);
  }

  const result = (await response.json()) as OpenAiResponsesResult;
  const translated = extractOutputText(result).trim();
  if (!translated) {
    throw new Error("OpenAI translate response contained no text");
  }
  return translated;
}
