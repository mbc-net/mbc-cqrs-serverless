# MCP Host Package

MCPホストパッケージ - Claude AIを使用したAWSリソースアクセス

## 概要

このパッケージは、Model Context Protocol (MCP) を使用してAWSリソースに自然言語でアクセスできるシステムを提供します。Claude AIと統合し、顧客問い合わせ対応や系統稼働状況の監視を行います。

## 主な機能

- **自然言語でのAWSリソースアクセス**: CloudWatch Logs、RDS、DynamoDBに自然言語でクエリ
- **Claude AI統合**: 顧客問い合わせを自動処理
- **マルチテナント対応**: テナント別データ分離
- **定期報告**: システム稼働状況の自動レポート生成
- **RESTful API**: HTTP API Gateway経由でのアクセス

## アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│   MCP Host      │───▶│   MCP Server    │
│   (HTTP API)    │    │   (Node.js)     │    │   (Python)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Claude API    │    │  AWS Services   │
                       │                 │    │ CloudWatch/RDS/ │
                       │                 │    │   DynamoDB      │
                       └─────────────────┘    └─────────────────┘
```

## インストール

```bash
npm install @mbc-cqrs-serverless/mcp-host
```

## 環境変数

```bash
# Claude API設定
CLAUDE_API_KEY=your_claude_api_key

# MCP Server設定
MCP_SERVER_URL=http://localhost:8000

# データベース設定（オプション）
DATABASE_URL=postgresql://user:password@host:port/database

# AWS設定
AWS_REGION=ap-northeast-1
NODE_ENV=production
```

## 使用方法

### 基本的な使用例

```typescript
import { McpHostModule } from '@mbc-cqrs-serverless/mcp-host'

@Module({
  imports: [McpHostModule],
})
export class AppModule {}
```

### API エンドポイント

#### チャット処理
```bash
POST /mcp/chat
{
  "message": "システムの稼働状況を教えてください",
  "tenantCode": "tenant001"
}
```

#### CloudWatch Logs検索
```bash
POST /mcp/cloudwatch-logs
{
  "logGroup": "/aws/lambda/my-function",
  "query": "エラーログを検索して",
  "hoursBack": 24
}
```

#### システムメトリクス取得
```bash
GET /mcp/system-metrics?tenantCode=tenant001
```

## 自然言語クエリ例

### CloudWatch Logs
- "エラーログを検索して"
- "警告を含むログを表示"
- "過去1時間のログを確認"

### RDS
- "ユーザー数を教えて"
- "最新のデータを取得"
- "全てのレコードを表示"

### DynamoDB
- "データ件数を確認"
- "最新のレコードを取得"
- "テーブルの状況を教えて"

## 開発

### ローカル開発環境

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# Docker Compose での起動
docker-compose up -d
```

### テスト

```bash
# 単体テスト
npm test

# テストカバレッジ
npm run test:cov

# E2Eテスト
npm run test:e2e
```

### ビルド

```bash
# TypeScriptビルド
npm run build

# Dockerイメージビルド
npm run docker:build
```

## デプロイ

### AWS CDK

```bash
# CDK依存関係のインストール
npm install -g aws-cdk

# インフラデプロイ
cdk deploy --context prefix=prod-mcp \
           --context claudeApiKey=/mcp/claude-api-key \
           --context databaseUrl=/mcp/database-url
```

### 環境別設定

```bash
# 開発環境
cdk deploy --context prefix=dev-mcp

# 本番環境
cdk deploy --context prefix=prod-mcp
```

## 設定

### MCP Server設定

MCP Serverは以下のツールを提供します：

- `cloudwatch_logs_query`: CloudWatch Logs検索
- `rds_data_query`: RDSデータクエリ
- `dynamodb_operations`: DynamoDB操作
- `system_metrics`: システムメトリクス取得

### Claude AI設定

Claude APIの設定は環境変数またはAWS Systems Manager Parameter Storeで管理します。

## トラブルシューティング

### よくある問題

1. **Claude API認証エラー**
   - `CLAUDE_API_KEY`が正しく設定されているか確認
   - APIキーの有効期限を確認

2. **MCP Server接続エラー**
   - `MCP_SERVER_URL`が正しく設定されているか確認
   - MCP Serverが起動しているか確認

3. **AWS権限エラー**
   - IAMロールに必要な権限が付与されているか確認
   - CloudWatch Logs、RDS、DynamoDBへのアクセス権限を確認

## ライセンス

MIT

## 貢献

プルリクエストやイシューの報告を歓迎します。

## サポート

技術的な質問やサポートが必要な場合は、GitHubのIssuesを使用してください。
