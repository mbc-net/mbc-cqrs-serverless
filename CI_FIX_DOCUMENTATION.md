# CI Build Order Fix Documentation

## Problem Description (English)

The main branch CI was failing with TypeScript compilation errors in the master package. The errors indicated that workspace dependencies (`@mbc-cqrs-serverless/core`, `@mbc-cqrs-serverless/task`, `@mbc-cqrs-serverless/sequence`) could not be resolved during the build process.

### Root Cause Analysis

The issue was caused by incorrect build order in the CI workflow. The monorepo contains packages with interdependencies:

- **Core packages**: `core`, `sequence`, `task` (base dependencies)
- **Dependent packages**: `master`, `tenant`, `cli`, `ui-setting` (depend on core packages)

The original CI workflow attempted to build all packages simultaneously using `npm run build`, which caused TypeScript compilation failures when dependent packages tried to import from core packages that hadn't been built yet.

### Solution

Modified the GitHub Actions workflow to build packages in dependency order:

1. **First**: Build core dependencies (`core`, `sequence`, `task`)
2. **Second**: Build dependent packages (`master`, `tenant`, `cli`, `ui-setting`)

This ensures that all workspace dependencies are available when TypeScript attempts to resolve imports.

### Changes Made

Updated `.github/workflows/run-test-and-publish-main.yaml`:
- Replaced single "Build packages" steps with ordered build steps
- Applied the fix to all three jobs: unit test, e2e test, and publish
- Used lerna scoped builds to control build order precisely

## 問題の説明 (Japanese for Slack)

mainブランチのCIでmasterパッケージのTypeScriptコンパイルエラーが発生していました。エラーはワークスペース依存関係（`@mbc-cqrs-serverless/core`、`@mbc-cqrs-serverless/task`、`@mbc-cqrs-serverless/sequence`）がビルド処理中に解決できないことを示していました。

### 根本原因分析

問題はCIワークフローでの不適切なビルド順序が原因でした。モノレポには相互依存関係を持つパッケージが含まれています：

- **コアパッケージ**: `core`、`sequence`、`task`（基本依存関係）
- **依存パッケージ**: `master`、`tenant`、`cli`、`ui-setting`（コアパッケージに依存）

元のCIワークフローは`npm run build`を使用してすべてのパッケージを同時にビルドしようとしていたため、依存パッケージがまだビルドされていないコアパッケージからインポートしようとした際にTypeScriptコンパイルエラーが発生していました。

### 解決策

GitHub Actionsワークフローを依存関係順序でパッケージをビルドするように修正しました：

1. **最初**: コア依存関係をビルド（`core`、`sequence`、`task`）
2. **次に**: 依存パッケージをビルド（`master`、`tenant`、`cli`、`ui-setting`）

これにより、TypeScriptがインポートを解決しようとする際に、すべてのワークスペース依存関係が利用可能になります。

### 実施した変更

`.github/workflows/run-test-and-publish-main.yaml`を更新：
- 単一の「Build packages」ステップを順序付きビルドステップに置き換え
- 3つのジョブすべて（ユニットテスト、e2eテスト、パブリッシュ）に修正を適用
- lernaスコープビルドを使用してビルド順序を正確に制御

### メリット・デメリット

**メリット**：
- 根本原因（ビルド順序問題）を解決
- 既存の動作するPRワークフローパターンを踏襲するため安全性が高い
- 修正箇所が明確で影響範囲が限定的
- モノレポのベストプラクティスに準拠

**デメリット**：
- ビルド時間が若干増加する可能性（順次ビルドのため）
- 依存関係の変更時にワークフロー更新が必要になる場合がある
