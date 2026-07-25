# リアルタイム翻訳Webアプリ 仕様書

- 文書名: `02_SPECIFICATION.md`
- 作業名: Realtime Translator（仮称）
- 対象: Claude Codeによる設計・実装
- 作成日: 2026-07-24

## 1. システム概要

```text
スマートフォンブラウザ
  ├─ HeroUIによる翻訳画面
  ├─ getUserMedia / WebRTC
  ├─ 原文・翻訳deltaの表示
  ├─ Web Audio APIによる無音検知
  └─ 匿名端末ID
          │
          ├─ POST /api/realtime/token
          │       └─ OpenAI Translation Client Secret発行
          │
          ├─ WebRTC ───────── OpenAI Realtime Translation API
          │                     ├─ gpt-realtime-translate
          │                     └─ gpt-realtime-whisper
          │
          └─ Next.js API ───── Turso
                                └─ Drizzle ORM
```

## 2. 技術選定

### 2.1 フロントエンド

| 項目 | 採用技術 |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| Package manager | pnpm |
| UI | HeroUI |
| Styling | Tailwind CSS |
| State | React hooks + Context。必要になった場合のみZustand |
| Validation | Zod |
| Test | Vitest / React Testing Library / Playwright |

HeroUIを採用する。今回のMVPは管理画面よりも、字幕、ボタン、モーダル、スイッチ、スライダーを中心としたモバイルUIであるため、Tailwindと組み合わせて上下反転表示を実装しやすい。

### 2.2 バックエンド

- Next.js Route Handlers
- Vercel Functions
- Turso
- Drizzle ORM
- `@libsql/client`

### 2.3 翻訳

- `gpt-realtime-translate`
- `gpt-realtime-whisper`
- WebRTC
- OpenAI Realtime Translation Client Secret

## 3. 画面仕様

### 3.1 `/` 翻訳画面

#### レイアウト

```text
┌──────────────────────────────┐
│ 相手側表示：180度回転         │
│ English / 日本語              │
│ 原文                          │
│ 翻訳                          │
│ 状態                          │
├──────────────────────────────┤
│ 操作エリア                    │
│ [日本語] [English] [自動]     │
│ [翻訳を開始 / 停止]           │
│ 接続・マイク・保存状態         │
├──────────────────────────────┤
│ 操作者側表示                  │
│ 日本語 / English              │
│ 原文                          │
│ 翻訳                          │
│ 状態                          │
└──────────────────────────────┘
```

実装上は上下の字幕領域を同一データから描画する。上側コンテナ全体に `transform: rotate(180deg)` を適用する。

#### 表示状態

- `idle`: 未開始
- `requesting_permission`: マイク許可待ち
- `connecting`: OpenAI接続中
- `listening`: 入力待ち
- `speaking`: 発話中
- `finalizing`: 発話確定中
- `saving`: Turso保存中
- `reconnecting`: 再接続中
- `error`: エラー
- `stopped`: 停止済み
- `mock`: モック翻訳モード

#### 操作

- 日本語ボタン
  - 入力言語を日本語として扱う。
  - 翻訳先を英語にする。
- Englishボタン
  - 入力言語を英語として扱う。
  - 翻訳先を日本語にする。
- 自動スイッチ
  - 字幕文字列から日本語・英語を補助判定する。
- 開始ボタン
  - 会話レコードを作成する。
  - マイク権限を要求する。
  - OpenAIセッションを作成する。
- 停止ボタン
  - 現在の発話を確定する。
  - セッションを閉じる。
  - 会話終了日時を保存する。

### 3.2 `/history`

- 会話履歴を新しい順に表示する。
- カード表示項目:
  - 開始日時
  - 終了日時または会話時間
  - 発話数
  - 先頭の原文
  - 先頭の翻訳文
- 0件の場合は空状態を表示する。

### 3.3 `/history/[conversationId]`

- 会話情報
- 発話一覧
- 入力言語バッジ
- 原文
- 翻訳文
- 発話時刻
- 会話削除ボタン

