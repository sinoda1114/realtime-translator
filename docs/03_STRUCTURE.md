# リアルタイム翻訳Webアプリ ストラクチャ構造

- 文書名: `03_STRUCTURE.md`
- 作業名: Realtime Translator（仮称）
- 対象: Claude Codeによる実装タスク・ディレクトリ設計
- 作成日: 2026-07-24

## 1. 実装方針

Claude Codeは、OpenAI APIキーが未設定でも停止せず、以下の順番で実装する。

1. Next.jsプロジェクト作成
2. HeroUI導入
3. 画面とモック翻訳
4. Turso作成・Drizzle導入
5. 会話履歴API
6. Web Audio APIによる無音検知
7. OpenAI Realtime Translation接続コード
8. テスト
9. Vercelデプロイ
10. OpenAIキー設定後の実機確認

OpenAIキーが必要な箇所には明確なTODOを残すが、その他の作業は完了させる。

## 2. 推奨ディレクトリ構成

```text
realtime-translator/
├─ app/
│  ├─ api/
│  │  ├─ realtime/
│  │  │  └─ token/
│  │  │     └─ route.ts
│  │  ├─ conversations/
│  │  │  ├─ route.ts
│  │  │  └─ [conversationId]/
│  │  │     ├─ route.ts
│  │  │     └─ utterances/
│  │  │        └─ route.ts
│  │  └─ health/
│  │     └─ route.ts
│  ├─ history/
│  │  ├─ page.tsx
│  │  └─ [conversationId]/
│  │     └─ page.tsx
│  ├─ settings/
│  │  └─ page.tsx
│  ├─ error.tsx
│  ├─ global-error.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  ├─ loading.tsx
│  ├─ not-found.tsx
│  ├─ page.tsx
│  └─ providers.tsx
├─ components/
│  ├─ translator/
│  │  ├─ translator-screen.tsx
│  │  ├─ translation-pane.tsx
│  │  ├─ transcript-text.tsx
│  │  ├─ language-controls.tsx
│  │  ├─ session-button.tsx
│  │  ├─ status-bar.tsx
│  │  ├─ reconnect-banner.tsx
│  │  └─ permission-guide.tsx
│  ├─ history/
│  │  ├─ conversation-card.tsx
│  │  ├─ conversation-list.tsx
│  │  └─ utterance-list.tsx
│  ├─ settings/
│  │  └─ settings-form.tsx
│  └─ ui/
│     ├─ app-shell.tsx
│     ├─ empty-state.tsx
│     └─ error-message.tsx
├─ hooks/
│  ├─ use-device-id.ts
│  ├─ use-local-settings.ts
│  ├─ use-microphone.ts
│  ├─ use-silence-detector.ts
│  ├─ use-translation-session.ts
│  └─ use-transcript-buffer.ts
├─ lib/
│  ├─ db/
│  │  ├─ client.ts
│  │  ├─ schema.ts
│  │  ├─ queries.ts
│  │  └─ migrations.ts
│  ├─ openai/
│  │  ├─ client-secret.ts
│  │  ├─ realtime-client.ts
│  │  ├─ realtime-events.ts
│  │  ├─ realtime-types.ts
│  │  └─ session-config.ts
│  ├─ translation/
│  │  ├─ direction.ts
│  │  ├─ language-detector.ts
│  │  ├─ mock-translation-client.ts
│  │  ├─ transcript-buffer.ts
│  │  └─ utterance-finalizer.ts
│  ├─ audio/
│  │  ├─ audio-constraints.ts
│  │  ├─ rms.ts
│  │  └─ silence-detector.ts
│  ├─ api/
│  │  ├─ errors.ts
│  │  ├─ responses.ts
│  │  └─ validation.ts
│  ├─ security/
│  │  ├─ device-hash.ts
│  │  └─ rate-limit.ts
│  ├─ env.ts
│  ├─ logger.ts
│  └─ utils.ts
├─ types/
│  ├─ conversation.ts
│  ├─ translation.ts
│  └─ settings.ts
├─ drizzle/
│  └─ migrations/
├─ tests/
│  ├─ unit/
│  │  ├─ language-detector.test.ts
│  │  ├─ transcript-buffer.test.ts
│  │  ├─ direction.test.ts
│  │  └─ silence-detector.test.ts
│  ├─ integration/
│  │  ├─ realtime-token.test.ts
│  │  ├─ conversations.test.ts
│  │  └─ utterances.test.ts
│  └─ e2e/
│     ├─ translator.spec.ts
│     └─ history.spec.ts
├─ public/
│  └─ icons/
├─ .env.example
├─ .gitignore
├─ drizzle.config.ts
├─ eslint.config.mjs
├─ next.config.ts
├─ package.json
├─ playwright.config.ts
├─ postcss.config.mjs
├─ README.md
├─ tsconfig.json
└─ vitest.config.ts
```

## 3. モジュール責務

### 3.1 `lib/openai/realtime-client.ts`

責務:

- RTCPeerConnection生成
- DataChannel生成
- マイクAudioTrack追加
- SDP交換
- Realtimeイベント受信
- `session.update` 送信
- セッション終了
- 接続状態通知

