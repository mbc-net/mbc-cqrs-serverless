# CI Build Order Fix Documentation

## Problem Description (English)

The main branch CI was failing with TypeScript compilation errors in the master package. The errors indicated that workspace dependencies (`@mbc-cqrs-serverless/core`, `@mbc-cqrs-serverless/task`, `@mbc-cqrs-serverless/sequence`) could not be resolved during the build process.

### Root Cause Analysis

The issue was caused by npm's `prepare` scripts running during `npm ci` before workspace dependencies were available. The monorepo contains packages with interdependencies:

- **Core packages**: `core`, `sequence`, `task` (base dependencies)
- **Dependent packages**: `master`, `tenant`, `cli`, `ui-setting` (depend on core packages)

The `master` and `tenant` packages have `prepare` scripts that run `npm run build` during dependency installation. According to npm documentation and the Japanese blog post (https://egashira.dev/blog/npm-install-option-ignore-scripts), `prepare` scripts run even with the `--ignore-scripts` flag, causing TypeScript compilation failures when these packages try to build before their workspace dependencies are available.

### Solution

Modified the GitHub Actions workflow to use a **temporary package.json modification approach**:

1. **Backup original package.json files** before dependency installation
2. **Temporarily remove `prepare` scripts** using sed commands to prevent premature builds
3. **Install dependencies** with `npm ci --ignore-scripts` (now effective since prepare scripts are removed)
4. **Restore original package.json files** to maintain proper package configuration
5. **Build packages in dependency order** using modern lerna v8 scoped commands

This approach completely eliminates the npm `prepare` script execution during dependency installation while preserving the original package configuration for subsequent builds and publishing.

### Changes Made

Updated `.github/workflows/run-test-and-publish-main.yaml`:
- **Unit Tests Job**: Added temporary package.json modification with backup/restore mechanism
- **E2E Tests Job**: Applied the same temporary modification approach
- **Publish Job**: Implemented the same approach to ensure consistent behavior
- **Build Commands**: Used modern `npx lerna run build --scope` commands for proper dependency ordering
- **Sed Commands**: `sed -i '/"prepare":/d'` safely removes only the prepare script lines
- **File Operations**: `cp` for backup, `mv` for restoration ensures no data loss

### Technical Details

The sed command `sed -i '/"prepare":/d'` removes lines containing `"prepare":` from package.json files:
- Targets only the specific script lines that cause issues
- Preserves all other package.json content
- Works reliably across different package.json formats
- Safe operation with backup/restore mechanism

The backup/restore mechanism ensures:
- Original package.json files are preserved
- No permanent modifications to source code
- Proper package configuration for builds and publishing
- Clean separation between dependency installation and building phases

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