### 3.4 `/settings`

- 字幕サイズ: small / medium / large / extra-large
- 無音確定時間: 600ms / 900ms / 1200ms / 1500ms
- 自動判定の初期状態
- 履歴全削除
- アプリバージョン
- モックモード状態

設定はMVPではLocal Storageに保存する。

## 4. UIコンポーネント

### 4.1 `TranslationPane`

Props:

```ts
type TranslationPaneProps = {
  orientation: "normal" | "rotated";
  sourceLanguage: "ja" | "en";
  sourceText: string;
  translatedText: string;
  isSpeaking: boolean;
  isFinal: boolean;
};
```

### 4.2 `LanguageControls`

- `日本語`
- `English`
- `自動`
- 現在の判定結果

### 4.3 `SessionButton`

- 開始・停止を同一ボタンで切り替える。
- 接続中は二重押下を防止する。

### 4.4 `StatusBar`

- マイク
- API接続
- DB保存
- モックモード
- エラー概要

### 4.5 `TranscriptText`

- 発話中はカーソルまたは控えめなアニメーションを表示する。
- 確定済みは通常表示にする。
- 長文は自動スクロールする。

## 5. Realtime Translation接続仕様

### 5.1 一時キー発行

Endpoint:

```http
POST /api/realtime/token
Content-Type: application/json
```

Request:

```json
{
  "targetLanguage": "en",
  "deviceId": "browser-generated-uuid"
}
```

Response:

```json
{
  "clientSecret": "ek_xxx",
  "expiresAt": 1234567890,
  "mock": false
}
```

OpenAI APIキー未設定時:

```json
{
  "clientSecret": null,
  "expiresAt": null,
  "mock": true
}
```

サーバーからOpenAIへ送る設定例:

```json
{
  "expires_after": {
    "anchor": "created_at",
    "seconds": 600
  },
  "session": {
    "model": "gpt-realtime-translate",
    "audio": {
      "input": {
        "transcription": {
          "model": "gpt-realtime-whisper"
        },
        "noise_reduction": {
          "type": "near_field"
        }
      },
      "output": {
        "language": "en"
      }
    }
  }
}
```

- OpenAI APIキーはRoute Handler内だけで使用する。
- `OpenAI-Safety-Identifier` には端末IDの不可逆ハッシュを使用する。
- クライアントシークレットのTTLは600秒を初期値とする。

### 5.2 WebRTC接続

1. `getUserMedia({ audio: ... })` を取得する。
2. `RTCPeerConnection` を生成する。
3. マイクのAudioTrackを追加する。
4. DataChannelを作成する。
5. 一時キーを使用してOpenAIとのWebRTC接続を確立する。
6. DataChannelから字幕イベントを受信する。
7. リモート音声はMVPでは再生しない。

推奨音声制約:

```ts
const constraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  },
};
```

### 5.3 受信イベント

#### 原文

```ts
case "session.input_transcript.delta":
  sourceBuffer += event.delta;
  break;
```

#### 翻訳文

```ts
case "session.output_transcript.delta":
  translatedBuffer += event.delta;
  break;
```

#### エラー

```ts
case "error":
  handleRealtimeError(event.error);
  break;
```

deltaはappend-onlyとして扱い、任意の空白を補わない。

### 5.4 翻訳方向の切り替え

手動モードではDataChannelから `session.update` を送る。

日本語から英語:

```json
{
  "type": "session.update",
  "session": {
    "audio": {
      "output": {
        "language": "en"
      }
    }
  }
}
```

英語から日本語:

```json
{
  "type": "session.update",
  "session": {
    "audio": {
      "output": {
        "language": "ja"
      }
    }
  }
}
```

切り替え前に現在の発話を確定する。モデル自体はセッション途中で変更しない。

## 6. 自動言語判定仕様

### 6.1 方針

Realtime Translationは翻訳先言語を設定して利用するため、MVPの自動判定はクライアント側の補助ロジックとして実装する。

### 6.2 判定方法

