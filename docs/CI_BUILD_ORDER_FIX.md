# CI Build Order Fix - Critical Documentation

## ⚠️ WARNING: DO NOT MODIFY WITHOUT UNDERSTANDING

This document explains a critical fix for CI build failures in the main branch workflow. **Modifying the approach described here without understanding the root cause will break the CI pipeline.**

## Problem Summary

The main branch CI was failing with 83 TypeScript compilation errors in the `master` package due to unresolved module imports for workspace dependencies (`@mbc-cqrs-serverless/core`, `@mbc-cqrs-serverless/task`, `@mbc-cqrs-serverless/sequence`).

## Root Cause

npm's `prepare` scripts execute during `npm ci` **even with the `--ignore-scripts` flag**. This is documented npm behavior that cannot be bypassed with flags alone.

The monorepo contains packages with interdependencies:
- **Core packages**: `core`, `sequence`, `task` (base dependencies)
- **Dependent packages**: `master`, `tenant`, `cli`, `ui-setting` (depend on core packages)

The `master` and `tenant` packages have `prepare` scripts that run `npm run build` during dependency installation. When these scripts execute before workspace dependencies are available, TypeScript compilation fails.

## Solution: Temporary package.json Modification

The fix uses a **temporary package.json modification approach** in the GitHub Actions workflow:

1. **Backup** original package.json files before dependency installation
2. **Temporarily remove** `prepare` scripts using sed commands
3. **Install dependencies** with `npm ci --ignore-scripts` (now effective)
4. **Restore** original package.json files for proper builds
5. **Build packages** in dependency order using lerna scoped commands

### Implementation Details

```bash
# Backup original files
cp packages/master/package.json packages/master/package.json.bak
cp packages/tenant/package.json packages/tenant/package.json.bak

# Remove prepare scripts temporarily
sed -i '/"prepare":/d' packages/master/package.json
sed -i '/"prepare":/d' packages/tenant/package.json

# Install dependencies safely
npm ci --ignore-scripts

# Restore original configuration
mv packages/master/package.json.bak packages/master/package.json
mv packages/tenant/package.json.bak packages/tenant/package.json
```

## Files Modified

- `.github/workflows/run-test-and-publish-main.yaml` - All three jobs (unit_tests, e2e_tests, publish)
- Applied to all dependency installation steps in the main branch workflow

## Why This Approach Works

1. **Eliminates npm prepare script execution** during dependency installation
2. **Preserves original package configuration** for builds and publishing
3. **Uses modern lerna v8 scoped commands** for proper dependency ordering
4. **No permanent modifications** to source code
5. **Safe backup/restore mechanism** prevents data loss

## Maintenance Notes

- **Only master and tenant packages** currently have prepare scripts
- **New packages with prepare scripts** will need to be added to the sed commands
- **The approach is CI-specific** and doesn't affect local development
- **Backup/restore mechanism** ensures no permanent changes to package.json files

## References

- npm documentation on lifecycle scripts
- Japanese blog post: https://egashira.dev/blog/npm-install-option-ignore-scripts
- Original issue: PR #184 TypeScript compilation errors

## ⚠️ Critical Warning

**DO NOT:**
- Remove the backup/restore mechanism
- Modify the sed commands without testing
- Add `--ignore-scripts` flag alone (it doesn't work for prepare scripts)
- Change the build order without understanding dependencies

**ALWAYS:**
- Test locally before modifying the CI workflow
- Understand the npm prepare script behavior
- Maintain the temporary modification approach
- Document any changes to this system
