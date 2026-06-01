# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.3.1](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.3.1) (2026-06-01)

### Features

- **core:** Add group-based role authorization
  - `RolesGuard` now checks direct roles from JWT `custom:roles` first, then roles derived from the user's groups in the new `custom:groups` claim (tenant-scoped)
  - Add `@GroupRoleResolver()` decorator and `IGroupRoleResolver` interface — implement exactly one resolver per app to map group IDs to roles (loaded from DynamoDB/RDS/config); the mapping is not stored in the JWT
  - `UserContext` gains `tenantRoles` (direct roles array) and `tenantGroupIds` (group IDs for the active tenant); `tenantRole` (singular) is kept for backward compatibility
  - Opt-in: existing `@Roles()` checks keep working with no code changes

### Bug Fixes

- **core:** Tolerate a malformed `custom:groups` claim (fail-closed to no group roles) instead of throwing, so a bad token degrades to direct-role-only checks rather than crashing the request

## [1.3.0](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.3.0) (2026-05-21)

### Features

- **core:** Add AppSync Events API support (opt-in, no breaking changes)
  - Introduce `@NotificationTransport('transport-name')` decorator and refactor `NotificationModule` for transport flexibility
  - Activate transports via the `NOTIFICATION_TRANSPORTS` environment variable (e.g. `appsync-graphql,appsync-event`)
  - Add `AppSyncService` initialization, environment variable validation, and a sample AppSync event client
- **cli:** Enhance AppSync Events API integration

## [1.2.6](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.2.6) (2026-05-06)

### Features

- **core:** Optimize Repository read-your-writes (RYW) session handling with version checks and session deletion logic (transparent; no code changes required)

## [1.2.5](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.2.5) (2026-04-10)

### Features

- **import:** Enhance ZIP import functionality and validation

### Refactors

- **import:** Remove `ZipImportQueueEventHandler` and streamline import processing

## [1.2.4](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.2.4) (2026-04-09)

### Breaking Changes

- **master:** `TaskModule.register()` must be called exactly once in the host `AppModule`
  - Duplicate registrations across feature modules cause `"transformTask is not a function"` at runtime
  - **Migration:** Remove `TaskModule.register()` from feature modules and register it only in `AppModule`

### Features

- **core:** Implement SQS client and service for message handling; make `QueueModule` global with SQS support

### Bug Fixes

- **core:** Handle malformed JWT tokens gracefully in `extractInvokeContext`
- **import:** Refine single import routing, error handling, and parent job counters in the import queue/Step Functions handlers

## [1.2.3](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.2.3) (2026-04-08)

### Bug Fixes

- **import:** Refine SingleImportProcessor routing and error handling in ImportQueueEventHandler
- **import:** Use `event.importEvent` instead of `event.payload` for single import processing
- **import:** Improve error handling in CsvBatchProcessor and ImportQueueEventHandler

## [1.2.2](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.2.2) (2026-04-08)

### Bug Fixes

