export interface RealtimeClientSecretCreateResponse {
  value: string;
  expires_at: number;
  session: {
    id: string;
    type: "translation";
    expires_at: number;
    model: string;
  };
}

export type RealtimeServerEvent =
  | { type: "session.input_transcript.delta"; delta: string; elapsed_ms?: number }
  | { type: "session.output_transcript.delta"; delta: string; elapsed_ms?: number }
  | { type: "error"; error: { message: string } }
  | { type: string; [key: string]: unknown };

export interface RealtimeTranscriptionSecretResponse {
  value: string;
  expires_at: number;
  session: {
    id: string;
    type: "transcription";
    expires_at: number;
  };
}

// Events for a transcription-only realtime session (v2 translation engine).
// Unlike the translation-endpoint events above, these carry item_id, which
// lets deltas and the authoritative completed transcript be paired to a
// specific utterance — the correlation the translation endpoint lacks.
export type TranscriptionServerEvent =
  | { type: "conversation.item.input_audio_transcription.delta"; item_id: string; delta: string }
  | {
      type: "conversation.item.input_audio_transcription.completed";
      item_id: string;
      transcript: string;
    }
  | { type: "input_audio_buffer.committed"; item_id: string }
  | { type: "error"; error: { message: string } }
  | { type: string; [key: string]: unknown };
