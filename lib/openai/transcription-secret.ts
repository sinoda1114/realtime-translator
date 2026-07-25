import { serverEnv } from "@/lib/env";
import type { RealtimeTranscriptionSecretResponse } from "./realtime-types";

const CLIENT_SECRET_ENDPOINT = "https://api.openai.com/v1/realtime/client_secrets";
const TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
const CLIENT_SECRET_TTL_SECONDS = 600;

export interface CreateTranscriptionClientSecretInput {
  safetyIdentifier: string;
}

export async function createTranscriptionClientSecret(
  input: CreateTranscriptionClientSecretInput,
): Promise<RealtimeTranscriptionSecretResponse> {
  const response = await fetch(CLIENT_SECRET_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": input.safetyIdentifier,
    },
    body: JSON.stringify({
      session: {
        type: "transcription",
        audio: {
          input: {
            transcription: { model: TRANSCRIPTION_MODEL },
            noise_reduction: { type: "near_field" },
            // gpt-realtime-whisper requires manual buffer commit — the
            // client decides utterance boundaries via the existing silence
            // detector and sends input_audio_buffer.commit itself, rather
            // than the server auto-committing on detected turn boundaries.
            turn_detection: null,
          },
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
    throw new Error(`OpenAI transcription client secret request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<RealtimeTranscriptionSecretResponse>;
}
