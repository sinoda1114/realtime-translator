import type { UiLanguage } from "@/types/settings";

/**
 * Lightweight i18n: the Japanese string used at each call site IS the
 * dictionary key (gettext-style). `t()` looks it up when uiLanguage is
 * "en" and falls back to the Japanese text itself for any untranslated
 * key, so a missing entry degrades gracefully instead of crashing.
 */
const EN: Record<string, string> = {
  // Session button / status
  翻訳を開始: "Start Translating",
  翻訳を停止: "Stop Translating",
  マイク許可待ち: "Waiting for mic permission",
  接続中: "Connecting",
  停止処理中: "Stopping",
  音量: "Volume",

  // Translator screen chrome
  操作パネルを隠す: "Hide controls",
  操作パネルを表示する: "Show controls",
  "翻訳中 - 操作パネルを表示する": "Translating - show controls",
  履歴: "History",
  設定: "Settings",
  ユーティリティ: "Utilities",
  ダークモードに切り替える: "Switch to dark mode",
  ライトモードに切り替える: "Switch to light mode",
  隣並び表示に切り替える: "Switch to side-by-side view",
  対面表示に切り替える: "Switch to facing view",

  // Errors
  マイクの利用が許可されていません: "Microphone access was denied",
  マイクを利用できません: "Microphone is unavailable",
  原文または翻訳が途中で終了しました: "The original or translated text ended unexpectedly",
  履歴を保存できませんでした: "Failed to save history",
  "端末IDを準備中です。もう一度お試しください": "Preparing device ID. Please try again.",
  翻訳セッションを開始できません: "Unable to start the translation session",
  接続が切れました: "Connection lost",
  翻訳中にエラーが発生しました: "An error occurred during translation",

  // Settings page
  字幕サイズ: "Subtitle Size",
  小: "S",
  標準: "M",
  大: "L",
  特大: "XL",
  無音確定時間: "Silence Duration",
  自動言語判定の初期値: "Auto-Detect Default",
  起動時に自動判定を有効にする: "Enable auto-detect on launch",
  UI言語: "UI Language",
  モックモード: "Mock Mode",
  "有効です。OpenAI APIキーが未設定、またはモック固定設定のため、字幕はサンプルデータで表示されます。":
    "Enabled. Subtitles show sample data because no OpenAI API key is set, or mock mode is forced.",
  "無効です。実際のOpenAI Realtime Translation APIに接続します。":
    "Disabled. Connecting to the real OpenAI Realtime Translation API.",
  履歴の全削除: "Delete All History",
  "保存されているすべての会話履歴を削除します。元に戻せません。":
    "Deletes all saved conversation history. This cannot be undone.",
  すべての履歴を削除: "Delete All",
  "音声は保存されません。自動言語判定は補助機能です。":
    "Audio is never saved. Auto-detect is an experimental aid.",
  "すべての履歴を削除しますか？元に戻せません。": "Delete all history? This cannot be undone.",
  削除に失敗しました: "Failed to delete",

  // History pages
  会話詳細: "Conversation Detail",
  履歴を取得できませんでした: "Failed to load history",
  "この会話を削除しますか？元に戻せません。": "Delete this conversation? This cannot be undone.",
  "読み込み中...": "Loading...",
  会話が見つかりませんでした: "Conversation not found",
  この会話を削除: "Delete This Conversation",
  "← 翻訳に戻る": "← Back to Translator",
  まだ会話履歴がありません: "No conversation history yet",
  進行中: "In progress",
  "（発話なし）": "(No utterance)",
  削除: "Delete",
};

export function t(uiLanguage: UiLanguage, jaText: string): string {
  if (uiLanguage !== "en") {
    return jaText;
  }
  return EN[jaText] ?? jaText;
}

const LANGUAGE_NAME_JA: Record<"ja" | "en", string> = { ja: "日本語", en: "英語" };
const LANGUAGE_NAME_EN: Record<"ja" | "en", string> = { ja: "Japanese", en: "English" };

export function formatPaneAriaLabel(uiLanguage: UiLanguage, sourceLanguage: "ja" | "en"): string {
  return uiLanguage === "en"
    ? `${LANGUAGE_NAME_EN[sourceLanguage]} subtitles`
    : `${LANGUAGE_NAME_JA[sourceLanguage]}の字幕`;
}

export function formatAutoDetectNotice(
  uiLanguage: UiLanguage,
  fromLanguage: "ja" | "en",
  toLanguage: "ja" | "en",
): string {
  const fromLabel = fromLanguage === "ja" ? "日本語" : "English";
  const toLabel = toLanguage === "ja" ? "日本語" : "English";
  return uiLanguage === "en"
    ? `Auto-detect: switched from ${fromLabel} to ${toLabel}`
    : `自動判定: ${fromLabel} から ${toLabel} に切り替えました`;
}

export function formatDeletedNotice(uiLanguage: UiLanguage, count: number): string {
  return uiLanguage === "en"
    ? `Deleted ${count} conversation${count === 1 ? "" : "s"}`
    : `${count}件の履歴を削除しました`;
}

export function formatUtteranceCount(uiLanguage: UiLanguage, count: number): string {
  return uiLanguage === "en" ? `${count} utterance${count === 1 ? "" : "s"}` : `発話 ${count} 件`;
}

export function formatDuration(uiLanguage: UiLanguage, startedAt: number, endedAt: number | null): string {
  if (!endedAt) {
    return t(uiLanguage, "進行中");
  }
  const totalSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return uiLanguage === "en" ? `${minutes}m ${seconds}s` : `${minutes}分${seconds}秒`;
}

export function localeFor(uiLanguage: UiLanguage): string {
  return uiLanguage === "en" ? "en-US" : "ja-JP";
}

const SOURCE_GUIDANCE: Record<"ja" | "en", string> = {
  ja: "話すと原文が表示されます",
  en: "Speak to see the original text here",
};

const TRANSLATED_GUIDANCE: Record<"ja" | "en", string> = {
  ja: "翻訳がここに表示されます",
  en: "The translation appears here",
};

// The empty-state placeholders preview what a real utterance will look
// like — source text in the pane's own language, translation in the
// other language — so they're keyed off sourceLanguage, not uiLanguage.
export function sourcePlaceholder(sourceLanguage: "ja" | "en"): string {
  return SOURCE_GUIDANCE[sourceLanguage];
}

export function translatedPlaceholder(sourceLanguage: "ja" | "en"): string {
  const targetLanguage = sourceLanguage === "ja" ? "en" : "ja";
  return TRANSLATED_GUIDANCE[targetLanguage];
}
