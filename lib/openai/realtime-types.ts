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