外部へ公開するインターフェース例:

```ts
export type TranslationClientCallbacks = {
  onSourceDelta: (delta: string, elapsedMs?: number) => void;
  onTranslationDelta: (delta: string, elapsedMs?: number) => void;
  onStateChange: (state: RealtimeConnectionState) => void;
  onError: (error: TranslationClientError) => void;
};

export interface TranslationClient {
  connect(input: {
    clientSecret: string;
    stream: MediaStream;
    targetLanguage: "ja" | "en";
  }): Promise<void>;
  updateTargetLanguage(language: "ja" | "en"): void;
  close(): Promise<void>;
}
```

### 3.2 `lib/translation/transcript-buffer.ts`

責務:

- 原文deltaの連結
- 翻訳deltaの連結
- Reactへの更新通知
- 発話確定時のスナップショット作成
- バッファクリア

deltaの間に空白を追加しない。

### 3.3 `lib/translation/language-detector.ts`

責務:

- 日本語文字・英字の比率計算
- 判定保留
- 信頼度計算
- 連続判定によるチャタリング防止

返却例:

```ts
type LanguageDetection = {
  language: "ja" | "en" | "unknown";
  confidence: number;
};
```

### 3.4 `lib/audio/silence-detector.ts`

責務:

- AnalyserNode初期化
- RMS計算
- speaking / silent判定
- 無音継続時間計測
- 発話確定コールバック

Reactに依存させず、Unit Test可能なクラスまたは純粋関数として作る。

### 3.5 `lib/translation/mock-translation-client.ts`

本番クライアントと同じインターフェースを実装する。

- 接続状態を模擬
- 原文deltaを時間差で通知
- 翻訳deltaを時間差で通知
- 言語切り替えに応答
- エラー注入を可能にする

### 3.6 `lib/db/queries.ts`

- `getOrCreateDevice`
- `createConversation`
- `endConversation`
- `createUtterance`
- `listConversations`
- `getConversation`
- `deleteConversation`
- `deleteAllConversationsForDevice`

Route Handlerから直接SQLを書かない。

## 4. 状態設計

### 4.1 セッション状態

```ts
type TranslationSessionState =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "listening"
  | "speaking"
  | "finalizing"
  | "reconnecting"
  | "stopping"
  | "stopped"
  | "error"
  | "mock";
```

### 4.2 翻訳方向

```ts
type SourceLanguage = "ja" | "en";
type TargetLanguage = "ja" | "en";
type Direction = "ja-to-en" | "en-to-ja";
```

方向変換は純粋関数にする。

```ts
function getTargetLanguage(source: SourceLanguage): TargetLanguage {
  return source === "ja" ? "en" : "ja";
}
```

### 4.3 現在の発話

```ts
type ActiveUtterance = {
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  sourceText: string;
  translatedText: string;
  startedAtMs: number | null;
  lastAudioAtMs: number | null;
  isFinalizing: boolean;
};
```

## 5. Drizzle Schema例

```ts
import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    deviceHash: text("device_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (table) => [uniqueIndex("devices_device_hash_uidx").on(table.deviceHash)],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: ["manual", "auto"] }).notNull(),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("conversations_device_started_idx").on(table.deviceId, table.startedAt)],
);

export const utterances = sqliteTable(
  "utterances",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sourceLanguage: text("source_language", { enum: ["ja", "en"] }).notNull(),
    targetLanguage: text("target_language", { enum: ["ja", "en"] }).notNull(),
    sourceText: text("source_text").notNull(),
    translatedText: text("translated_text").notNull(),
    startedOffsetMs: integer("started_offset_ms").notNull(),
    endedOffsetMs: integer("ended_offset_ms").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("utterances_conversation_created_idx").on(table.conversationId, table.createdAt)],
);
```

## 6. 実装タスク

### Phase 0: 初期確認

- [ ] `01_REQUIREMENTS.md` を読む
- [ ] `02_SPECIFICATION.md` を読む
- [ ] `03_STRUCTURE.md` を読む
- [ ] 実装対象がMVP範囲内か確認する
- [ ] 不明点は合理的なデフォルトで進め、READMEに記録する

### Phase 1: プロジェクト初期化

- [ ] Next.js App Router + TypeScriptで作成
- [ ] pnpmを使用
- [ ] HeroUIを導入
- [ ] Tailwind CSSを設定
- [ ] ESLintを設定
- [ ] Vitest、Testing Library、Playwrightを導入
- [ ] `.env.example` を作成
- [ ] `env.ts` にZod環境変数検証を実装

### Phase 2: モックUI

- [ ] 翻訳画面を作成
- [ ] 上側180度回転を実装
- [ ] 原文・翻訳字幕コンポーネントを作成
- [ ] 言語切り替えを実装
- [ ] 自動判定スイッチを実装
- [ ] 状態表示を実装
- [ ] モックdeltaを表示
- [ ] モバイル表示を確認

### Phase 3: Turso

- [ ] Turso CLIの利用可否を確認
- [ ] データベースを作成
- [ ] 認証トークンを作成
- [ ] `.env.local` に設定
- [ ] Drizzleを導入
- [ ] Schemaを作成
- [ ] Migrationを生成・適用
- [ ] Seedは不要
- [ ] DBヘルスチェックを実装

