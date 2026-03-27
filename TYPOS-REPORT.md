# MBC CQRS Serverless - Spelling Mistakes Report

Generated: 2026-01-18 (Updated with fourth check results)
**Last Updated: 2026-01-19 (Internal typos fixed)**

---

## Fix Status Summary

| Category | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| External Impact (Breaking Changes) | 6 | 0 | 6 |
| Configuration (Environment Variables) | 6 | 0 | 6 |
| Internal - Error Messages | 7 | ✅ 7 | 0 |
| Internal - Variable/Method Names | 1 | ✅ 1 | 0 |
| Internal - Comments/Docs | 12+ | ✅ 12+ | 0 |
| Internal - Spelling | 6 | ✅ 6 | 0 |
| Internal - Grammar | 12 | ✅ 12 | 0 |
| Internal - Syntax | 1 | ✅ 1 | 0 |
| Internal - Code Quality | 2 | ✅ 2 | 0 |
| Internal - Test Files | 25+ | ✅ 25+ | 0 |

---

## External Impact (Breaking Changes) - NOT FIXED

These affect public APIs, export names, or property names. Fixing them may break user code.

| Package | File | Issue | Correct | Impact | Status |
|---------|------|-------|---------|--------|--------|
| core | `exceptions/event-source.exeption.ts` | Filename: `exeption` | `exception` | Export path changes | ⚠️ Pending |

---

## Configuration Files (Environment Variables) - FIXED

**Critical**: Environment variable name typo affecting multiple files.

| File | Line | Issue | Correct | Status |
|------|------|-------|---------|--------|
| `packages/core/.env.example` | 35 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` | ✅ Fixed (deprecated with fallback) |
| `packages/core/.env` | 34 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` | ⚠️ Not tracked by git |
| `packages/core/test/infra-local/.env` | 34 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` | ⚠️ Not tracked by git |
| `packages/cli/templates/.env.local` | 38 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` | ✅ Fixed (deprecated with fallback) |
| `examples/seq/.env` | 34 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` | ✅ Fixed (deprecated with fallback) |
| `examples/master/.env` | 38 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` | ✅ Fixed (deprecated with fallback) |

**Note**: `POLL` should be `POOL` (Cognito User Pool, not Poll)

**Backward Compatibility**: `env.validation.ts` automatically migrates `COGNITO_USER_POLL_CLIENT_ID` to `COGNITO_USER_POOL_CLIENT_ID` with a deprecation warning. Existing users with the old variable name will continue to work.

---

## External Impact (Breaking Changes) - Code - NOT FIXED

| Package | File | Issue | Correct | Impact | Status |
|---------|------|-------|---------|--------|--------|
| core | `services/explorer.service.ts` (lines 25, 28) | Variable: `eventFactorys` | `eventFactories` | Internal but exported service | ⚠️ Pending |
| core | `events/event.module.ts` (lines 24, 30, 32) | Variable: `eventFactorys` | `eventFactories` | Module configuration | ⚠️ Pending |
| cli | `schematics/schematic.colection.ts` | Filename: `colection` | `collection` | Internal imports affected | ⚠️ Pending |
| ui-setting | `dto/setting-attributes.dto.ts` (lines 51, 69) | Property: `isShowedOnList` | `isShownOnList` | **API response/request affected** | ⚠️ Pending |
| ui-setting | `dto/setting-update.dto.ts` (line 21) | Property: `isDelete` | `isDeleted` | **API request affected** | ⚠️ Pending |

---

## Internal Only - ✅ ALL FIXED

### Error Messages (User-Visible, Grammar Issues) - ✅ FIXED

| Package | File | Line | Issue | Correct | Status |
|---------|------|------|-------|---------|--------|
| core | `commands/command.service.ts` | 133 | `"is not a valid"` | `"Invalid input"` | ✅ Fixed |
| core | `commands/command.service.ts` | 133 | `"version not match"` | `"version mismatch"` | ✅ Fixed |
| core | `commands/command.service.ts` | 163 | `"is not a valid"` | `"Invalid input key"` | ✅ Fixed |
| core | `commands/command.service.ts` | 197 | `"is not a valid"` | `"Invalid input key"` | ✅ Fixed |
| core | `commands/command.service.ts` | 335 | `"is not a valid"` | `"Invalid input key"` | ✅ Fixed |
| cli | `actions/new.action.ts` | 47 | `chose` | `choose` | ✅ Fixed |
| cli | `actions/ui.action.ts` | 47 | `contain` | `contains` | ✅ Fixed |

### Variable Names & Method Names (Internal) - ✅ FIXED