入力字幕の直近文字列を使用する。

- ひらがな、カタカナ、漢字を含む場合: 日本語候補
- 英字を中心とする場合: 英語候補
- 数字、記号、短い相づちだけの場合: 判定保留
- 4文字未満: 判定保留
- 2回連続で同じ判定になった場合に確定

### 6.3 切り替え

- 日本語判定: 翻訳先を英語へ更新
- 英語判定: 翻訳先を日本語へ更新
- 現在の設定と一致する場合は何もしない
- 切り替え時は画面に通知する

### 6.4 制約

最初の数文字では正しく判定できない場合がある。自動判定は実験的機能として表示し、常に手動ボタンを利用可能にする。APIコストが2倍になるため、日英2セッション同時実行はMVPでは採用しない。

## 7. 発話確定仕様

Realtime Translationの字幕は連続deltaであるため、MVPではクライアント側で発話境界を作る。

### 7.1 無音検知

- Web Audio APIの `AnalyserNode` を使用する。
- 音量のRMSを一定間隔で測定する。
- 発話開始閾値と終了閾値を分ける。
- 初期の無音確定時間は900msとする。
- 設定画面から変更可能にする。

### 7.2 状態遷移

```text
listening
  └─ 音量が開始閾値以上 → speaking
speaking
  └─ 音量が終了閾値未満 → silence_pending
silence_pending
  ├─ 再び音声あり → speaking
  └─ 900ms継続 → finalizing
finalizing
  ├─ DB保存成功 → listening
  └─ DB保存失敗 → ローカル再試行キュー → listening
```

### 7.3 確定条件

- 原文または翻訳文が空の場合は保存しない。
- 末尾空白だけを除去する。
- 原文・翻訳文の双方が揃うまで最大1.5秒待つ。
- 最大待機後に片方だけの場合は `partial` 状態で保存せず、画面に警告する。
- 停止時は待機中バッファをフラッシュする。

## 8. モック翻訳仕様

OpenAI APIキーが未設定でもClaude Codeが実装を完了できるようにする。

### 8.1 有効条件

- `NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION=true`
- または `/api/realtime/token` が `mock: true` を返す

### 8.2 動作

- マイク許可は実際に取得可能にする。
- テスト用の日本語・英語字幕を一定間隔でdeltaとして流す。
- 原文と翻訳文を別タイミングで更新する。
- 無音確定、DB保存、履歴表示まで本番と同じコードパスを通す。

### 8.3 サンプル

```text
原文delta: 今日は / 横浜に / 行きます
翻訳delta: I'm going / to Yokohama / today.
```

## 9. DB仕様

### 9.1 `devices`

| Column | Type | Constraint |
|---|---|---|
| id | text | PK, UUID |
| device_hash | text | UNIQUE, NOT NULL |
| created_at | integer | NOT NULL |
| last_seen_at | integer | NOT NULL |

### 9.2 `conversations`

| Column | Type | Constraint |
|---|---|---|
| id | text | PK, UUID |
| device_id | text | FK devices.id, NOT NULL |
| mode | text | manual / auto |
| started_at | integer | NOT NULL |
| ended_at | integer | NULL |
| created_at | integer | NOT NULL |

### 9.3 `utterances`

| Column | Type | Constraint |
|---|---|---|
| id | text | PK, UUID |
| conversation_id | text | FK conversations.id, NOT NULL |
| source_language | text | ja / en |
| target_language | text | en / ja |
| source_text | text | NOT NULL |
| translated_text | text | NOT NULL |
| started_offset_ms | integer | NOT NULL |
| ended_offset_ms | integer | NOT NULL |
| created_at | integer | NOT NULL |

### 9.4 Index

- `devices.device_hash` unique index
- `conversations.device_id, conversations.started_at`
- `utterances.conversation_id, utterances.created_at`

### 9.5 削除

- conversation削除時はutterancesをcascade deleteする。
- device削除はMVP UIから行わない。

## 10. API仕様

### 10.1 会話作成

```http
POST /api/conversations
```

