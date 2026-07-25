import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_JP } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// Keep this key literal in sync with SETTINGS_STORAGE_KEY in
// lib/settings/local-settings.ts — this script can't import TS modules,
// it runs before hydration to set [data-theme] and avoid a light/dark flash.
const SET_THEME_BEFORE_PAINT_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("realtime-translator:settings");
    var theme = raw ? JSON.parse(raw).theme : null;
    if (theme !== "light" && theme !== "dark") {
      theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Realtime Translator",
  description: "対面2人で使うリアルタイム日英翻訳字幕アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJP.variable} ${geistMono.variable} h-full antialiased`}
      // The before-paint script below sets data-theme client-side (before
      // React hydrates) to avoid a light/dark flash; the server can't know
      // this value, so this specific mismatch is expected and intentional.
      suppressHydrationWarning
    >
      <head>
        <Script id="set-theme-before-paint" strategy="beforeInteractive">
          {SET_THEME_BEFORE_PAINT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
