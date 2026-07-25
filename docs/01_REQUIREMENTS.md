# リアルタイム翻訳Webアプリ 要件定義書

- 文書名: `01_REQUIREMENTS.md`
- 作業名: Realtime Translator（仮称）
- 対象: Claude Codeによる実装
- 作成日: 2026-07-24
- ステータス: MVP実装用

## 1. 目的

1台のスマートフォンを対面する2人で共有し、日本語と英語の会話をリアルタイムに文字翻訳するWebアプリを作る。

話している途中から原文字幕と翻訳字幕をストリーミング表示し、相手側からも読みやすいように画面を上下に分割する。上側の表示は180度回転させる。

## 2. 利用者と利用場面

- 利用者: 当面は開発者本人のみ
- 利用場面: 日本語話者と英語話者による対面会話
- 利用端末: 1台のスマートフォン
- 主な動作環境: スマートフォン版Chrome
- ログイン: なし
- 公開方針: まずは個人利用のMVP

## 3. MVPの範囲

### 3.1 必須機能

- 日本語から英語へのリアルタイム翻訳
- 英語から日本語へのリアルタイム翻訳
- 原文字幕のストリーミング表示
- 翻訳字幕のストリーミング表示
- 画面の上下分割
- 相手側表示の180度回転
- 翻訳開始・停止
- 日本語話者・英語話者の手動切り替え
- 自動言語判定のオプション
- マイクの常時待機
- 会話履歴のTurso保存
- 履歴一覧・詳細・削除
- 通信状態、マイク状態、エラー状態の表示
- OpenAI APIキーが未設定でも起動できるモックモード

### 3.2 MVPでは実装しない機能

- 翻訳音声の再生
- ユーザー登録・ログイン
- 複数端末間の同期
- 複数人の話者分離
- 日本語・英語以外の言語
- 電話、Zoom、Meetなどへの組み込み
- PWA、ネイティブアプリ化
- 課金機能
- 会話要約、議事録生成
- 音声ファイルの保存
- 翻訳辞書、カスタムプロンプト

## 4. ユーザーフロー

### 4.1 初回利用

1. アプリを開く。
2. 「翻訳を開始」を押す。
3. ブラウザのマイク利用を許可する。
4. 話者モードを「日本語」または「English」に設定する。
5. 会話を開始する。
6. 原文と翻訳文が話している途中から表示される。
7. 相手が話すときは話者切り替えボタンを押す。
8. 終了時に「翻訳を停止」を押す。
9. 確定済みの会話履歴がTursoに保存される。

### 4.2 自動言語判定

1. 「自動」を有効にする。
2. 入力字幕から日本語・英語を推定する。
3. 推定した入力言語の反対側を翻訳先にする。
4. 判定が不安定な場合はユーザーが手動で切り替える。

自動判定は補助機能とし、初期状態では無効にする。安定性は手動切り替えを優先する。

## 5. 画面要件

### 5.1 翻訳画面

- 画面を上下50%ずつに分割する。
- 上側は相手向け表示として180度回転する。
- 下側は端末操作者向けの通常表示とする。
- 各領域に以下を表示する。
  - 話者言語
  - 原文字幕
  - 翻訳字幕
  - 発話中・確定済みの状態
- 操作ボタンは中央付近または下側に固定する。
- 片手でも操作できる大きさにする。
- 字幕を最優先し、装飾を抑える。

### 5.2 履歴画面

- 会話開始日時
- 会話時間
- 発話件数
- 原文・翻訳文の先頭部分
- 詳細表示
- 会話単位の削除

### 5.3 設定

- 文字サイズ
- 自動言語判定の初期値
- 無音確定時間
- 履歴の全削除
- モックモード表示

## 6. リアルタイム翻訳要件

### 6.1 使用API

- 翻訳モデル: `gpt-realtime-translate`
- 原文字幕モデル: `gpt-realtime-whisper`
- 通信方式: ブラウザからOpenAIへのWebRTC
- 一時キー発行: Vercel上のRoute Handler

### 6.2 字幕の動作

- 原文は `session.input_transcript.delta` を受信するたびに追記する。
- 翻訳文は `session.output_transcript.delta` を受信するたびに追記する。
- deltaの間に自動で空白を挿入しない。
- 発話中の字幕は逐次変化する表示とする。
- 無音が一定時間継続した時点で、その発話を確定する。
- DBには確定した発話だけを保存する。
- 停止操作時は残っている字幕を確定して保存する。

### 6.3 音声出力

APIから翻訳音声が返ってきても、MVPでは再生しない。音声出力イベントまたはリモート音声トラックは破棄・ミュートする。

## 7. データ保存要件

### 7.1 保存対象

- 匿名端末ID
- 会話開始・終了日時
- 話者モード
- 自動判定の使用有無
- 発話ごとの入力言語
- 原文字幕
- 翻訳字幕
- 発話開始・終了位置

### 7.2 保存しないデータ

- 生音声
- OpenAI APIキー
- OpenAIの一時キー
- マイク音声のバイナリ
- 発話途中の不完全な字幕

### 7.3 匿名端末ID

