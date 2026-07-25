# Realtime Translator

対面の2人（日本語話者・英語話者）が1台のスマートフォンを共有し、リアルタイムに文字翻訳字幕を表示するWebアプリです。画面は上下に分割され、上側は相手が読みやすいよう180度回転して表示されます。

詳細な要件・仕様は [`docs/01_REQUIREMENTS.md`](docs/01_REQUIREMENTS.md) / [`docs/02_SPECIFICATION.md`](docs/02_SPECIFICATION.md) / [`docs/03_STRUCTURE.md`](docs/03_STRUCTURE.md)、デザインシステムは [`design.md`](design.md) を参照してください。

## 技術構成

- Next.js (App Router) / TypeScript / pnpm
- HeroUI v3 / Tailwind CSS v4
- Turso (libSQL) / Drizzle ORM
- OpenAI Realtime Translation API（WebRTC、`gpt-realtime-translate` / `gpt-realtime-whisper`）
- Zod / Vitest / React Testing Library / Playwright
- Vercel（デプロイ）

## ローカル起動

```bash
pnpm install
cp .env.example .env.local   # 値を設定（下記「環境変数」参照）
pnpm dev
```

`http://localhost:3000` を開きます。

## 環境変数

`.env.local`（Git管理外）に設定します。値は `.env.example` を参照してください。

| 変数 | 必須 | 説明 |
|---|---|---|
| `OPENAI_API_KEY` | 任意 | 未設定時はモックモードで動作します |
| `TURSO_DATABASE_URL` | 必須 | Turso DBのURL |
| `TURSO_AUTH_TOKEN` | 必須 | Tursoの認証トークン |
| `APP_ENV` | 任意 | `development` / `test` / `production` |
| `NEXT_PUBLIC_APP_NAME` | 任意 | 表示名 |
| `NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION` | 任意 | `true`でモック固定（既定値） |
| `DEVICE_ID_HASH_SALT` | 任意 | 匿名端末IDのハッシュ化に使うsalt |

`OPENAI_API_KEY` は絶対にクライアントへ返しません（Route Handler内でのみ使用し、ブラウザには短命のクライアントシークレットのみを渡します）。

## Turso / Drizzle

```bash
pnpm db:generate   # スキーマからマイグレーションSQLを生成
pnpm db:migrate    # Tursoへ適用
pnpm db:studio     # Drizzle Studioを起動
```

スキーマは `lib/db/schema.ts`、マイグレーションSQLは `drizzle/migrations/` にあります。

## モックモード

`NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION=true`（既定値）、または `OPENAI_API_KEY` 未設定時、`/api/realtime/token` が `mock: true` を返し、実際のOpenAI API呼び出しを行わずにサンプル字幕をストリーミング表示します。マイク許可・無音検知・DB保存・履歴表示は本番と同じコードパスを通ります。

実際のOpenAI Realtime APIに接続するには、`.env.local` の `OPENAI_API_KEY` を設定した上で `NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION=false` にしてください（実APIの呼び出しが発生するため、通常の開発ではモックのままにすることを推奨します）。

## テスト

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest（unit + integration）
pnpm test:e2e    # Playwright（モックモードで実行）
pnpm check       # lint + typecheck + test + build
```

## デプロイ（Vercel）

`main` ブランチへのマージでProductionに、feature ブランチのpushでPreviewに自動デプロイされます。Vercelダッシュボードで環境変数（上記表）を Production / Preview / Development すべてに登録してください。

## 既知の制約

- 自動言語判定は**補助機能**です。誤判定の可能性があるため、常に手動の言語切り替えボタンが利用できます。
- 生の音声データは一切保存しません（DB・Vercelいずれにも保存対象外）。保存されるのは確定済みの原文・翻訳テキストのみです。
- レート制限はプロセス内メモリによる簡易実装です。Vercelのサーバーレス環境ではインスタンスごとに独立するため、厳密な制限ではなく最低限の誤操作防止として機能します。
- OpenAI APIキー未設定時は全機能をモックモードで確認できますが、実際の翻訳精度・レイテンシは実キー設定後の実機確認が必要です。
