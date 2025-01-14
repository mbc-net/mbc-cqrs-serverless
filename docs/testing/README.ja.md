# MBC CQRS Serverless フレームワーク テストガイド

このガイドでは、MBC CQRS Serverless フレームワークを使用して構築されたアプリケーションのテストの作成方法と実行方法について説明します。

## 目次
1. [概要](#概要)
2. [テストの種類](#テストの種類)
3. [E2Eテスト](#e2eテスト)
4. [バージョン管理ルール](#バージョン管理ルール)
5. [実装例](#実装例)

## 概要

MBC CQRS Serverless フレームワークは、CQRSアプリケーションの包括的なテスト機能を提供します。これには、ユニットテスト、統合テスト、エンドツーエンド（E2E）テストが含まれます。

## テストの種類

### ユニットテスト
- 個々のコンポーネントを分離してテスト
- ソースファイルと同じディレクトリの `__tests__` ディレクトリに配置
- Jestをテストフレームワークとして使用

### 統合テスト
- 複数のコンポーネント間の相互作用をテスト
- `test/integration` ディレクトリに配置
- サービス間の統合をテスト

### E2Eテスト
- 機能全体をエンドツーエンドでテスト
- `test/e2e` ディレクトリに配置
- APIエンドポイントとデータ永続化をテスト

## E2Eテスト

### セットアップ
1. `test/e2e` ディレクトリに `.e2e-spec.ts` 拡張子のテストファイルを作成
2. `test/e2e/config.ts` から提供されるテストユーティリティを使用
3. `.env.test` にテスト環境変数を設定

### ベストプラクティス
1. テスト前後にテストデータをクリーンアップ
2. テストデータには一意の識別子を使用
3. Arrange-Act-Assertパターンに従う
4. 適切なエラーハンドリングを含める
5. 成功と失敗の両方のシナリオをテスト

## バージョン管理ルール

フレームワークは楽観的ロックをバージョン番号で実装しています：

1. 同じpk/skの組み合わせを持つアイテム：
   - バージョンは1から順番に設定する必要があります
   - 特定のバージョンでは最初のリクエストのみが成功
   - 同じバージョンの後続のリクエストは失敗

2. 異なるpk/skの組み合わせ：
   - 各組み合わせは独自のバージョンシーケンスを1から開始
   - バージョンシーケンスは独立して管理

### 楽観的ロック
- 同時更新を防ぐために使用
- 更新ごとにバージョン番号がインクリメント
- バージョンの競合時にConditionalCheckFailedExceptionをスロー

## 実装例

### 基本的なCRUDテスト
\`\`\`typescript
describe('CRUD操作', () => {
  it('アイテムの作成と取得ができること', async () => {
    // 準備
    const payload = {
      pk: 'TEST#CRUD',
      sk: 'item#1',
      id: 'TEST#CRUD#item#1',
      name: 'テストアイテム',
      version: 0,
      type: 'TEST',
    }

    // 実行
    const createRes = await request(config.apiBaseUrl)
      .post('/items')
      .send(payload)

    // 検証
    expect(createRes.statusCode).toBe(201)
    expect(createRes.body.version).toBe(1)

    // 取得の確認
    const getRes = await request(config.apiBaseUrl)
      .get(\`/items/\${payload.id}\`)
    
    expect(getRes.statusCode).toBe(200)
    expect(getRes.body).toMatchObject({
      ...payload,
      version: 1,
    })
  })
})
\`\`\`

### バージョン競合テスト
\`\`\`typescript
describe('バージョン管理', () => {
  it('バージョン競合を適切に処理すること', async () => {
    // 準備
    const payload = {
      pk: 'TEST#VERSION',
      sk: 'conflict#1',
      id: 'TEST#VERSION#conflict#1',
      name: 'バージョンテスト',
      version: 1,
      type: 'TEST',
    }

    // 実行 - 最初の更新
    const res1 = await request(config.apiBaseUrl)
      .put(\`/items/\${payload.id}\`)
      .send(payload)

    // 実行 - 同じバージョンでの2回目の更新
    const res2 = await request(config.apiBaseUrl)
      .put(\`/items/\${payload.id}\`)
      .send(payload)

    // 検証
    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(409) // 競合
  })
})
\`\`\`

### 異なるPK/SKのバージョンテスト
\`\`\`typescript
describe('独立したバージョン管理', () => {
  it('異なるPK/SKの組み合わせで独立したバージョンシーケンスを維持すること', async () => {
    // 準備
    const item1 = {
      pk: 'TEST#SEQ1',
      sk: 'item#1',
      id: 'TEST#SEQ1#item#1',
      name: 'シーケンス1',
      version: 0,
      type: 'TEST',
    }

    const item2 = {
      pk: 'TEST#SEQ2',
      sk: 'item#1',
      id: 'TEST#SEQ2#item#1',
      name: 'シーケンス2',
      version: 0,
      type: 'TEST',
    }

    // 実行
    const res1 = await request(config.apiBaseUrl)
      .post('/items')
      .send(item1)

    const res2 = await request(config.apiBaseUrl)
      .post('/items')
      .send(item2)

    // 検証
    expect(res1.body.version).toBe(1)
    expect(res2.body.version).toBe(1)
  })
})
\`\`\`
