import { serverEnv } from "@/lib/env";
import type { RealtimeClientSecretCreateResponse } from "./realtime-types";

const CLIENT_SECRET_ENDPOINT = "https://api.openai.com/v1/realtime/translations/client_secrets";
const TRANSLATE_MODEL = "gpt-realtime-translate";
const TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
const CLIENT_SECRET_TTL_SECONDS = 600;

export interface CreateTranslationClientSecretInput {
  targetLanguage: "ja" | "en";
  safetyIdentifier: string;
}

export async function createTranslationClientSecret(
  input: CreateTranslationClientSecretInput,
): Promise<RealtimeClientSecretCreateResponse> {
  const response = await fetch(CLIENT_SECRET_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": input.safetyIdentifier,
    },
    body: JSON.stringify({
      session: {
        model: TRANSLATE_MODEL,
        audio: {
          input: {
            transcription: { model: TRANSCRIPTION_MODEL },
            noise_reduction: { type: "near_field" },
          },
          output: { language: input.targetLanguage },
        },
      },
      expires_after: {
        anchor: "created_at",
        seconds: CLIENT_SECRET_TTL_SECONDS,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI client secret request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<RealtimeClientSecretCreateResponse>;
}