```json
{
  "deviceId": "uuid",
  "mode": "manual"
}
```

### 10.2 会話終了

```http
PATCH /api/conversations/{id}
```

```json
{
  "endedAt": 1234567890
}
```

### 10.3 発話保存

```http
POST /api/conversations/{id}/utterances
```

```json
{
  "deviceId": "uuid",
  "sourceLanguage": "ja",
  "targetLanguage": "en",
  "sourceText": "今日は横浜に行きます。",
  "translatedText": "I'm going to Yokohama today.",
  "startedOffsetMs": 1000,
  "endedOffsetMs": 4200
}
```

### 10.4 履歴一覧

```http
GET /api/conversations?deviceId={uuid}
```

### 10.5 履歴詳細

```http
GET /api/conversations/{id}?deviceId={uuid}
```

### 10.6 履歴削除

```http
DELETE /api/conversations/{id}
```

BodyまたはHeaderで端末IDを受け取り、所有確認を行う。

## 11. エラー仕様

| Code | 画面表示 | 動作 |
|---|---|---|
| MICROPHONE_DENIED | マイクの利用が許可されていません | 設定方法を表示 |
| MICROPHONE_UNAVAILABLE | マイクを利用できません | 再試行 |
| REALTIME_TOKEN_FAILED | 翻訳セッションを開始できません | 再試行またはモック |
| REALTIME_DISCONNECTED | 接続が切れました | 再接続 |
| REALTIME_API_ERROR | 翻訳中にエラーが発生しました | ログ記録、再接続 |
| DB_SAVE_FAILED | 履歴を保存できませんでした | メモリ上の再試行キュー |
| INVALID_REQUEST | 入力内容が不正です | 操作をやり直す |

ユーザー画面には秘密情報、スタックトレース、OpenAIレスポンス全文を表示しない。

## 12. ログ仕様

- 構造化ログを使用する。
- 記録対象:
  - session start / stop
  - token issue success / failure
  - WebRTC state change
  - error code
  - DB save success / failure
- 記録しない:
  - 生音声
  - APIキー
  - 一時キー
  - 会話本文の全文

## 13. テスト仕様

### 13.1 Unit Test

- deltaを空白追加なしで連結できる。
- 日本語・英語の判定ができる。
- 短文を判定保留にできる。
- 手動切り替え時に正しいtarget languageを生成する。
- 無音900msで発話確定する。
- 発話再開時に確定タイマーを解除する。
- 空字幕を保存しない。

### 13.2 Integration Test

- 一時キー発行API
- APIキー未設定時のモックレスポンス
- 会話作成・終了
- 発話保存
- 端末ID不一致時の拒否
- 履歴一覧・詳細・削除
- Turso接続失敗時のエラー

### 13.3 E2E Test

- モックモードで開始できる。
- 上下に字幕が表示される。
- 上側が180度回転している。
- 言語を切り替えられる。
- 発話が確定して履歴へ保存される。
- 履歴詳細を開ける。
- 履歴を削除できる。
- マイク拒否時に案内が出る。

## 14. 実装上の禁止事項

- APIキーをハードコードしない。
- OpenAI標準APIキーをクライアントへ返さない。
- delta間に勝手に空白を追加しない。
- 発話途中の字幕をDBへ逐次保存しない。
- 生音声をTursoやVercelへ保存しない。
- 自動言語判定だけに依存しない。
- OpenAIキー待ちを理由に、UI・DB・モック・テストの実装を止めない。

## 15. 参考資料

- https://developers.openai.com/api/docs/guides/realtime-translation
- https://developers.openai.com/api/reference/resources/realtime/translation-client-events
- https://developers.openai.com/api/reference/resources/realtime/translation-server-events
- https://developers.openai.com/api/reference/resources/realtime/subresources/translations/subresources/client_secrets/methods/create
- https://docs.turso.tech/sdk/ts/guides/nextjs
- https://docs.turso.tech/sdk/ts/orm/drizzle
- https://v2.heroui.com/docs/guide/installation
