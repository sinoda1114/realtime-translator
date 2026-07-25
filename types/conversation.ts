export type ConversationMode = "manual" | "auto";
export type UtteranceLanguage = "ja" | "en";

export interface Conversation {
  id: string;
  deviceId: string;
  mode: ConversationMode;
  startedAt: number;
  endedAt: number | null;
  createdAt: number;
}

export interface Utterance {
  id: string;
  conversationId: string;
  sourceLanguage: UtteranceLanguage;
  targetLanguage: UtteranceLanguage;
  sourceText: string;
  translatedText: string;
  startedOffsetMs: number;
  endedOffsetMs: number;
  createdAt: number;
}

export interface ConversationSummary extends Conversation {
  utteranceCount: number;
  firstSourceText: string | null;
  firstTranslatedText: string | null;
}

export interface ConversationDetail extends Conversation {
  utterances: Utterance[];
}
