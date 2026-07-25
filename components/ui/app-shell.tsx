import Link from "next/link";
import { t } from "@/lib/i18n/translate";
import type { UiLanguage } from "@/types/settings";

interface AppShellProps {
  title: string;
  uiLanguage: UiLanguage;
  children: React.ReactNode;
}

export function AppShell({ title, uiLanguage, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-paper)] text-[var(--color-ink)]">
      <header className="flex items-center justify-between border-b border-[var(--color-rule)] px-4 py-3">
        <Link
          href="/"
          className="text-[length:var(--text-sm)] text-[var(--color-muted)] underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--color-ink)] hover:decoration-current"
        >
          {t(uiLanguage, "← 翻訳に戻る")}
        </Link>
        <h1 className="text-[length:var(--text-sm)] font-bold">{t(uiLanguage, title)}</h1>
        <span className="w-20" aria-hidden="true" />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