| Package | File | Line | Issue | Correct | Status |
|---------|------|------|-------|---------|--------|
| core | `events/event.services.ts` | 70 | `handleStepFunctionsEvent` | `handleS3Event` | ✅ Fixed |

### Comments & Documentation - ✅ FIXED

| Package | File | Line | Issue | Correct | Status |
|---------|------|------|-------|---------|--------|
| cli | `utils/formatting.ts` | 4 | JSDoc: `formated` | `formatted` | ✅ Fixed |
| cli | `actions/ui.action.ts` | 37 | Comment: `contain` | `contains` | ✅ Fixed |
| master | `handler/master-sfn-task.handler.ts` | 181, 202 | Comment: `des` | `dest` | ✅ Fixed |
| task | `event/task.queue.event.handler.ts` | 23 | Comment: `can not` | `cannot` | ✅ Fixed |
| task | `event/task.sfn.event.handler.ts` | 20 | Comment: `can not` | `cannot` | ✅ Fixed |
| tenant | `dto/tenant-group-add.dto.ts` | 6 | Comment: `(require)` | `(required)` | ✅ Fixed |
| tenant | `dto/common-tenant-create.dto.ts` | 6 | Comment: `(require)` | `(required)` | ✅ Fixed |
| tenant | `dto/tenant-create.dto.ts` | 6, 18 | Comment: `(require)` | `(required)` | ✅ Fixed |

### Spelling & Grammar - ✅ FIXED

| Package | File | Line | Issue | Correct | Status |
|---------|------|------|-------|---------|--------|
| core | `bootstrap.ts` | 54 | `swager` | `swagger` | ✅ Fixed |
| core | `bootstrap.ts` | 138 | `bootstraping` | `bootstrapping` | ✅ Fixed |
| core | `events/event-bus.ts` | 36 | `binded` | `bound` | ✅ Fixed |
| core | `app.module.ts` | 53 | `allowUnknow` | `allowUnknown` | ✅ Fixed |
| cli | `schematics/schematic.colection.ts` | 29 | `a entity` | `an entity` | ✅ Fixed |
| cli | `schematics/schematic.colection.ts` | 34 | `a dto` | `a DTO` | ✅ Fixed |
| cli | `runners/abstract.runner.ts` | 49 | `will be ran` | `will be run` | ✅ Fixed |
| cli | `actions/ui.action.ts` | 27 | Missing article | `the correct component` | ✅ Fixed |
| cli | `commands/ui.command.ts` | 9 | `add` | `Add` | ✅ Fixed |
| master | `handler/master-sfn-task.handler.ts` | 181, 202 | `is exist` | `exists` | ✅ Fixed |
| master | `interfaces/master-setting.interface.ts` | 24 | `the setting s` | `the setting's` | ✅ Fixed |
| tenant | `services/tenant.service.ts` | 54, 85, 307 | `Tenant already exist` | `Tenant already exists` | ✅ Fixed |
| sequence | `sequences.service.ts` | 51, 53, 100, 102, 111 | `e.x` | `e.g.` | ✅ Fixed |
| sequence | `sequences.service.ts` | 100 | `code5rotateValue` | `code5#rotateValue` | ✅ Fixed |
| sequence | `sequence-master-factory.ts` | 11 | `Injectable()` | `@Injectable()` | ✅ Fixed |
| sequence | `dto/generate-formatted-sequence.dto.ts` | 51 | `code2,code3` | `code2, code3` | ✅ Fixed |
| ui-setting | `services/setting.service.ts` | 69, 120 | `must not duplicate` | `must not be duplicated` | ✅ Fixed |

### Code Quality - ✅ FIXED

| Package | File | Line | Issue | Correct | Status |
|---------|------|------|-------|---------|--------|
| ui-setting | `services/setting.service.ts` | 78 | `== false` | `=== false` | ✅ Fixed |
| ui-setting | `services/data-setting.service.ts` | 86 | `== false` | `=== false` | ✅ Fixed |

### DTO Examples - ✅ FIXED

| Package | File | Line | Issue | Correct | Status |
|---------|------|------|-------|---------|--------|
| master | `dto/master-setting/common-setting-create.dto.ts` | 10 | `' User List Setting'` | `'User List Setting'` | ✅ Fixed |
| master | `dto/master-setting/tenant-setting-create.dto.ts` | 10 | `' User List Setting'` | `'User List Setting'` | ✅ Fixed |
| master | `dto/master-setting/group-setting-create.dto.ts` | 10 | `' User List Setting'` | `'User List Setting'` | ✅ Fixed |
| master | `dto/master-setting/user-setting-create.dto.ts` | 10 | `' User List Setting'` | `'User List Setting'` | ✅ Fixed |

