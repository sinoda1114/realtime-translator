import { t } from "@/lib/i18n/translate";
import type { UiLanguage } from "@/types/settings";

interface StatusBarProps {
  uiLanguage: UiLanguage;
  errorMessage: string | null;
  autoDetectNotice: string | null;
  currentRms: number | null;
}

// Scales the volume meter's full width; RMS values from real phone
// microphones during normal speech rarely exceed this.
const RMS_METER_MAX = 0.03;

/**
 * Session progress (listening/speaking/connecting/etc.) is now conveyed by
 * the session button itself (label + dot) — this bar only surfaces things
 * that genuinely need separate attention: errors, the auto-detect toast,
 * and the volume meter for threshold calibration.
 */
export function StatusBar({ uiLanguage, errorMessage, autoDetectNotice, currentRms }: StatusBarProps) {
  const meterRatio = currentRms === null ? 0 : Math.min(1, currentRms / RMS_METER_MAX);

  if (!errorMessage && !autoDetectNotice && currentRms === null) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-1.5 text-[length:var(--text-xs)]">
      {errorMessage && (
        <span role="alert" className="font-medium text-[var(--color-danger)]">
          {errorMessage}
        </span>
      )}
      {autoDetectNotice && (
        <span className="font-medium text-[var(--color-accent)]">{autoDetectNotice}</span>
      )}
      {currentRms !== null && (
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="text-[var(--color-muted)]">{t(uiLanguage, "音量")}</span>
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
