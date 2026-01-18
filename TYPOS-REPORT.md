# MBC CQRS Serverless - Spelling Mistakes Report

Generated: 2026-01-18 (Updated with fourth check results)

---

## External Impact (Breaking Changes)

These affect public APIs, export names, or property names. Fixing them may break user code.

| Package | File | Issue | Correct | Impact |
|---------|------|-------|---------|--------|
| core | `exceptions/event-source.exeption.ts` | Filename: `exeption` | `exception` | Export path changes |

---

## Configuration Files (Environment Variables)

**Critical**: Environment variable name typo affecting multiple files.

| File | Line | Issue | Correct |
|------|------|-------|---------|
| `packages/core/.env.example` | 35 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` |
| `packages/core/.env` | 34 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` |
| `packages/core/test/infra-local/.env` | 34 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` |
| `packages/cli/templates/.env.local` | 38 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` |
| `examples/seq/.env` | 34 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` |
| `examples/master/.env` | 38 | `COGNITO_USER_POLL_CLIENT_ID` | `COGNITO_USER_POOL_CLIENT_ID` |

**Note**: `POLL` should be `POOL` (Cognito User Pool, not Poll)

---

## External Impact (Breaking Changes) - Code

| Package | File | Issue | Correct | Impact |
|---------|------|-------|---------|--------|
| core | `services/explorer.service.ts` (lines 25, 28) | Variable: `eventFactorys` | `eventFactories` | Internal but exported service |
| core | `events/event.module.ts` (lines 24, 30, 32) | Variable: `eventFactorys` | `eventFactories` | Module configuration |
| cli | `schematics/schematic.colection.ts` | Filename: `colection` | `collection` | Internal imports affected |
| ui-setting | `dto/setting-attributes.dto.ts` (lines 51, 69) | Property: `isShowedOnList` | `isShownOnList` | **API response/request affected** |
| ui-setting | `dto/setting-update.dto.ts` (line 21) | Property: `isDelete` | `isDeleted` | **API request affected** |

---

## Internal Only (Safe to Fix)

### Error Messages (User-Visible, Grammar Issues)

| Package | File | Line | Issue | Correct |
|---------|------|------|-------|---------|
| core | `commands/command.service.ts` | 133 | `"is not a valid"` | `"is not valid"` or `"is invalid"` |
| core | `commands/command.service.ts` | 133 | `"version not match"` | `"version does not match"` |
| core | `commands/command.service.ts` | 163 | `"is not a valid"` | `"is not valid"` or `"is invalid"` |
| core | `commands/command.service.ts` | 197 | `"is not a valid"` | `"is not valid"` or `"is invalid"` |
| core | `commands/command.service.ts` | 335 | `"is not a valid"` | `"is not valid"` or `"is invalid"` |
| cli | `actions/new.action.ts` | 47 | `chose` | `choose` |
| cli | `actions/ui.action.ts` | 47 | `contain` | `contains` |

### Variable Names & Method Names (Internal)

| Package | File | Line | Issue | Correct | Context |
|---------|------|------|-------|---------|---------|
| core | `events/event.services.ts` | 70 | `handleStepFunctionsEvent` | `handleS3Event` | Wrong method name in log |

### Comments & Documentation

| Package | File | Line | Issue | Correct |
|---------|------|------|-------|---------|
| cli | `utils/formatting.ts` | 4 | JSDoc: `formated` | `formatted` |
| cli | `actions/ui.action.ts` | 37 | Comment: `contain` | `contains` |
| master | `handler/master-sfn-task.handler.ts` | 181, 202 | Comment: `des` | `dest` |
| task | `event/task.queue.event.handler.ts` | 23 | Comment: `can not` | `cannot` |
| task | `event/task.sfn.event.handler.ts` | 20 | Comment: `can not` | `cannot` |
| tenant | `dto/tenant-group-add.dto.ts` | 6 | Comment: `(require)` | `(required)` |
| tenant | `dto/common-tenant-create.dto.ts` | 6 | Comment: `(require)` | `(required)` |
| tenant | `dto/tenant-create.dto.ts` | 6, 18 | Comment: `(require)` | `(required)` |
| tenant | Multiple DTOs | Multiple | Trailing spaces in descriptions | Remove trailing spaces |

### Test Files Only (No Production Impact)

| Package | File | Line | Issue | Correct |
|---------|------|------|-------|---------|
| core | `commands/command.service.spec.ts` | 202, 297, 318 | Same grammar issues as service | Fix grammar |
| task | `event/sub-task.queue.event.handler.spec.ts` | 49, 69 | ARN: `interation` | `iteration` |
| task | `event/task.sfn.event.handler.spec.ts` | 63, 198, 199, 208 | ARN: `interation` | `iteration` |
| sequence | `sequences.service.spec.ts` | 544, 588 | Double spaces in description | Fix spacing |
| sequence | `sequences.service.spec.ts` | 764 | Trailing space | Remove |
| sequence | `sequences.service.spec.ts` | 894, 941, 988, 1032, 1075 | Double spaces | Fix spacing |
| sequence | `sequences.service.spec.ts` | 17, 1125, 1142, 1169 | Extra whitespace lines | Remove |
| sequence | `dto/generate-formatted-sequence.dto.ts` | 51 | Missing space: `code2,code3` | `code2, code3` |
| ui-setting | Multiple spec files | Multiple | `isShowedOnList` | `isShownOnList` |

---

## Summary by Priority

### High Priority (Breaking Changes)
| Count | Description |
|-------|-------------|
| 6 | Public API / Export names affected |

### Medium Priority (User-Visible)
| Count | Description |
|-------|-------------|
| 7 | Error messages with grammar issues |

### Low Priority (Internal)
| Count | Description |
|-------|-------------|
| 1 | Internal variable/method names |
| 12+ | Comments and documentation |
| 25+ | Test files only |

---

## Detailed Error Message Issues (command.service.ts)

The following error messages have grammar problems:

### Line 133
```
Current:  "The input is not a valid, item not found or version not match"
Suggested: "Invalid input: item not found or version mismatch"
```

### Lines 163, 197, 335
```
Current:  "The input key is not a valid, item not found"
Suggested: "Invalid input key: item not found"
```

---

## Recommended Action

### For Breaking Changes:
1. Create deprecation warnings for old names
2. Support both old and new names temporarily
3. Remove old names in next major version

### For Error Messages:
1. Fix grammar to improve user experience
2. Can be done in minor/patch version

### For Internal/Test:
1. Fix immediately - no user impact

---

## Full Count

| Category | Count |
|----------|-------|
| External Impact (Breaking) | 6 |
| Internal - Error Messages | 7 |
| Internal - Variable/Method Names | 1 |
| Internal - Comments/Docs | 12+ |
| Internal - Test Files | 25+ |
| **Total** | **50+** |

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

---

## Eighth Check Results (New Findings)

### Master Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `dto/master-setting/common-setting-create.dto.ts` | 10 | Example: `' User List Setting'` | `'User List Setting'` | Leading space |
| `dto/master-setting/tenant-setting-create.dto.ts` | 10 | Example: `' User List Setting'` | `'User List Setting'` | Leading space |
| `dto/master-setting/group-setting-create.dto.ts` | 10 | Example: `' User List Setting'` | `'User List Setting'` | Leading space |
| `dto/master-setting/user-setting-create.dto.ts` | 10 | Example: `' User List Setting'` | `'User List Setting'` | Leading space |

### Sequence Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `sequences.service.spec.ts` | 1075 | Double space after `date,` | Single space | Formatting |

---

## Sixth Check Results

**Note**: The 6th check primarily confirmed issues already found in previous passes. No new issues were found. Most patterns (ie/ei words, -ment endings, doubled letters, tech terms) are correctly spelled throughout the codebase.

The `tenant_code: tenantCode` notation in task entity comments is intentional - it documents the mapping between DynamoDB attribute names (snake_case) and TypeScript property names (camelCase).

---

## Fifth Check Results (New Findings)

### Core Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `app.module.ts` | 53 | `allowUnknow` | `allowUnknown` | Missing letter |

### CLI Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `actions/ui.action.ts` | 27 | `Please choose correct component` | `Please choose the correct component` | Missing article |
| `commands/ui.command.ts` | 9 | `add mbc-cqrs-ui-common` | `Add mbc-cqrs-ui-common` | Capitalization |

### Master Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `handler/master-sfn-task.handler.ts` | 181, 202 | `is exist` | `exists` | Grammar |

### Tenant Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `services/tenant.service.ts` | 54, 85, 307 | `Tenant already exist` | `Tenant already exists` | Grammar (verb agreement) |
| `dto/tenant-group-update.dto.ts` | 14-21 | `settingGroups` has wrong type/description | Fix type and description | DTO mismatch |
| `dto/tenant-group-add.dto.ts` | 6, 21 | Description doesn't match field | Match field names | Documentation |

---

## Fourth Check Results (New Findings)

### Core Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `bootstrap.ts` | 54 | `swager` | `swagger` | Spelling |
| `bootstrap.ts` | 138 | `bootstraping` | `bootstrapping` | Spelling |
| `events/event-bus.ts` | 36 | `binded` (in comment) | `bound` | Grammar |

### CLI Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `schematics/schematic.colection.ts` | 29 | `a entity` | `an entity` | Grammar |
| `schematics/schematic.colection.ts` | 34 | `a dto` | `a DTO` | Capitalization |
| `runners/abstract.runner.ts` | 49 | `will be ran` | `will be run` | Grammar |
| `actions/new.action.ts` | 120 | `curVersion` | `currentVersion` | Abbreviation |
| `actions/new.action.ts` | 132 | `fname` | `filePath` | Abbreviation |
| `actions/new.action.ts` | 133 | `tplPackageJson` | `templatePackageJson` | Abbreviation |

### Master Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `interfaces/master-setting.interface.ts` | 24 | `the setting s data entity` | `the setting's data entity` | Grammar/Punctuation |

