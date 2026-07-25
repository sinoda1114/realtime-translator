import type { TranslationSessionState } from "@/types/translation";

interface StatusBarProps {
  state: TranslationSessionState;
  isMockMode: boolean;
  errorMessage: string | null;
  autoDetectNotice: string | null;
  currentRms: number | null;
}

// Scales the volume meter's full width; RMS values from real phone
// microphones during normal speech rarely exceed this.
const RMS_METER_MAX = 0.03;

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

export function StatusBar({
  state,
  isMockMode,
  errorMessage,
  autoDetectNotice,
  currentRms,
}: StatusBarProps) {
  const isLive = LIVE_STATES.includes(state);
  const meterRatio = currentRms === null ? 0 : Math.min(1, currentRms / RMS_METER_MAX);

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
      {currentRms !== null && (
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="text-[var(--color-muted)]">音量</span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-paper-3)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-(--dur-fast) ease-(--ease-out)"
              style={{ width: `${meterRatio * 100}%` }}
            />
          </div>
          <span className="font-mono text-[var(--color-muted)]">{currentRms.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}
