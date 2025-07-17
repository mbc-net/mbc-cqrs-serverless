# CI Build Order Fix Documentation

## Problem Description (English)

The main branch CI was failing with TypeScript compilation errors in the master package. The errors indicated that workspace dependencies (`@mbc-cqrs-serverless/core`, `@mbc-cqrs-serverless/task`, `@mbc-cqrs-serverless/sequence`) could not be resolved during the build process.

### Root Cause Analysis

The issue was caused by npm's `prepare` scripts running during `npm ci` before workspace dependencies were available. The monorepo contains packages with interdependencies:

- **Core packages**: `core`, `sequence`, `task` (base dependencies)
- **Dependent packages**: `master`, `tenant`, `cli`, `ui-setting` (depend on core packages)

The `master` and `tenant` packages have `prepare` scripts that run `npm run build` during dependency installation. According to npm documentation, `prepare` scripts run even with the `--ignore-scripts` flag, causing TypeScript compilation failures when these packages try to build before their workspace dependencies are available.

### Solution

Modified the GitHub Actions workflow to:

1. **Remove prepare scripts** temporarily during CI to prevent premature builds
2. **Build packages in dependency order** after installation:
   - **First**: Build core dependencies (`core`, `sequence`, `task`)
   - **Second**: Build dependent packages (`master`, `tenant`, `cli`, `ui-setting`)

This ensures that workspace dependencies are built and available before dependent packages attempt to compile.

### Changes Made

Updated `.github/workflows/run-test-and-publish-main.yaml`:
- Added step to remove `prepare` scripts from master and tenant packages before `npm ci`
- Replaced single "Build packages" steps with ordered build steps
- Applied the fix to all three jobs: unit test, e2e test, and publish
- Used lerna scoped builds to control build order precisely

## 問題の説明 (Japanese for Slack)

mainブランチのCIでmasterパッケージのTypeScriptコンパイルエラーが発生していました。エラーはワークスペース依存関係（`@mbc-cqrs-serverless/core`、`@mbc-cqrs-serverless/task`、`@mbc-cqrs-serverless/sequence`）がビルド処理中に解決できないことを示していました。

### 根本原因分析

問題はnpmの`prepare`スクリプトがワークスペース依存関係が利用可能になる前に`npm ci`中に実行されることが原因でした。モノレポには相互依存関係を持つパッケージが含まれています：

- **コアパッケージ**: `core`、`sequence`、`task`（基本依存関係）
- **依存パッケージ**: `master`、`tenant`、`cli`、`ui-setting`（コアパッケージに依存）

`master`と`tenant`パッケージには依存関係インストール中に`npm run build`を実行する`prepare`スクリプトがあります。npmドキュメントによると、`prepare`スクリプトは`--ignore-scripts`フラグを使用しても実行されるため、これらのパッケージがワークスペース依存関係が利用可能になる前にビルドしようとした際にTypeScriptコンパイルエラーが発生していました。

### 解決策

GitHub Actionsワークフローを以下のように修正しました：

1. **prepareスクリプトを一時的に削除**: CI中に早期ビルドを防ぐため
2. **インストール後に依存関係順序でパッケージをビルド**：
   - **最初**: コア依存関係をビルド（`core`、`sequence`、`task`）
   - **次に**: 依存パッケージをビルド（`master`、`tenant`、`cli`、`ui-setting`）

これにより、依存パッケージがコンパイルを試行する前にワークスペース依存関係がビルドされ利用可能になります。

### 実施した変更

`.github/workflows/run-test-and-publish-main.yaml`を更新：
- `npm ci`前にmasterとtenantパッケージから`prepare`スクリプトを削除するステップを追加
- 単一の「Build packages」ステップを順序付きビルドステップに置き換え
- 3つのジョブすべて（ユニットテスト、e2eテスト、パブリッシュ）に修正を適用
- lernaスコープビルドを使用してビルド順序を正確に制御

### メリット・デメリット

**メリット**：
- 根本原因（prepareスクリプトの早期実行）を解決
- 既存の動作するPRワークフローパターンを踏襲するため安全性が高い
- 修正箇所が明確で影響範囲が限定的
- モノレポのベストプラクティスに準拠
- 開発環境やパッケージ公開時のprepareスクリプト機能は保持

**デメリット**：
- ビルド時間が若干増加する可能性（順次ビルドのため）
- 依存関係の変更時にワークフロー更新が必要になる場合がある
- CI環境でのprepareスクリプト削除により、開発環境との動作差異が生じる可能性