### Test Files Only (No Production Impact) - ✅ FIXED

| Package | File | Line | Issue | Correct | Status |
|---------|------|------|-------|---------|--------|
| core | `commands/command.service.spec.ts` | 202, 297, 318 | Error message expectations | Updated | ✅ Fixed |
| task | `event/sub-task.queue.event.handler.spec.ts` | 49, 69 | ARN: `interation` | `iteration` | ✅ Fixed |
| task | `event/task.sfn.event.handler.spec.ts` | 63, 198, 199, 208 | ARN: `interation` | `iteration` | ✅ Fixed |
| sequence | `sequences.service.spec.ts` | 544, 588 | Double spaces | Fixed | ✅ Fixed |
| sequence | `sequences.service.spec.ts` | 764 | Trailing space | Removed | ✅ Fixed |
| sequence | `sequences.service.spec.ts` | 894, 941, 988, 1032, 1075 | Double spaces | Fixed | ✅ Fixed |
| sequence | `sequences.service.spec.ts` | 17, 1125, 1142, 1169 | Extra whitespace | Removed | ✅ Fixed |
| ui-setting | `services/setting.service.spec.ts` | Multiple | Error message expectations | Updated | ✅ Fixed |

---

## Items NOT Fixed (Intentionally Skipped)

### Abbreviations in Variable Names (Internal but risky to change)

| Package | File | Line | Issue | Correct | Reason |
|---------|------|------|-------|---------|--------|
| cli | `actions/new.action.ts` | 120 | `curVersion` | `currentVersion` | Internal variable, low impact |
| cli | `actions/new.action.ts` | 132 | `fname` | `filePath` | Internal variable, low impact |
| cli | `actions/new.action.ts` | 133 | `tplPackageJson` | `templatePackageJson` | Internal variable, low impact |

### Log Message Abbreviations (Low impact)

| Package | File | Line | Issue | Correct | Reason |
|---------|------|------|-------|---------|--------|
| task | `event/task.queue.event.handler.ts` | 100 | `attr` | `attributes` | Debug log only |
| task | `event/task.queue.event.handler.ts` | 129 | `sfn Exec Name` | `SFN execution name` | Debug log only |

### Method Names (Breaking Change)

| Package | File | Line | Issue | Correct | Reason |
|---------|------|------|-------|---------|--------|
| task | `task.service.ts` | 154 | `getAllSubTask` | `getAllSubTasks` | Breaking Change |

### Documentation Mismatches (Requires deeper review)

| Package | File | Line | Issue | Reason |
|---------|------|------|-------|--------|
| tenant | `dto/tenant-group-update.dto.ts` | 14-21 | `settingGroups` type/description | Needs API review |
| tenant | `controllers/tenant.controller.spec.ts` | 11, 14 | `PUT` vs `PATCH` | Needs API review |
| tenant | `interfaces/tenant.service.interface.ts` | Multiple | Documentation wording | Low priority |

---

## Recommended Action for Remaining Items

### For Breaking Changes (Environment Variables, API Properties):
1. Create deprecation warnings for old names
2. Support both old and new names temporarily
3. Remove old names in next major version
4. Update documentation to mention migration

### For Filename Changes:
1. Create new files with correct names
2. Re-export from old files with deprecation warning
3. Remove old files in next major version

---

## Check History

- **1st Check**: Found basic typos (filenames, property names)
- **2nd Check**: Found additional issues (eventFactorys, isDelete, contain)
- **3rd Check**: Found grammar issues in error messages (command.service.ts)
- **4th Check**: Found spelling, grammar, abbreviation, and documentation issues
- **5th Check**: Found additional grammar errors, missing letters, and DTO mismatches
- **6th Check**: Comprehensive re-verification - confirmed existing issues, no new issues found
- **7th Check**: Found critical environment variable typo `COGNITO_USER_POLL_CLIENT_ID` (should be POOL)
- **8th Check**: Found leading spaces in DTO examples, additional double spaces in tests
- **9th Fix (2026-01-19)**: Fixed all internal typos (non-breaking changes) - 33 files modified

---

## Verification Complete

After 8 comprehensive checks with different focus patterns, the codebase has been thoroughly reviewed. The following pattern categories were verified as correctly spelled:
- ie/ei words (retrieve, receive, achieve, believe)
- Words ending in -ment (environment, development, management)
- Words ending in -ness (business, awareness)
- Silent letter words (knowledge, acknowledge)
- Doubled letter words (occurred, referred, transferred)
- Tech terms (synchronous, asynchronous, parameter)
- Prefix patterns (un-, in-, im-)