- **import:** Fix Head-of-Line Blocking (Poison Pill) in `CsvBatchProcessor` by implementing Smart Retry pattern ([PR #394](https://github.com/mbc-net/mbc-cqrs-serverless/pull/394))
  - Previously, a persistent validation error on the first row caused the entire batch to crash immediately
  - Now, each row is processed independently; errors are collected and a single aggregated error is thrown after the full batch is processed
  - Valid rows are saved successfully; failed rows trigger SQS retry; already-succeeded rows are skipped on retry via EQUAL comparison (idempotency maintained)
- **import:** Fix `ImportQueueEventHandler` passing raw SQS payload instead of parsed `importEvent` to `SingleImportProcessor` ([PR #394](https://github.com/mbc-net/mbc-cqrs-serverless/pull/394))
  - `singleImportProcessor.process()` now receives `event.importEvent` (parsed, rich object) instead of `event.payload` (raw SQS payload)

## [1.2.1](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.2.1) (2026-04-06)

### Features

- **core:** Add `SqsService` and `SqsClientFactory` for SQS message operations ([PR #383](https://github.com/mbc-net/mbc-cqrs-serverless/pull/383))
  - `sendMessage()` — send a single message to an SQS queue
  - `sendMessageBatch()` — send up to 10 messages in a single API call
  - `receiveMessages()` — receive messages with configurable `MaxNumberOfMessages` (default: 10) and `WaitTimeSeconds` (default: 0)
  - `deleteMessage()` — acknowledge and delete a single processed message
  - `deleteMessageBatch()` — delete up to 10 messages in a single API call
  - `SqsService` is registered in `QueueModule` (global) and injectable across the application
  - Supports `MessageSystemAttributeNames` for receiving system attributes (deprecated `AttributeNames` not exposed)
- **core:** Refactor `SnsClientFactory` to use a singleton `SNSClient` instance ([PR #383](https://github.com/mbc-net/mbc-cqrs-serverless/pull/383))
  - Previously cached a separate client per topic ARN; now a single instance is shared across all publish calls
  - `getClient()` signature changed from `getClient(topicArn: string)` to `getClient()`

## [1.2.0](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.2.0) (2026-04-02)

### Breaking Changes

- **core:** `CommandService.publishSync()` and `publishPartialUpdateSync()` now return `Promise<CommandModel | null>` (previously `Promise<CommandModel>`)
  - Returns `null` when the command is not dirty (no-op), matching `publishAsync()` / `publishPartialUpdateAsync()`
  - **Migration:** Callers must null-check the result before accessing fields such as `pk` or `version`
- **sequence:** Remove deprecated `SequencesService.genNewSequence()` method
  - Use `generateSequenceItem()` or `generateSequenceItemWithProvideSetting()` instead

### Features

- **core:** Implement read-your-writes (RYW) session management for async command publishing
  - The same user's subsequent reads return pending command data before the DynamoDB Stream sync completes
  - Add DynamoDB session table configuration; enable via the `RYW_SESSION_TTL_MINUTES` environment variable
  - Introduce `CommandSyncMode` enum and `SessionService` to encapsulate the RYW session policy
- **import:** Enhance CSV import processing with a new state-machine definition, publish-mode configuration, and improved result/error handling

## [1.1.6](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.1.6) (2026-03-30)

### Bug Fixes

- **import:** Correct import status handling for ZIP orchestrator ([#371](https://github.com/mbc-net/mbc-cqrs-serverless/pull/371))

## [1.1.5](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.1.5) (2026-03-28)

### Features

- **import:** Implement v2 batch processing architecture for high-throughput CSV imports ([PR #366](https://github.com/mbc-net/mbc-cqrs-serverless/pull/366))
  - Replace per-row `import_tmp` writes with direct in-Lambda command publishing, eliminating Hot Partition bottlenecks
  - Distributed Map now configured with `MaxItemsPerBatch: 100` and `MaxConcurrency: 50` for significantly higher throughput
  - New `finalize_parent_job` state aggregates batch summaries and writes final job status in a single DynamoDB `UpdateItem` call
  - Remove per-row atomic counter updates from `CommandFinishedHandler`, eliminating DynamoDB throttling at scale
  - Add `ImportPublishMode` enum (`SYNC` / `ASYNC`) to `ImportEntityProfile` for per-entity publish mode configuration
  - Add empty `processingResults` guard: job is marked `FAILED` if no batch results are received

### Breaking Changes

- **import:** CSV import no longer provides real-time row-level progress tracking
  - `processedRows`, `succeededRows`, `failedRows` counters are now aggregated once when Step Functions execution completes
  - Individual CSV rows are no longer written to the `import_tmp` DynamoDB table
  - The `import-csv` state machine requires a new `finalize_parent_job` state and `resultPath: '$.processingResults'` — CDK and `serverless.yml` must be updated together with this package

### Tests

- Add SYNC/ASYNC routing tests for `ImportQueueEventHandler` (6 test cases covering EQUAL/NOT_EXIST/CHANGED × SYNC/ASYNC + fallback)
- Add empty `processingResults` guard test for `CsvImportSfnEventHandler`
- Add batch aggregation tests (1,000 + 500 rows, COMPLETED and FAILED scenarios)

## [1.1.4](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.1.4) (2026-03-27)

### Features

- **core:** Restore audit trail and history parity for `publishSync` ([PR #363](https://github.com/mbc-net/mbc-cqrs-serverless/pull/363))
  - `publishSync` now writes an immutable event to the Command table with `status: 'publish_sync:STARTED'` and `syncMode: 'SYNC'`
  - History table is now populated by `publishSync`, matching the async Step Functions pipeline
  - Command lifecycle follows `publish_sync:STARTED` → `finish:FINISHED` (or `publish_sync:FAILED` on error)
  - Ported `isNotCommandDirty` early-return optimization from `publishAsync` — returns `null` when no changes detected
  - DynamoDB Stream filter updated to exclude `syncMode=SYNC` records, preventing Step Functions double-execution
  - `DefaultEventFactory` also filters `syncMode=SYNC` records for local development environments

### Tests

- Add comprehensive tests for `publishSync` audit trail and history parity

## [1.1.3](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.1.3) (2026-03-24)

### Bug Fixes

- **import:** Fix CSV import Distributed Map state result exceeding 256KB limit ([PR #348](https://github.com/mbc-net/mbc-cqrs-serverless/pull/348))
  - Set `resultPath: DISCARD` on Distributed Map to prevent child execution results from being aggregated into state data
  - Remove `MapResult` dependency from `CsvImportSfnEventHandler`, use `countCsvRows()` from S3 instead
  - Add error handling for cases where the S3 stream is not readable

### CI/CD

- Switch to npm OIDC trusted publishing, removing dependency on `NPM_TOKEN` secret ([PR #357](https://github.com/mbc-net/mbc-cqrs-serverless/pull/357))
  - Upgrade lerna from v8 to v9 for built-in OIDC support
  - Add `id-token: write` permission to publish job
  - Add lockfile sync step for Node 22+ compatibility

### Tests

- Add comprehensive tests for `CsvImportSfnEventHandler` finalize_parent_job logic
  - Test FAILED status when failedRows > 0
  - Test COMPLETED status when all rows succeed
  - Test no status update when processing is incomplete
  - Test error handling when S3 stream is not readable

## [1.1.2](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.1.2) (2026-02-25)

### Features

- **master:** Add built-in upsert methods for master settings and data
  - `upsertTenantSetting()`, `upsertSetting()`, `upsertBulk()` for MasterSettingService
  - `upsert()`, `upsertSetting()`, `upsertBulk()` for MasterDataService
  - Automatically creates new records, updates changed records, and skips unchanged records
  - Supports recreating soft-deleted records
- **master:** Add unified bulk upsert API (`/api/master-bulk/`)
  - Single endpoint that handles both settings and data items
  - Items routed by presence of `settingCode` field
  - Preserves original input order in response
  - Tenant code validation enforced
- **master:** Add `@ArrayMaxSize(100)` validation to all bulk DTOs
- **master:** Add tenant code validation to individual bulk endpoints (`/api/master-setting/bulk`, `/api/master-data/bulk`)

### Bug Fixes

- **core:** Fix `checkVersion` error message using hardcoded value instead of actual `commandVersion` ([PR #331](https://github.com/mbc-net/mbc-cqrs-serverless/pull/331))
- **master:** Fix `seq === 0` being treated as falsy in `createSetting` by changing to null check (`seq == null`)
- **master:** Fix DTO mutation in `createSetting` by cloning attributes before modifying seq

### Tests

- Add comprehensive unit tests for MasterBulkController (8 test cases)
- Add unit tests for MasterDataService upsert and upsertBulk methods
- Add unit tests for MasterSettingService upsertTenantSetting and upsertBulk methods
- Add integration tests for master data and setting upsert scenarios

## [1.1.1](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.1.1) (2026-02-07)

### Bug Fixes

- **cli:** Add missing `import_tmp.json` DynamoDB table template ([PR #323](https://github.com/mbc-net/mbc-cqrs-serverless/pull/323))
  - The `import_tmp` table definition was missing from CLI templates, causing `npm run offline:sls` to fail
  - The `serverless.yml` references `LOCAL_DDB_IMPORT_TMP_STREAM` environment variable, which requires the table to be created during migration
  - See [Common Issues](/docs/common-issues#missing-import-tmp-table) for workaround if using older versions

## [1.1.0](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.1.0) - TBD

### Breaking Changes

- **tenant:** Change `TENANT_COMMON` enum value from `'COMMON'` to `'common'` (lowercase)
  - This change affects partition key format: `TENANT#COMMON` → `TENANT#common`
  - **Migration required:** Existing data with `TENANT#COMMON` partition keys needs to be migrated
  - See [Migration Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/migration/v1.1.0) for detailed instructions
- **core:** Remove deprecated `CommandService.publish()` method
  - Use `publishAsync()` instead
- **core:** Remove deprecated `CommandService.publishPartialUpdate()` method
  - Use `publishPartialUpdateAsync()` instead
- **core:** `CommandService.publishSync()` and `publishPartialUpdateSync()` now return `Promise<CommandModel | null>` (previously `Promise<CommandModel>`)
  - Returns `null` when the command is not dirty (no-op), matching `publishAsync()` / `publishPartialUpdateAsync()`
  - **Migration:** Callers must handle `null` before using the result (e.g. `if (result) { ... }` or early return)
- **sequence:** Remove deprecated `SequencesService.genNewSequence()` method
  - Use `generateSequenceItem()` or `generateSequenceItemWithProvideSetting()` instead

### Features

- **core:** Add tenant code normalization for case-insensitive matching
  - Tenant codes are now automatically normalized to lowercase
  - `getUserContext()` returns normalized tenant code
  - All DynamoDB operations use normalized tenant codes for consistency
- **core:** Add `normalizeTenantCode()` utility function for explicit normalization
- **core:** Add `isCommonTenant()` utility function for common tenant detection

### Bug Fixes

- **master:** Fix `TENANT_COMMON` constant usage in MasterSettingService and MasterDataService
  - Previously hardcoded `'COMMON'` strings are now using `SettingTypeEnum.TENANT_COMMON`
  - Ensures consistent partition key generation across the framework

### Tests

- **tenant:** Add comprehensive tests for TenantService methods
  - `getTenant()`: Retrieval tests
  - `updateTenant()`: Update and attribute merge tests
  - `deleteTenant()`: Soft delete tests
  - `addTenantGroup()`: Group management tests
  - `customizeSettingGroups()`: Setting customization tests
  - `createTenantGroup()`: Tenant group creation tests
- **tenant:** Add SettingTypeEnum validation tests
  - Verify `TENANT_COMMON = 'common'` (lowercase)
  - Ensure enum completeness and consistency
- **core:** Add tenant code normalization tests (70+ test cases)
- **core:** Add tenant normalization command tests (30+ test cases)

### Documentation

- Add migration guide for v1.1.0 tenant code changes

## [1.0.26](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.26) (2026-01-26)

### Features

- **cli:** Add configurable local service ports via environment variables ([PR #300](https://github.com/mbc-net/mbc-cqrs-serverless/pull/300))
  - Support for `LOCAL_HTTP_PORT`, `LOCAL_DYNAMODB_PORT`, `LOCAL_RDS_PORT`, and other port variables
  - Allows users to resolve port conflicts with other services
  - Configuration is automatically applied to Docker Compose, Serverless Offline, and trigger scripts

### Security

- Update `diff` package from 4.0.2 to 4.0.4 for security fix ([PR #297](https://github.com/mbc-net/mbc-cqrs-serverless/pull/297), [PR #299](https://github.com/mbc-net/mbc-cqrs-serverless/pull/299))
- Update `lodash` package from 4.17.21 to 4.17.23 for prototype pollution fix ([PR #298](https://github.com/mbc-net/mbc-cqrs-serverless/pull/298))

## [1.0.25](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.25) (2026-01-19)

### Features

- **core:** Enhanced inline template email with advanced variable substitution
  - Support for nested property access in template variables (e.g., user.profile.name in double-brace placeholders)
  - Support for Unicode/Japanese keys in template variables
  - Whitespace trimming inside placeholders so spaces around the variable name are ignored
  - Improved local development fallback for template compilation

## [1.0.24](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.24) (2026-01-17)

### Features

- **mcp-server:** Add Claude Code Skills for guided development assistance
  - `/mbc-generate`: Generate boilerplate code (modules, services, controllers, DTOs, handlers)
  - `/mbc-review`: Review code for best practices and anti-patterns (20 patterns)
  - `/mbc-migrate`: Guide version migrations and breaking changes
  - `/mbc-debug`: Debug and troubleshoot common issues
  - Skills are distributed via npm package and can be installed to `~/.claude/skills/` or `.claude/skills/`
- **cli:** Add `mbc install-skills` command for easy skills installation
  - Install skills to personal directory (`~/.claude/skills/`) or project directory (`.claude/skills/`)
  - Options: `--project`, `--force`, `--list`

### Bug Fixes

- **core:** Fix typo in parameter name `skExpession` to `skExpression`
  - Affected packages: core, directory, master, task, ui-setting
  - This was a breaking change for TypeScript users who referenced the old parameter name

## [1.0.23](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.23) (2026-01-16)

### Features

- **core:** Add inline template email support with `sendInlineTemplateEmail()` method
  - New `sendInlineTemplateEmail(msg: TemplatedEmailNotification)` method in EmailService
  - Support for inline HTML/text templates with dynamic data substitution
  - Local development fallback with manual template compilation when SES is unavailable
  - New interfaces: `InlineTemplateContent`, `TemplatedEmailNotification`

## [1.0.22](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.22) (2026-01-16)

### Features

- **mcp-server:** Add code analysis tools for AI-assisted development
  - `mbc_check_anti_patterns`: Detect common anti-patterns in code with severity levels
  - `mbc_health_check`: Project health check (dependencies, structure, configuration)
  - `mbc_explain_code`: Analyze and explain code in MBC CQRS context

### Bug Fixes

- **mcp-server:** Improve code analysis tools robustness
  - Renumber anti-patterns sequentially (AP001-AP010)
  - Limit regex match range to prevent false positives
  - Add error handling for file reading and JSON parsing
  - Add 18 unit tests for analyze tools

### Security

- Fix security vulnerabilities in dependencies: qs, express, body-parser

### Dependencies

- Bump qs from 6.13.0 to 6.14.1
- Bump @nestjs/platform-express from 10.4.20 to 10.4.22
- Bump express from 4.21.2 to 4.22.1
- Bump body-parser from 1.20.3 to 1.20.4

## [1.0.21](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.21) (2026-01-15)

### Features

- **import:** Add ZIP finalization hooks support to ImportModule
  - New `IZipFinalizationHook` interface for custom post-import processing
  - Register hooks via `zipFinalizationHooks` option in `ImportModule.register()`
  - Hooks receive `ZipFinalizationContext` with results, status, and execution input

## [1.0.20](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.20)

### Bug Fixes

- **import:** Fix Step Functions CSV handler always setting COMPLETED status regardless of child job failures
  - Fixed `CsvImportSfnEventHandler.finalizeParentJob()` to correctly set status to FAILED when any child job fails
  - Fixed `CsvImportSfnEventHandler` in `csv_loader` state to correctly set status to FAILED when early finalization occurs with failures
  - Previously, the ternary operator was incorrectly returning COMPLETED for both true and false cases: `failedRows > 0 ? COMPLETED : COMPLETED`
  - Now correctly returns FAILED when failedRows > 0: `failedRows > 0 ? FAILED : COMPLETED`
  - This bug caused Step Functions to report SUCCESS even when child import jobs failed with errors like `ConditionalCheckFailedException`
  - Added comprehensive unit tests for CsvImportSfnEventHandler (5 tests)

## [1.0.19](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.19) (2026-01-11)

### Bug Fixes

- **import:** Fix master job status not updating to FAILED when child import jobs fail
  - Previously, when a child import job failed with errors like `ConditionalCheckFailedException`, the master job status remained `PROCESSING` indefinitely
  - Fixed `incrementParentJobCounters` to correctly set master job status to `FAILED` when any child job fails (was always setting to `COMPLETED`)
  - Fixed `ImportQueueEventHandler.handleImport` to call `incrementParentJobCounters` on error, ensuring parent counters are updated
  - Removed `throw error` in error handler to prevent Lambda crashes and allow proper status propagation
  - This fix completes the Step Functions error handling started in v1.0.18, ensuring `SendTaskFailure` is properly triggered
  - See [ImportQueueEventHandler Error Handling](/docs/import-export-patterns#import-error-handling) for details

## [1.0.18](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.18)

### Bug Fixes

- **import:** add SendTaskFailure support to ImportStatusHandler for proper Step Functions error handling ([#275](https://github.com/mbc-net/mbc-cqrs-serverless/pull/275))
  - Previously, when an import job failed, the Step Function would wait indefinitely because only SendTaskSuccess was implemented
  - Now the handler properly sends SendTaskFailure when a job fails, allowing Step Functions to handle errors correctly
  - Added `sendTaskFailure()` method to send `SendTaskFailureCommand`
  - Handler now processes both `COMPLETED` and `FAILED` statuses for CSV import jobs
  - Added comprehensive unit tests for the ImportStatusHandler (16 tests)

## [1.0.17](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.17) (2026-01-08)

### Bug Fixes

- **master:** Fix `masterTypeCode` comparison in `MasterDataService.search()` - Changed from partial match (`contains`) to exact match for `settingCode` search parameter
- **cli:** Stabilize AbstractRunner tests by removing setTimeout to fix flaky CI failures

### Security

- Fix security vulnerabilities in dependencies: jws (HMAC signature verification issue), nodemailer (DoS vulnerability)

### Dependencies

- Bump validator from 13.15.20 to 13.15.26
- Bump @modelcontextprotocol/sdk from 1.25.1 to 1.25.2

### Documentation

- Update README files for all packages with comprehensive API references and usage examples
- Fix `createTenantGroup` parameter name in tenant package README
- Update Japanese guide links to official documentation

## [1.0.16](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.16) (2025-12-31)

### Bug Fixes

- **cli:** Add cleanup for test-generated files and update .gitignore
- **master, directory, task, cli:** Improve error messages for better clarity

### Features

- Include __s3Key in attributes for import creation
- Zip mode provide table name
- Add optional s3Key to CreateImportDto

## [1.0.15](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.15) (2025-12-31)

### Bug Fixes

- **ui-setting:** Improve error messages for better clarity
- **mcp-server:** Use MBC_PROJECT_PATH for ERROR_CATALOG.md lookup

## [1.0.14](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.14) (2025-12-29)

### Features

- **mcp-server:** Add MCP server package for AI tool integration

### Documentation

- Add comprehensive error message catalog
- Add JSDoc comments to core interfaces
- Add operational documentation (FAQ, troubleshooting, security)
- Add AI-friendly documentation files

## [1.0.13](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.13) (2025-12-26)

### Features

- Enhance CreateZipImportDto and ZipImportQueueEventHandler

## [1.0.12](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.12) (2025-12-23)

### Bug Fixes

- Merge tenant attributes in TenantService

## [1.0.11](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.11) (2025-12-22)

### Bug Fixes

- Handle unknown source IP in SequencesService

## [1.0.10](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.10) (2025-11-28)

### Bug Fixes

- Fix createTenantGroup method in TenantService

## [1.0.9](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.9) (2025-11-26)

### Bug Fixes

- Remove callback parameter from Lambda handler for Node.js 24 compatibility

## [1.0.8](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.8) (2025-11-17)

### Security

- Bump jws dependency for security fix

## [1.0.7](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.7) (2025-11-07)

### Security

- Bump validator dependency in examples
- Bump js-yaml dependency for security fix

## [1.0.6](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.6) (2025-11-05)

### Features

- **master:** Add tenantCode support to MasterDataCreateDto and update service logic

## [1.0.5](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.5) (2025-11-04)

### Features

- **master:** Enhance master settings with tenantCode support in DTOs and service logic

## [1.0.4](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.4) (2025-10-29)

### Features

- **core:** Add configurable request body size limit to bootstrap and environment validation
- **master:** Add bulk creation endpoints for master data and settings

### Dependencies

- Bump validator from 13.11.0/13.12.0 to 13.15.20
- Bump multer from 1.4.4-lts.1 to 2.0.2 and @nestjs/platform-express from 10.4.4 to 10.4.20
- Bump axios from 1.7.7 to 1.13.1 in CLI templates

## [1.0.3](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.3) (2025-10-23)

### Features

- **master:** Add bulk creation endpoints for master data and settings, enabling batch operations for improved efficiency

## [1.0.2](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.2) (2025-10-16)

### Features

- **survey:** Add survey template API for managing survey templates

### Dependencies

- Bump @nestjs/common from 10.3.0 to 10.4.16 in /examples/master
- Bump multer from 1.4.4-lts.1 to 2.0.2 and @nestjs/platform-express from 10.4.15 to 10.4.20 in /examples/seq
- Bump @nestjs/cli from 10.4.5 to 11.0.10 and inquirer from 8.2.6 to 8.2.7

## [1.0.1](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.1) (2025-09-19)

### Features

- **import:** Add zip mode support for import module, enabling compressed file imports

## [1.0.0](https://github.com/mbc-net/mbc-cqrs-serverless/releases/tag/v1.0.0) (2025-09-18)

### Highlights

- First stable production release
- Based on beta version 0.1.74

---

## Beta Releases (0.1.x)

## [0.1.75-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.74-beta.0...v0.1.75-beta.0)

### Bug Fixes

- **import:** Add `SendTaskFailure` support to `ImportStatusHandler` for proper Step Functions error handling
  - Previously, when an import job failed, the Step Function would wait indefinitely because only `SendTaskSuccess` was implemented
  - Now the handler properly sends `SendTaskFailure` when a job fails, allowing Step Functions to handle errors correctly
  - Added `sendTaskFailure()` method to send `SendTaskFailureCommand`
  - Handler now processes both `COMPLETED` and `FAILED` statuses for CSV import jobs

## [0.1.74-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.73-beta.0...v0.1.74-beta.0) (2025-08-25)

### Features

- import module ([152115d](https://github.com/mbc-net/mbc-cqrs-serverless/commit/152115d7474bfd0a1cba5feb3d83110be87f486e))
- update infra for import module ([d2f609d](https://github.com/mbc-net/mbc-cqrs-serverless/commit/d2f609d2b4dea9a0265310461617a8a9d46d5d15))
- update infra local for import module ([9c52603](https://github.com/mbc-net/mbc-cqrs-serverless/commit/9c526035bf630a708329539832a80739cda1ed85))

## [0.1.73-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.72-beta.0...v0.1.73-beta.0) (2025-07-31)

### Bug Fixes

- **master:** install package ([288d779](https://github.com/mbc-net/mbc-cqrs-serverless/commit/288d779cc1a6bb5ea150d4388ad82221c4d24108))

## [0.1.72-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.71-beta.0...v0.1.72-beta.0) (2025-07-24)

### Features

- add case-insensitive search for master data and settings ([ee6b965](https://github.com/mbc-net/mbc-cqrs-serverless/commit/ee6b9657fa37cc251212e517c61cda4f7ee0be83))

## [0.1.71-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.70-beta.0...v0.1.71-beta.0) (2025-07-18)

### Bug Fixes

- Core package test failures blocking CI ([1e02300](https://github.com/mbc-net/mbc-cqrs-serverless/commit/1e02300de5a98743f240e0d157200094151ca033))
- github workflow ([2cd9d44](https://github.com/mbc-net/mbc-cqrs-serverless/commit/2cd9d44178f19c2c5d7b3f53e512723e99ffca8c))
- handle step function name limit ([762ab9a](https://github.com/mbc-net/mbc-cqrs-serverless/commit/762ab9aa27baba62c1e8f5e3da8e19d2b32e8f46))
- StepFunctionService execution name length validation ([86291ea](https://github.com/mbc-net/mbc-cqrs-serverless/commit/86291ea9defc1edad7b0439d4e34fbf378ea630e))
- Fix 80-character limit bug in StepFunctionService tests ([cf188ae](https://github.com/mbc-net/mbc-cqrs-serverless/commit/cf188ae8aa07824134d0e6e8c17400e64f9cede3))

### Features

- CLI package comprehensive test enhancement ([edd8426](https://github.com/mbc-net/mbc-cqrs-serverless/commit/edd842662d90f5c1609cde332456489cd6f80062))
- Enhance unit tests for Core package services ([a4d318e](https://github.com/mbc-net/mbc-cqrs-serverless/commit/a4d318ebd1aa5d01861c21ec2acfa0e8fa8cf8c9))
- implement comprehensive unit tests for controllers ([9bef4b0](https://github.com/mbc-net/mbc-cqrs-serverless/commit/9bef4b02a93aae016655f6393836a0b519f33c8e))
- Enhance unit tests for Master package services ([90ca8a9](https://github.com/mbc-net/mbc-cqrs-serverless/commit/90ca8a9365a75b869118585c4cd6f84373b907bb))
- Enhance tests for Sequence service ([8eefb34](https://github.com/mbc-net/mbc-cqrs-serverless/commit/8eefb34ce829b15ecef04607b90faba7bd133571))
- Enhance unit tests for Task service ([3a71b92](https://github.com/mbc-net/mbc-cqrs-serverless/commit/3a71b92c4d46746a5e1a084042184f0d99c98814))
- Implement unit tests for missing services ([2f762ff](https://github.com/mbc-net/mbc-cqrs-serverless/commit/2f762ff93968c678ceec7f7eeaf78db7e74db797))
- Implement unit tests for high-priority packages ([1dc8494](https://github.com/mbc-net/mbc-cqrs-serverless/commit/1dc849452dafb4a628fa72fda32fe20af17316d5))

## [0.1.70-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.69-beta.0...v0.1.70-beta.0) (2025-07-14)

### Bug Fixes

- **master:** master-setting unit test ([c1d75af](https://github.com/mbc-net/mbc-cqrs-serverless/commit/c1d75af4ccb8438842be8ccfa244c288eefe36a1))
- update package version ([fe43ed7](https://github.com/mbc-net/mbc-cqrs-serverless/commit/fe43ed7ad68f6142f830d19e1d7e92ac9ad41f20))
- update package version ([4d1aa9a](https://github.com/mbc-net/mbc-cqrs-serverless/commit/4d1aa9ad7af95b709d6d4f4efc104b8391ac76f5))

### Features

- **master:** add copy to tenant ([bd7036d](https://github.com/mbc-net/mbc-cqrs-serverless/commit/bd7036d851dc92569b343de1c39ccb03ad7d11b9))

## [0.1.69-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.68-beta.0...v0.1.69-beta.0) (2025-07-07)

### Bug Fixes

- **master:** update unit test ([c841a39](https://github.com/mbc-net/mbc-cqrs-serverless/commit/c841a39d7b2fa1bbc43ea5c218429e5c7a752767))

### Features

- **master:** add prisma option ([aab57e1](https://github.com/mbc-net/mbc-cqrs-serverless/commit/aab57e1407a4ee5305b69ab15e457bf555b42322))

## [0.1.68-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.67-beta.0...v0.1.68-beta.0) (2025-07-01)

### Bug Fixes

- build lib ci ([16dbe7c](https://github.com/mbc-net/mbc-cqrs-serverless/commit/16dbe7c0895cd17ef9e7f43ff29a4d53b811ad05))
- update import template master data module ([2159d85](https://github.com/mbc-net/mbc-cqrs-serverless/commit/2159d85f94ba190c4bfb7d21c4bba16406deb16b))

### Features

- add template master api ([501468b](https://github.com/mbc-net/mbc-cqrs-serverless/commit/501468b6f658a3fc672f490b2cd36ecda55e7a77))

## [0.1.67-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.66-beta.0...v0.1.67-beta.0) (2025-06-10)

### Features

- enhance EmailService to support attachments ([1795adb](https://github.com/mbc-net/mbc-cqrs-serverless/commit/1795adbd467130a4b44b96878da574af0e02396c))

## [0.1.66-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.65-beta.0...v0.1.66-beta.0) (2025-05-21)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.65-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.64-beta.0...v0.1.65-beta.0) (2025-05-19)

### Bug Fixes

- empty appsync url ([c413a64](https://github.com/mbc-net/mbc-cqrs-serverless/commit/c413a646235b8be7965dd65f9e3d423916fa0abe))
- test appsync url ([1e37d6d](https://github.com/mbc-net/mbc-cqrs-serverless/commit/1e37d6df1bbec685ac61da9d5c79a1c82713f346))

### Features

- add second appsync ([5336b33](https://github.com/mbc-net/mbc-cqrs-serverless/commit/5336b33a0d8108817899e34cf9eb655ddae471da))

## [0.1.64-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.63-beta.0...v0.1.64-beta.0) (2025-05-15)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.63-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.62-beta.0...v0.1.63-beta.0) (2025-05-12)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.62-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.61-beta.0...v0.1.62-beta.0) (2025-04-29)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.61-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.60-beta.0...v0.1.61-beta.0) (2025-04-29)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.60-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.59-beta.0...v0.1.60-beta.0) (2025-04-26)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.59-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.58-beta.0...v0.1.59-beta.0) (2025-04-25)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.58-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.57-beta.0...v0.1.58-beta.0) (2025-04-24)

### Bug Fixes

- get format sequence from master data item ([19ea7c6](https://github.com/mbc-net/mbc-cqrs-serverless/commit/19ea7c6137fcec83a8e3e24d016d640c75fecbb5))

## [0.1.57-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.56-beta.0...v0.1.57-beta.0) (2025-03-17)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.56-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.55-beta.0...v0.1.56-beta.0) (2025-03-17)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.55-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.54-beta.0...v0.1.55-beta.0) (2025-02-14)

### Features

- update template to use node 20 runtime ([edeaf00](https://github.com/mbc-net/mbc-cqrs-serverless/commit/edeaf00459db3a9e41b57cae8f8a0cda00540c80))

## [0.1.54-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.53-beta.0...v0.1.54-beta.0) (2025-02-13)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.53-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.52-beta.0...v0.1.53-beta.0) (2025-02-12)

### Features

- add queue and sfn for task ([5eb1ec9](https://github.com/mbc-net/mbc-cqrs-serverless/commit/5eb1ec978d3a6a87d6ad8d7cd6467fdc0200bc52))
- task processing by step function ([af7f43e](https://github.com/mbc-net/mbc-cqrs-serverless/commit/af7f43e64f791722aa847f4da90fcd7dcd526842))

## [0.1.52-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.51-beta.0...v0.1.52-beta.0) (2025-01-20)

**Note:** Version bump only for package mbc-cqrs-serverless

## [0.1.51-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.50-beta.0...v0.1.51-beta.0) (2025-01-17)

### Bug Fixes

- correct description text ([2a0c8bf](https://github.com/mbc-net/mbc-cqrs-serverless/commit/2a0c8bf5dd14d41f4853014ce934ebeb5cca2b52))

### Features

- add logger ([c8fdcc6](https://github.com/mbc-net/mbc-cqrs-serverless/commit/c8fdcc65f88407cb5b0d636200cc8713974a42f7))
- add schematic description ([0c7ffbd](https://github.com/mbc-net/mbc-cqrs-serverless/commit/0c7ffbdd9a287f471ac7020a7d485a3d04df2351))
- add schematic for generating controllers ([3dc7df2](https://github.com/mbc-net/mbc-cqrs-serverless/commit/3dc7df2f4a91b7cbfcfe7a18169a282d5fcccbe4))
- add schematic for generating dto, service, entity ([89df08d](https://github.com/mbc-net/mbc-cqrs-serverless/commit/89df08d71824c99071013b98c9fc4198d6a9dc6a))
- add schematic for generating module ([97cdc31](https://github.com/mbc-net/mbc-cqrs-serverless/commit/97cdc313265162411d84c3b3b1e2b858bd38d423))

## [0.1.50-beta.0](https://github.com/mbc-net/mbc-cqrs-serverless/compare/v0.1.49-beta.0...v0.1.50-beta.0) (2025-01-14)

### Bug Fixes

- Fix entity field handling in serialization helper ([89f2499](https://github.com/mbc-net/mbc-cqrs-serverless/commit/89f249917d515d646e23e796e4b58d87fb22b901))

### Features

- Add serialization helper functions — implement internal/external structure conversion helpers, add test cases, and add documentation ([56e7c1d](https://github.com/mbc-net/mbc-cqrs-serverless/commit/56e7c1d7b0ab8c808398e1895e0988d26de350d0))
