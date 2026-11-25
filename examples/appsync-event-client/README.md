# AppSync Events Client / AppSync イベントクライアント

This is a Next.js-based client application designed to test and demonstrate real-time notification subscriptions over both traditional AWS AppSync GraphQL Subscriptions and the new **AWS AppSync Events API**.

AWS AppSync GraphQL Subscriptions と新しい **AWS AppSync Events API** の両方で、リアルタイムの通知サブスクリプションをテストおよび実証するための Next.js ベースのクライアントアプリケーションです。

---

## Features / 主な機能

- **Unified Subscription Interface / 統一されたサブスクリプションインターフェース**: A single, transport-agnostic `subscribe()` function allows swapping underlying clients seamlessly without altering the UI or hook logic. (`subscribe()` 関数により、UIやフックのロジックを変更することなく、トランスポートクライアントをシームレスに切り替えることができます。)
- **Bilingual Test UI / バイリンガルテストUI**: Fully localized interactive dashboard to connect, disconnect, alter subscription dimensions (`tenantCode`, `action`, `id`), and view real-time data logs in English and Japanese. (接続、切断、サブスクリプション条件の変更、およびリアルタイムのデータログ表示を日英両方でサポートするインタラクティブなダッシュボード。)
- **Channel Path Sanitization / チャンネルパスの正規化**: Automatically matches server-side CQRS path normalization regulations (non-alphanumeric conversion to dashes). (サーバー側の CQRS パス正規化ルールに自動的に適合します。)

---

## Directory Structure / ディレクトリ構成

```text
src/
  ├── app/
  │   ├── globals.css      # Tailwind & theme configurations
  │   ├── layout.tsx       # Main document layout with corrected metadata
  │   └── page.tsx         # Interactive bilingual AppSync Tester UI
  └── lib/
      └── subscribe-events.ts # Unified subscription abstraction layer
```

---

## Getting Started / はじめに

### 1. Prerequisites / 前提条件

Ensure you have your target AppSync Events API configurations ready.
対象となる AppSync Events API の設定情報を用意してください。

### 2. Configuration / 設定

Copy the example env file and fill in values from your CDK stack outputs or AWS console:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` (do not commit it — `.env*` is gitignored):

```bash
NEXT_PUBLIC_APPSYNC_EVENTS_ENDPOINT=https://<id>.appsync-api.<region>.amazonaws.com/event
NEXT_PUBLIC_APPSYNC_EVENTS_REGION=ap-northeast-1
NEXT_PUBLIC_APPSYNC_EVENTS_API_KEY=da2-xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APPSYNC_EVENTS_NAMESPACE=default
```

`page.tsx` reads these `NEXT_PUBLIC_*` variables at build/runtime. You do not need to hardcode secrets in source files.

### 3. Installation / インストール

Install the project dependencies:
依存関係をインストールします。

```bash
npm install
```

### 4. Run the Development Server / 開発サーバーの起動

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to use the AppSync Events Tester.
ブラウザで [http://localhost:3000](http://localhost:3000) を開き、AppSync イベントテスターを使用します。

---

## Architecture Context / アーキテクチャ解説

The `subscribe-events.ts` library standardizes real-time subscriptions by enforcing a common `SubscribeClient` contract across different communication paths:
`subscribe-events.ts` ライブラリは、異なる通信経路間で共通の `SubscribeClient` 契約を適用することにより、リアルタイムサブスクリプションを標準化します。

### Channel Resolution / チャンネル解決の仕組み

When using the `EventsSubscriptionClientImpl`, inputs map transparently into structured path hierarchical wildcards matching standard server routing conventions:
`EventsSubscriptionClientImpl` を使用する場合、入力値は標準のサーバールーティング規則に一致する、構造化されたパス階層のワイルドカードに透過的にマッピングされます。

* **Tenant only / テナントのみ**: `/{namespace}/{tenantCode}/*`
* **Tenant + Action / テナント + アクション**: `/{namespace}/{tenantCode}/{action}/*`
* **Specific Identifier / 特定のID指定**: `/{namespace}/{tenantCode}/{action}/{sanitizedId}`
