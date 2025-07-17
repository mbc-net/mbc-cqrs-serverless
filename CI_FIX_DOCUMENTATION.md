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

1. **Add `--ignore-scripts` flag** to prevent `prepare` scripts from running during dependency installation
2. **Use modern lerna v8 commands** to ensure packages are built in correct dependency order:
   - **First**: Build core dependencies (`core`, `sequence`, `task`) using `npx lerna run build --scope`
   - **Second**: Build dependent packages (`master`, `tenant`, `cli`, `ui-setting`) using `npx lerna run build --scope`
   - **For publishing**: Use `npx lerna run build` to build all packages in dependency order

This approach leverages modern lerna v8 capabilities while preventing npm's `prepare` scripts from running before workspace dependencies are available, eliminating the TypeScript compilation errors.

### Changes Made

Updated `.github/workflows/run-test-and-publish-main.yaml`:
- Added `--ignore-scripts` flag to all `npm ci` commands
- Replaced individual package builds with modern `npx lerna run build` commands using package scoping
- Applied the fix to all three jobs: unit test, e2e test, and publish
- Used lerna's scoped build functionality to ensure proper dependency resolution order
- Simplified the publish job to use `npx lerna run build` which automatically handles dependency order

## 問題の説明 (Japanese for Slack)

mainブランチのCIでmasterパッケージのTypeScriptコンパイルエラーが発生していました。エラーはワークスペース依存関係（`@mbc-cqrs-serverless/core`、`@mbc-cqrs-serverless/task`、`@mbc-cqrs-serverless/sequence`）がビルド処理中に解決できないことを示していました。

### 根本原因分析

問題はnpmの`prepare`スクリプトがワークスペース依存関係が利用可能になる前に`npm ci`中に実行されることが原因でした。モノレポには相互依存関係を持つパッケージが含まれています：

- **コアパッケージ**: `core`、`sequence`、`task`（基本依存関係）
- **依存パッケージ**: `master`、`tenant`、`cli`、`ui-setting`（コアパッケージに依存）

`master`と`tenant`パッケージには依存関係インストール中に`npm run build`を実行する`prepare`スクリプトがあります。npmドキュメントによると、`prepare`スクリプトは`--ignore-scripts`フラグを使用しても実行されるため、これらのパッケージがワークスペース依存関係が利用可能になる前にビルドしようとした際にTypeScriptコンパイルエラーが発生していました。

### 解決策

GitHub Actionsワークフローを以下のように修正しました：

1. **`--ignore-scripts`フラグを追加**: 依存関係インストール中に`prepare`スクリプトの実行を防止
2. **現代的なlerna v8コマンドを使用**: パッケージが正しい依存関係順序でビルドされることを保証
   - **最初**: `npx lerna run build --scope`を使用してコア依存関係をビルド（`core`、`sequence`、`task`）
   - **次に**: `npx lerna run build --scope`を使用して依存パッケージをビルド（`master`、`tenant`、`cli`、`ui-setting`）
   - **パブリッシュ用**: `npx lerna run build`を使用して依存関係順序で全パッケージをビルド

このアプローチは現代的なlerna v8の機能を活用し、ワークスペース依存関係が利用可能になる前にnpmの`prepare`スクリプトが実行されることを防ぎ、TypeScriptコンパイルエラーを解消します。

### 実施した変更

`.github/workflows/run-test-and-publish-main.yaml`を更新：
- すべての`npm ci`コマンドに`--ignore-scripts`フラグを追加
- 個別パッケージビルドを現代的な`npx lerna run build`コマンドとパッケージスコープに置き換え
- 3つのジョブすべて（ユニットテスト、e2eテスト、パブリッシュ）に修正を適用
- lernaのスコープ付きビルド機能を使用して適切な依存関係解決順序を保証
- パブリッシュジョブでは`npx lerna run build`を使用して依存関係順序を自動処理

### メリット・デメリット

**メリット**：
- 根本原因（prepareスクリプトの早期実行）を解決
- 現代的なlerna v8の機能を活用した標準的なアプローチ
- 修正箇所が明確で影響範囲が限定的
- モノレポのベストプラクティスに準拠
- 開発環境やパッケージ公開時のprepareスクリプト機能は保持
- lernaの依存関係解決機能を活用して安全性が高い

**デメリット**：
- lernaコマンドの実行により若干のオーバーヘッドが発生する可能性
- 依存関係の変更時にスコープ指定の更新が必要になる場合がある
- CI環境でのprepareスクリプト無効化により、開発環境との動作差異が生じる可能性