### Sequence Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `sequence-master-factory.ts` | 11 | Missing `@` before `Injectable()` | `@Injectable()` | Syntax |
| `sequences.service.ts` | 51, 53, 100, 102, 111 | `e.x` | `e.g.` | Abbreviation |
| `sequences.service.ts` | 100 | `code5rotateValue` (missing separator) | `code5#rotateValue` | Documentation |

### Task Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `event/task.queue.event.handler.ts` | 100 | `attr` in log | `attributes` | Abbreviation |
| `event/task.queue.event.handler.ts` | 129 | `sfn Exec Name` | `SFN execution name` | Capitalization |
| `task.service.ts` | 154 | Method `getAllSubTask` | `getAllSubTasks` | Naming |

### Tenant Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `controllers/tenant.controller.spec.ts` | 11, 14 | Documentation says `PUT` | `PATCH` | Documentation |
| Multiple DTOs | Multiple | Trailing spaces in descriptions | Remove | Formatting |
| `services/tenant.service.ts` | 173-193, 264-265 | `setting_groups` (snake_case) | `settingGroups` | Naming Convention |
| `interfaces/tenant.service.interface.ts` | 21, 29, 41, 55, 67, 79 | `tenant code` | `tenant` | Documentation |

### UI-Setting Package

| File | Line | Issue | Correct | Type |
|------|------|-------|---------|------|
| `services/setting.service.ts` | 69, 120 | `must not duplicate` | `must not be duplicated` | Grammar |
| `services/setting.service.ts` | 78 | `== false` (loose equality) | `=== false` | Code Quality |
| `services/data-setting.service.ts` | 86 | `== false` (loose equality) | `=== false` | Code Quality |