- 初回起動時にUUIDを生成する。
- ブラウザのLocal Storageに保存する。
- APIにはそのまま送らず、必要に応じてサーバー側でハッシュ化する。
- 認証機能ではなく、同一端末の履歴を取得するためだけに使う。

## 8. 技術要件

- Next.js App Router
- TypeScript
- pnpm
- HeroUI
- Tailwind CSS
- Vercel
- Turso
- Drizzle ORM
- `@libsql/client`
- Zod
- WebRTC
- Web Audio API
- Vitest
- React Testing Library
- Playwright

## 9. 外部サービスの準備

Claude Codeが以下を実施する。

- Next.jsプロジェクト作成
- Gitリポジトリ初期化
- Tursoデータベース作成
- Turso認証トークン作成
- Drizzleマイグレーション適用
- Vercelプロジェクト作成・連携
- Vercel環境変数登録
- Preview・Productionデプロイ

OpenAI APIキーのみ、後からユーザーが提供する。それまでは `OPENAI_API_KEY` を未設定のままモックモードで開発・試験できるようにする。

## 10. 環境変数

```env
# 後から設定
OPENAI_API_KEY=

# Claude CodeがTurso作成後に設定
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# 任意
APP_ENV=development
NEXT_PUBLIC_APP_NAME=Realtime Translator
NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION=true
DEVICE_ID_HASH_SALT=
```

### 10.1 環境変数のルール

- `.env.local` はGit管理しない。
- `.env.example` には値を入れない。
- APIキーをクライアント用環境変数にしない。
- `OPENAI_API_KEY` に `NEXT_PUBLIC_` を付けない。
- VercelのProduction、Preview、Developmentに必要な値を登録する。

## 11. 非機能要件

### 11.1 性能

- 字幕delta受信後、100ms以内を目安に画面へ反映する。
- 翻訳開始操作からセッション接続まで、通常回線で5秒以内を目標とする。
- 長時間会話でも字幕DOMが無制限に増えないようにする。
- 現在表示は直近の発話を中心にし、過去分は履歴へ退避する。

### 11.2 可用性

- 接続切断を検知する。
- 再接続ボタンを表示する。
- マイク権限拒否、ネットワーク切断、APIエラーを個別に表示する。
- エラー後も保存済み履歴を閲覧できる。

### 11.3 セキュリティ

- OpenAI標準APIキーをブラウザへ返さない。
- ブラウザには短時間だけ有効なクライアントシークレットを返す。
- APIレスポンスやログに秘密情報を出力しない。
- 入力値をZodで検証する。
- 履歴APIでは匿名端末IDの一致を確認する。
- 本人用MVPでもAPI Routeに最低限のレート制限を設ける。

### 11.4 プライバシー

- 録音中であることを常に画面上に示す。
- 生音声は保存しない。
- 履歴削除機能を提供する。
- DB保存に失敗しても音声データを代替保存しない。

### 11.5 アクセシビリティ

- タップ領域を44px以上にする。
- 状態を色だけで表現しない。
- 字幕の文字サイズを変更可能にする。
- コントラストを確保する。
- ボタンに明確なラベルを付ける。

## 12. 受け入れ条件

- スマートフォンのブラウザで画面が崩れない。
- 1台の端末で上下双方から字幕を読める。
- 上側表示が180度回転している。
- 日本語モードで日本語原文と英語翻訳が表示される。
- 英語モードで英語原文と日本語翻訳が表示される。
- 原文と翻訳がストリーミングで逐次表示される。
- 話者切り替え時にページ再読み込みが発生しない。
- 自動判定をON・OFFできる。
- 無音後に発話が確定する。
- 確定済み発話だけがTursoへ保存される。
- 履歴を一覧・詳細表示・削除できる。
- OpenAI APIキーがブラウザのソース、通信、ログから露出しない。
- OpenAI APIキー未設定時もモックモードで主要画面を確認できる。
- Vercel PreviewとProductionへデプロイできる。

## 13. 完了の定義

- 必須機能が実装済み
- 型チェック成功
- Lint成功
- Unit Test成功
- Integration Test成功
- E2E Test成功
- Tursoマイグレーション適用済み
- Vercel Preview確認済み
- READMEにローカル起動・環境変数・デプロイ方法を記載済み
- OpenAIキー未設定の残作業がREADMEと画面上に明示されている

## 14. 参考資料

- OpenAI Realtime Translation Guide: https://developers.openai.com/api/docs/guides/realtime-translation
- OpenAI Translation Client Secret API: https://developers.openai.com/api/reference/resources/realtime/subresources/translations/subresources/client_secrets/methods/create
- OpenAI Translation Server Events: https://developers.openai.com/api/reference/resources/realtime/translation-server-events
- OpenAI GPT-Realtime-Translate: https://developers.openai.com/api/docs/models/gpt-realtime-translate
- Turso Next.js Guide: https://docs.turso.tech/sdk/ts/guides/nextjs
- Turso Drizzle Guide: https://docs.turso.tech/sdk/ts/orm/drizzle
- HeroUI Installation: https://v2.heroui.com/docs/guide/installation