### Phase 4: 履歴API

- [ ] 匿名端末IDを生成
- [ ] 端末IDハッシュを実装
- [ ] 会話作成API
- [ ] 会話終了API
- [ ] 発話保存API
- [ ] 履歴一覧API
- [ ] 履歴詳細API
- [ ] 履歴削除API
- [ ] Zod validation
- [ ] 所有確認

### Phase 5: 無音検知

- [ ] マイク取得hook
- [ ] AudioContext初期化
- [ ] RMS計算
- [ ] 発話開始判定
- [ ] 無音判定
- [ ] 無音時間設定
- [ ] 発話確定
- [ ] 停止時フラッシュ
- [ ] Unit Test

### Phase 6: Realtime Translation

- [ ] 一時キー発行Route Handler
- [ ] APIキー未設定時のモック応答
- [ ] WebRTCクライアント
- [ ] DataChannelイベント処理
- [ ] 原文delta処理
- [ ] 翻訳delta処理
- [ ] `session.update` による翻訳先変更
- [ ] リモート音声を再生しない
- [ ] セッション終了
- [ ] 接続エラー・再接続

このPhaseはOpenAI APIキーがなくてもコード・モックテストまで完了させる。実API確認だけを保留にする。

### Phase 7: 自動判定

- [ ] 日本語文字判定
- [ ] 英語文字判定
- [ ] 最小文字数
- [ ] 信頼度
- [ ] 連続判定
- [ ] `session.update`
- [ ] 手動上書き
- [ ] 実験的表示

### Phase 8: 履歴UI・設定

- [ ] 履歴一覧
- [ ] 履歴詳細
- [ ] 削除確認
- [ ] 設定画面
- [ ] 文字サイズ反映
- [ ] 無音確定時間反映
- [ ] 履歴全削除

### Phase 9: 品質

- [ ] Unit Test
- [ ] Integration Test
- [ ] E2E Test
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:e2e`
- [ ] モバイル幅で確認
- [ ] マイク拒否を確認
- [ ] DB障害を確認
- [ ] Realtime切断を確認

### Phase 10: Vercel

- [ ] Vercelプロジェクト作成
- [ ] Git連携
- [ ] Turso環境変数登録
- [ ] OpenAIキー以外の環境変数登録
- [ ] Previewデプロイ
- [ ] E2Eまたはスモークテスト
- [ ] Productionデプロイ
- [ ] URLをREADMEに記載

### Phase 11: OpenAIキー受領後

- [ ] `OPENAI_API_KEY` をVercelに登録
- [ ] ローカル環境に登録
- [ ] 一時キー発行を確認
- [ ] 日本語→英語を実機確認
- [ ] 英語→日本語を実機確認
- [ ] 話者切り替えを確認
- [ ] 無音確定を確認
- [ ] OpenAIキーがブラウザへ露出しないことを確認
- [ ] Productionへ反映

## 7. Claude Codeへの実行指示

```text
3つの仕様書を正として、MVPを実装してください。
OpenAI APIキーはまだありません。キー待ちで作業を止めず、モック翻訳、UI、Turso、API、テスト、Vercelデプロイまで進めてください。
OpenAI接続は公式Realtime Translation APIのWebRTC方式で実装し、標準APIキーはサーバー側だけで使用してください。
外部サービスの作成や設定は、利用可能なCLIまたは連携ツールを使用してください。
秘密情報をログ、Git、画面、回答文へ出力しないでください。
各Phaseの終了時に、実施内容、変更ファイル、テスト結果、残作業を簡潔に報告してください。
```

## 8. 実装完了時の報告形式

```text
## 実施内容

## 作成・変更ファイル

## 外部サービス
- Turso:
- Vercel:

## テスト結果
- lint:
- typecheck:
- unit:
- integration:
- e2e:

## 動作確認URL

## 未完了
- OpenAI APIキー設定
- 実APIによる日英翻訳確認

## 次の操作
```

## 9. READMEに必ず含める内容

- アプリ概要
- 技術構成
- ローカル起動
- 環境変数
- Turso migration
- モックモード
- OpenAIキー設定方法
- Vercelデプロイ
- テストコマンド
- 既知の制約
- 自動言語判定が補助機能であること
- 音声を保存しないこと

## 10. package scripts案

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
```

## 11. Definition of Doneチェックリスト

- [ ] 要件定義を満たしている
- [ ] 仕様書と実装の差分がない
- [ ] ディレクトリ構成が責務分離されている
- [ ] OpenAIキーなしでモック動作する
- [ ] Tursoに履歴が保存される
- [ ] 上下分割・180度回転が機能する
- [ ] 手動の日英切り替えが機能する
- [ ] 自動判定を無効化できる
- [ ] 無音で発話が確定する
- [ ] 生音声を保存していない
- [ ] 秘密情報を露出していない
- [ ] 主要テストが成功する
- [ ] Vercelへデプロイ済み
- [ ] READMEが完成している
- [ ] OpenAIキー設定後の作業が明確である
