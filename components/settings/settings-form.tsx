"use client";

import { Switch } from "@heroui/react";
import { t } from "@/lib/i18n/translate";
import type { LocalSettings } from "@/types/settings";
import type { FontSizePreset, SilenceDurationMs, UiLanguage } from "@/types/settings";

interface SettingsFormProps {
  settings: LocalSettings;
  isMockMode: boolean;
  onUpdate: (partial: Partial<LocalSettings>) => void;
  onDeleteAll: () => void;
}

const FONT_SIZE_OPTIONS: { value: FontSizePreset; label: string }[] = [
  { value: "small", label: "小" },
  { value: "medium", label: "標準" },
  { value: "large", label: "大" },
  { value: "extra-large", label: "特大" },
];

const SILENCE_OPTIONS: { value: SilenceDurationMs; label: string }[] = [
  { value: 600, label: "600ms" },
  { value: 900, label: "900ms" },
  { value: 1200, label: "1200ms" },
  { value: 1500, label: "1500ms" },
];

const UI_LANGUAGE_OPTIONS: { value: UiLanguage; label: string }[] = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

function OptionPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "min-h-11 rounded-[var(--radius-pill)] px-5 text-[length:var(--text-sm)] font-medium",
        "transition-colors duration-(--dur-fast) ease-(--ease-out)",
        active
          ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
          : "border border-[var(--color-rule)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[length:var(--text-sm)] font-bold text-[var(--color-ink)]">{children}</h2>
  );
}

export function SettingsForm({ settings, isMockMode, onUpdate, onDeleteAll }: SettingsFormProps) {
  const lang = settings.uiLanguage;

  return (
    <div className="flex flex-col gap-8 p-4 pb-12">
      <section className="flex flex-col gap-3">
        <SectionHeading>{t(lang, "UI言語")}</SectionHeading>
        <div className="flex flex-wrap gap-2">
          {UI_LANGUAGE_OPTIONS.map((option) => (
            <OptionPill
              key={option.value}
              active={settings.uiLanguage === option.value}
              onClick={() => onUpdate({ uiLanguage: option.value })}
            >
              {option.label}
            </OptionPill>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{t(lang, "字幕サイズ")}</SectionHeading>
        <div className="flex flex-wrap gap-2">
          {FONT_SIZE_OPTIONS.map((option) => (
            <OptionPill
              key={option.value}
              active={settings.fontSize === option.value}
              onClick={() => onUpdate({ fontSize: option.value })}
            >
              {t(lang, option.label)}
            </OptionPill>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{t(lang, "無音確定時間")}</SectionHeading>
        <div className="flex flex-wrap gap-2">
          {SILENCE_OPTIONS.map((option) => (
            <OptionPill
              key={option.value}
              active={settings.silenceDurationMs === option.value}
              onClick={() => onUpdate({ silenceDurationMs: option.value })}
            >
              {option.label}
            </OptionPill>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{t(lang, "自動言語判定の初期値")}</SectionHeading>
        <Switch
          isSelected={settings.autoDetectDefault}
          onChange={(value) => onUpdate({ autoDetectDefault: value })}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-[length:var(--text-sm)]">
              {t(lang, "起動時に自動判定を有効にする")}
            </span>
          </Switch.Content>
        </Switch>
      </section>

      <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-[var(--color-paper-2)] p-4">
        <SectionHeading>{t(lang, "モックモード")}</SectionHeading>
        <p className="text-[length:var(--text-sm)] text-[var(--color-ink-2)]">
          {isMockMode
            ? t(
                lang,
                "有効です。OpenAI APIキーが未設定、またはモック固定設定のため、字幕はサンプルデータで表示されます。",
              )
            : t(lang, "無効です。実際のOpenAI Realtime Translation APIに接続します。")}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{t(lang, "履歴の全削除")}</SectionHeading>
        <p className="text-[length:var(--text-sm)] text-[var(--color-ink-2)]">
          {t(lang, "保存されているすべての会話履歴を削除します。元に戻せません。")}
        </p>
        <button
          type="button"
          onClick={onDeleteAll}
          className="min-h-11 w-fit rounded-[var(--radius-pill)] bg-[var(--color-danger)] px-6 text-[length:var(--text-sm)] font-bold text-[var(--color-danger-ink)] transition-transform duration-(--dur-fast) ease-(--ease-out) active:scale-[0.97]"
        >
          {t(lang, "すべての履歴を削除")}
        </button>
      </section>

      <section className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--color-muted)]">
        <span className="font-mono">Realtime Translator</span>
        <span>{t(lang, "音声は保存されません。自動言語判定は補助機能です。")}</span>
      </section>
    </div>
  );
}
