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

1. **Disable npm workspaces** during CI using `--workspaces=false` flag to prevent automatic package linking
2. **Install and build packages individually** in correct dependency order:
   - **First**: Install and build core dependencies (`core`, `sequence`, `task`)
   - **Second**: Install and build dependent packages (`master`, `tenant`, `cli`, `ui-setting`)

This prevents npm workspaces from automatically triggering prepare scripts before dependencies are available, eliminating the TypeScript compilation errors.

### Changes Made

Updated `.github/workflows/run-test-and-publish-main.yaml`:
- Changed `npm ci --ignore-scripts` to `npm ci --ignore-scripts --workspaces=false`
- Replaced lerna-based builds with individual package installation and builds
- Applied the fix to all three jobs: unit test, e2e test, and publish
- Each package is installed and built in its own directory to ensure proper dependency resolution

## 問題の説明 (Japanese for Slack)

mainブランチのCIでmasterパッケージのTypeScriptコンパイルエラーが発生していました。エラーはワークスペース依存関係（`@mbc-cqrs-serverless/core`、`@mbc-cqrs-serverless/task`、`@mbc-cqrs-serverless/sequence`）がビルド処理中に解決できないことを示していました。

### 根本原因分析

問題はnpmの`prepare`スクリプトがワークスペース依存関係が利用可能になる前に`npm ci`中に実行されることが原因でした。モノレポには相互依存関係を持つパッケージが含まれています：

- **コアパッケージ**: `core`、`sequence`、`task`（基本依存関係）
- **依存パッケージ**: `master`、`tenant`、`cli`、`ui-setting`（コアパッケージに依存）

`master`と`tenant`パッケージには依存関係インストール中に`npm run build`を実行する`prepare`スクリプトがあります。npmドキュメントによると、`prepare`スクリプトは`--ignore-scripts`フラグを使用しても実行されるため、これらのパッケージがワークスペース依存関係が利用可能になる前にビルドしようとした際にTypeScriptコンパイルエラーが発生していました。

### 解決策

GitHub Actionsワークフローを以下のように修正しました：

1. **npm workspacesを無効化**: CI中に`--workspaces=false`フラグを使用して自動パッケージリンクを防止
2. **パッケージを個別にインストール・ビルド**：正しい依存関係順序で実行
   - **最初**: コア依存関係をインストール・ビルド（`core`、`sequence`、`task`）
   - **次に**: 依存パッケージをインストール・ビルド（`master`、`tenant`、`cli`、`ui-setting`）

これにより、npm workspacesが依存関係が利用可能になる前にprepareスクリプトを自動実行することを防ぎ、TypeScriptコンパイルエラーを解消します。

### 実施した変更

`.github/workflows/run-test-and-publish-main.yaml`を更新：
- `npm ci --ignore-scripts`を`npm ci --ignore-scripts --workspaces=false`に変更
- lernaベースのビルドを個別パッケージのインストール・ビルドに置き換え
- 3つのジョブすべて（ユニットテスト、e2eテスト、パブリッシュ）に修正を適用
- 各パッケージを独自のディレクトリでインストール・ビルドして適切な依存関係解決を保証

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
