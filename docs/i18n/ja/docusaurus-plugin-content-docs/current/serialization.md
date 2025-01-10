# シリアライズヘルパー関数

## 概要
MBC CQRS Serverless フレームワークは、DynamoDBの内部構造と外部向けフラット構造の間の変換を行うヘルパー関数を提供します。これらのヘルパーは、型安全性を維持しながら一貫したデータ変換を保証します。

## データ構造の変換

### DynamoDBの内部構造
```typescript
{
  pk: "PROJECT",
  sk: "123",
  name: "Test Project",
  attributes: {
    details: {
      status: "active",
      category: "development"
    }
  }
}
```

### 外部向けフラット構造
```typescript
{
  "id": "PROJECT#123",    // pkとskの組み合わせ
  "code": "123",         // 主にsk
  "name": "Test Project", // DynamoDBの第1階層
  "details": {           // attributesからフラット化
    "status": "active",
    "category": "development"
  }
}
```

## 使用方法

### 内部形式から外部形式への変換
```typescript
import { serializeToExternal } from '@mbc-cqrs-serverless/core';

const internal = {
  pk: "PROJECT",
  sk: "123",
  name: "Test Project",
  attributes: {
    details: {
      status: "active",
      category: "development"
    }
  }
};

const external = serializeToExternal(internal);
```

### 外部形式から内部形式への変換
```typescript
import { deserializeToInternal, CommandEntity } from '@mbc-cqrs-serverless/core';

const external = {
  id: "PROJECT#123",
  code: "123",
  name: "Test Project",
  details: {
    status: "active",
    category: "development"
  }
};

const internal = deserializeToInternal(external, CommandEntity);
```

## API リファレンス

### serializeToExternal
```typescript
function serializeToExternal<T extends CommandEntity | DataEntity>(
  item: T | null | undefined,
  options?: SerializerOptions
): Record<string, any> | null
```

パラメータ:
- `item`: 内部エンティティ（CommandEntityまたはDataEntity）
- `options`: オプションのシリアライズ設定
  - `keepAttributes`: 出力にattributesフィールドを保持（デフォルト: false）
  - `flattenDepth`: ネストされたオブジェクトのフラット化の最大深度（デフォルト: 無制限）

戻り値:
- フラット化された外部構造、または入力がnull/undefinedの場合はnull

### deserializeToInternal
```typescript
function deserializeToInternal<T extends CommandEntity | DataEntity>(
  data: Record<string, any> | null | undefined,
  EntityClass: new () => T
): T | null
```

パラメータ:
- `data`: 外部フラット構造
- `EntityClass`: インスタンス化するエンティティクラス（CommandEntityまたはDataEntity）

戻り値:
- 内部エンティティのインスタンス、または入力がnull/undefinedの場合はnull

## フィールドマッピング

### メタデータフィールド
| フィールド | 説明 |
|-----------|------|
| id | 主キー |
| cpk | コマンドテーブル用のpk |
| csk | コマンドテーブル用のsk |
| pk | データテーブル用のpk |
| sk | データテーブル用のsk |
| tenantCode | テナントコード |
| type | 種別（pkの一部に埋め込む、例：PROJECT） |
| seq | 並び順 |
| code | コード（skの一部として使用する可能性あり） |
| name | 名前 |
| version | バージョン |
| isDeleted | 削除フラグ |
| createdBy | 作成者のユーザIDまたはユーザ名 |
| createdIp | 作成者のアクセス元IPアドレス |
| createdAt | 作成日時 |
| updatedBy | 更新者のユーザIDまたはユーザ名（作成時もセット） |
| updatedIp | 更新者のアクセス元IPアドレス（作成時もセット） |
| updatedAt | 更新日時（作成時もセット） |
| description | 説明 |
| status | ステータス（CQRS用処理ステータス） |
| dueDate | DynamoDBのTTL等に使用 |

### シリアライズマッピング
| 内部フィールド | 外部フィールド | 説明 |
|--------------|--------------|------|
| pk + sk | id | 結合された主キー |
| sk | code | コードとして使用されるソートキー |
| name | name | 第1階層のプロパティ |
| attributes.* | * | フラット化された属性 |
| version | version | エンティティのバージョン |
| tenantCode | tenantCode | テナント識別子 |
| type | type | エンティティタイプ |
