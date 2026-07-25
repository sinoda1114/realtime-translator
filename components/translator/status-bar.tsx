import type { TranslationSessionState } from "@/types/translation";

interface StatusBarProps {
  state: TranslationSessionState;
  isMockMode: boolean;
  errorMessage: string | null;
  autoDetectNotice: string | null;
}

const STATE_LABEL: Record<TranslationSessionState, string> = {
  idle: "未開始",
  requesting_permission: "マイク許可待ち",
  connecting: "接続中",
  listening: "入力待ち",
  speaking: "発話中",
  finalizing: "確定中",
  saving: "保存中",
  reconnecting: "再接続中",
  stopping: "停止処理中",
  stopped: "停止済み",
  error: "エラー",
  mock: "モック翻訳中",
};

const LIVE_STATES: TranslationSessionState[] = ["listening", "speaking", "finalizing", "saving"];

export function StatusBar({ state, isMockMode, errorMessage, autoDetectNotice }: StatusBarProps) {
  const isLive = LIVE_STATES.includes(state);

  return (
    <div className="flex flex-col items-center gap-1.5 text-[length:var(--text-xs)]">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[var(--color-ink-2)]">
          <span
            aria-hidden="true"
            className={[
              "h-2 w-2 rounded-full",
              isLive ? "bg-[var(--color-accent)]" : "bg-[var(--color-rule)]",
              state === "speaking" ? "animate-pulse motion-reduce:animate-none" : "",
            ].join(" ")}
          />
          状態: {STATE_LABEL[state]}
        </span>
        {isMockMode && (
          <span className="rounded-full bg-[var(--color-paper-2)] px-2.5 py-0.5 font-medium text-[var(--color-ink-2)]">
            モックモード
          </span>
        )}
        {errorMessage && (
          <span role="alert" className="font-medium text-[var(--color-danger)]">
            {errorMessage}
          </span>
        )}
      </div>
      {autoDetectNotice && (
        <span className="font-medium text-[var(--color-accent)]">{autoDetectNotice}</span>
      )}
    </div>
  );
}