---

## Updated Summary by Priority (after 5th Check)

### High Priority (Breaking Changes)
| Count | Description |
|-------|-------------|
| 6 | Public API / Export names affected |

### Medium Priority (User-Visible)
| Count | Description |
|-------|-------------|
| 10 | Error messages with grammar issues |
| 2 | Log messages with unclear abbreviations |

### Low Priority (Internal)
| Count | Description |
|-------|-------------|
| 6 | Spelling errors (swager, bootstraping, binded, allowUnknow, etc.) |
| 12 | Grammar issues (article errors, verb forms, "is exist", "Tenant already exist") |
| 6 | Abbreviation issues (curVersion, fname, e.x, etc.) |
| 1 | Syntax issue (missing @) |
| 2 | Code quality (loose equality) |
| 9 | Documentation/DTO mismatches |
| 10+ | Trailing spaces and formatting |
| 25+ | Test files only |

---

## Full Count (Updated after 8th Check)

| Category | Count |
|----------|-------|
| **Configuration (Environment Variables)** | **6** |
| External Impact (Breaking) - Code | 6 |
| Internal - Error Messages | 10 |
| Internal - Log Messages | 2 |
| Internal - Spelling/Missing Letters | 6 |
| Internal - Grammar | 12 |
| Internal - Abbreviations | 6 |
| Internal - Syntax | 1 |
| Internal - Code Quality | 2 |
| Internal - Documentation/DTO Mismatch | 9 |
| Internal - Formatting (spaces, etc.) | 20+ |
| Internal - Test Files | 25+ |
| **Total** | **100+** |

---

## Verification Complete

After 6 comprehensive checks with different focus patterns, the codebase has been thoroughly reviewed. The following pattern categories were verified as correctly spelled:
- ie/ei words (retrieve, receive, achieve, believe)
- Words ending in -ment (environment, development, management)
- Words ending in -ness (business, awareness)
- Silent letter words (knowledge, acknowledge)
- Doubled letter words (occurred, referred, transferred)
- Tech terms (synchronous, asynchronous, parameter)
- Prefix patterns (un-, in-, im-)
