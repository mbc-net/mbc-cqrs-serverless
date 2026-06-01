---
name: mbc-migrate
description: Guide version migrations for MBC CQRS Serverless framework. Use this when upgrading framework versions, migrating from deprecated APIs, or understanding breaking changes between versions.
---

## Pre-flight Check (Version Update)

Before executing this skill, check for updates:

1. Run `mbc install-skills --check` to check if a newer version is available
2. If the output shows "Update available: X.Y.Z → A.B.C", ask the user:
   - "A newer version of MBC skills is available (X.Y.Z → A.B.C). Would you like to update before proceeding?"
3. If the user agrees, run `mbc install-skills --force` to update
4. If the user declines or skills are up-to-date, proceed with the skill

**Note**: Skip this check if the user explicitly says to skip updates or if you've already checked in this session.

---

# MBC CQRS Serverless Migration Guide

This skill helps migrate MBC CQRS Serverless projects between versions.

## Version Migration Matrix

| From Version | To Version | Migration Complexity | Key Changes |
|--------------|------------|---------------------|-------------|
| v1.0.16 | v1.0.17 | Low | MasterDataService.search() fix |
| v1.0.17 | v1.0.18 | Low | ImportStatusHandler.sendTaskFailure() |
| v1.0.18 | v1.0.19 | Low | ImportQueueEventHandler error handling |
| v1.0.19 | v1.0.20 | Low | CsvImportSfnEventHandler status fix |
| v1.0.20 | v1.0.21 | Medium | ZIP Finalization Hooks |
| v1.0.21 | v1.0.22 | Low | DynamoDB export filter fix |
| v1.0.22 | v1.0.23 | Low | sendInlineTemplateEmail() |
| v1.0.x | v1.1.0 | **High** | TENANT_COMMON → lowercase; publish() removed |
| v1.1.x | v1.1.4 | Low | publishSync audit trail (transparent) |
| v1.1.x | v1.1.5 | Medium | CSV import v2 batch architecture |
| v1.1.x | v1.2.0 | **High** | publishSync null return; genNewSequence() removed |
| v1.2.0 | v1.2.1 | Low | SqsService added (new feature) |
| v1.2.1 | v1.2.2 | Low | CsvBatchProcessor Poison Pill fix (transparent) |
| v1.2.x | v1.2.4 | Medium | TaskModule.register() must be in AppModule |
| v1.2.4 | v1.2.5 | Low | ZIP import refactor (transparent); MCP AP016–AP020 added |
| v1.2.5 | v1.2.6 | Low | Repository RYW improvements (transparent); `getVersion` API |
| v1.2.7 | v1.3.0 | Low | AppSync Events API support (opt-in, no breaking changes) |
| v1.3.0 | v1.3.1 | Low | Group-based roles (`@GroupRoleResolver`, `custom:groups`); `UserContext.tenantRoles`/`tenantGroupIds` added (opt-in, no breaking changes) |

## Migration Guides

### v1.0.16 → v1.0.17

**Breaking Change:** `MasterDataService.search()` settingCode behavior

**Before (v1.0.16):**
```typescript
// settingCode was incorrectly using partial match
const results = await masterDataService.search({
  settingCode: 'CONFIG', // Matched 'CONFIG', 'CONFIG_A', 'CONFIG_B'
});
```

**After (v1.0.17):**
```typescript
// settingCode now uses exact match
const results = await masterDataService.search({
  settingCode: 'CONFIG', // Only matches 'CONFIG' exactly
});
```

**Migration Steps:**
1. Review all `MasterDataService.search()` calls
2. If you relied on partial matching, update to explicit searches:
   ```typescript
   // If you need multiple settings
   const configs = await Promise.all([
     masterDataService.search({ settingCode: 'CONFIG_A' }),
     masterDataService.search({ settingCode: 'CONFIG_B' }),
   ]);
   ```

---

### v1.0.17 → v1.0.18

**New Feature:** `ImportStatusHandler.sendTaskFailure()`

**Addition:**
```typescript
// New method available for explicit failure signaling
await importStatusHandler.sendTaskFailure({
  taskToken: event.taskToken,
  error: 'ValidationError',
  cause: 'Invalid CSV format',
});
```

**Migration Steps:**
1. No breaking changes
2. Optional: Use `sendTaskFailure()` for better Step Functions integration

---

### v1.0.18 → v1.0.19

**Bug Fix:** `ImportQueueEventHandler` error handling

**Before (v1.0.18):**
- Parent job status not updated correctly on child failures

**After (v1.0.19):**
- Parent job status properly reflects child job failures

**Migration Steps:**
1. No code changes required
2. Verify existing import workflows work correctly

---

### v1.0.19 → v1.0.20

**Bug Fix:** `CsvImportSfnEventHandler` status determination

**Before (v1.0.19):**
- Incorrect status when all rows failed

**After (v1.0.20):**
- Correct `FAILURE` status when `processedRows === 0`

**Migration Steps:**
1. No code changes required
2. Review error handling in import workflows

---

### v1.0.20 → v1.0.21

**New Feature:** ZIP Finalization Hooks

**Addition:**
```typescript
// New interface for ZIP import finalization
interface IZipFinalizationHook {
  afterFinalize(context: ZipFinalizationContext): Promise<void>;
}

// Module registration
@Module({
  imports: [
    ImportModule.register({
      zipFinalizationHooks: [MyCustomFinalizationHook],
    }),
  ],
})
export class AppModule {}
```

**Migration Steps:**
1. No breaking changes
2. Optional: Implement custom finalization hooks for post-import processing

**Example Implementation:**
```typescript
@Injectable()
export class NotificationFinalizationHook implements IZipFinalizationHook {
  constructor(private readonly notificationService: NotificationService) {}

  async afterFinalize(context: ZipFinalizationContext): Promise<void> {
    const { results, status } = context;

    if (status === ImportStatusEnum.SUCCESS) {
      await this.notificationService.sendSuccess({
        message: `Import completed: ${results.processedRows} rows processed`,
      });
    } else {
      await this.notificationService.sendFailure({
        message: `Import failed: ${results.failedRows} rows failed`,
      });
    }
  }
}
```

---

### v1.0.21 → v1.0.22

**Bug Fix:** DynamoDB export S3 filter

**Before (v1.0.21):**
- Export filter not applied correctly

**After (v1.0.22):**
- S3 export filter works as expected

**Migration Steps:**
1. No code changes required

---

### v1.0.22 → v1.0.23

**New Feature:** `sendInlineTemplateEmail()`

**Addition:**
```typescript
// New method for inline email templates
await notificationService.sendInlineTemplateEmail({
  to: ['user@example.com'],
  subject: 'Order Confirmation - {{orderId}}',
  htmlBody: '<h1>Thank you for your order!</h1><p>Order ID: {{orderId}}</p>',
  textBody: 'Thank you for your order! Order ID: {{orderId}}',
  templateData: {
    orderId: 'ORD-12345',
  },
});
```

**Migration Steps:**
1. No breaking changes
2. Optional: Use inline templates instead of SES templates for simple emails

---

---

### v1.1.0 — Breaking Changes (data migration required)

**1. TENANT_COMMON renamed to lowercase**
```typescript
// Before (v1.0.x)
const pk = `MASTER_SETTING#COMMON#${settingCode}`

// After (v1.1.0+)
const pk = `MASTER_SETTING#common#${settingCode}`
```
- All DynamoDB keys using `#COMMON` must be migrated to `#common`
- New utilities: `normalizeTenantCode()`, `isCommonTenant()`

**2. `publish()` and `publishPartialUpdate()` removed**
```typescript
// Removed — compilation error in v1.1.0+
this.commandService.publish(...)
this.commandService.publishPartialUpdate(...)

// Use instead
this.commandService.publishAsync(...)
this.commandService.publishPartialUpdateAsync(...)
```

---

### v1.1.4 — publishSync audit trail (no code changes required)

`publishSync` now writes a full audit trail to Command and History tables (parity with async pipeline). No migration required; behavior is transparent.

---

### v1.1.5 — CSV Import v2 batch architecture

Step Functions state machine changes required:
- `finalize_parent_job` state is now **required**
- Row-level progress tracking via `import_tmp` table is removed
- Counters (`processedRows`, `succeededRows`, `failedRows`) are aggregated at completion

---

### v1.2.0 — Breaking Changes

**1. publishSync / publishPartialUpdateSync return type change**
```typescript
// Before (v1.1.x) — always returned CommandModel
const result = await commandService.publishSync(entity, options)
console.log(result.pk) // safe

// After (v1.2.0+) — returns null when command is not dirty (no-op)
const result = await commandService.publishSync(entity, options)
if (!result) return // no-op
console.log(result.pk) // safe after null check
```

**2. SequenceService.genNewSequence() removed**
```typescript
// Removed — compilation error in v1.2.0+
await sequenceService.genNewSequence(...)

// Use instead
await sequenceService.generateSequenceItem(...)
// or
await sequenceService.generateSequenceItemWithProvideSetting(...)
```

**3. Read-Your-Writes (RYW) consistency (new optional feature)**
```typescript
import { DetailKey, Repository } from '@mbc-cqrs-serverless/core'

// Enable: set RYW_SESSION_TTL_MINUTES env var (e.g. "5")
// Session table {NODE_ENV}-{APP_NAME}-session must be created
// No effect if unset — zero impact on existing projects
```

---

### v1.2.2 — Bug fixes (no code changes required)

- **CsvBatchProcessor Poison Pill fix**: Per-row try/catch now prevents Head-of-Line Blocking in SQS batches
- **ImportQueueEventHandler**: `singleImportProcessor.process()` now receives `event.importEvent` instead of `event.payload`

Both fixes are transparent — no migration steps needed.

---

### v1.2.4 — TaskModule global registration

**Breaking for apps using `@mbc-cqrs-serverless/master`**

`TaskModule.register()` is now global (`global: true`) and must be called **exactly once** in the host `AppModule`. `MasterModule` no longer registers `TaskModule` internally.

```typescript
// Before (v1.2.3 and earlier) — worked automatically
@Module({
  imports: [MasterModule.register({ enableController: true, prismaService: PrismaService })],
})
export class AppModule {}

// After (v1.2.4+) — must register explicitly
import { TaskModule, TaskQueueEventFactory } from '@mbc-cqrs-serverless/master'

@Module({
  imports: [
    TaskModule.register({ taskQueueEventFactory: MyTaskQueueEventFactory }),
    MasterModule.register({ enableController: true, prismaService: PrismaService }),
  ],
})
export class AppModule {}
```

**Migration steps:**
1. Create a factory extending `TaskQueueEventFactory` from `@mbc-cqrs-serverless/master`
2. Call `TaskModule.register()` once in `AppModule`
3. Remove `TaskModule.register()` from all feature modules

**Symptom if skipped:** App crashes at startup with `Nest can't resolve dependencies of MyTaskService (?)`.

---

### v1.2.5 — ZIP import refactor + MCP anti-pattern expansion (no migration steps required)

**Framework changes (transparent):**

- `ZipImportQueueEventHandler` removed; ZIP import jobs are now processed directly inside `ImportService`.
- `ImportEventHandler` no longer publishes SQS messages for `ZIP_MASTER_JOB` events.
- Enhanced ZIP import validation in `CreateZipImportDto` and improved error handling/logging.

No application code changes are required. If you previously imported `ZipImportQueueEventHandler` directly (uncommon), remove the import.

**MCP server changes:**

- `mbc_check_anti_patterns` tool expanded from 15 to 20 detectors (AP016–AP020 added):
  - AP016: Missing Error Logging Before Rethrow (High)
  - AP017: Incorrect Attribute Merging on Partial Update (High)
  - AP018: Missing Swagger Documentation / `@ApiTags` (Low)
  - AP019: Missing Pagination in List Queries (High)
  - AP020: Missing `getCommandSource` for Tracing (Low)
- `@modelcontextprotocol/sdk` updated 1.26.0 → 1.29.0.

---

### v1.2.6 — Repository RYW improvements (no migration steps required)

The `Repository` class now actively purges stale RYW sessions when the data table catches up to or surpasses the session version. This eliminates the "stale override" issue where a user could see their own older write even after an external update was already absorbed into the data table.

**Behavior changes (transparent — no code changes required):**

- `getItem`: when `existing.version >= session.version`, the session is purged in the background and the persisted data is returned directly (skipping the unnecessary command-table read).
- `listItemsByPk`: synchronized sessions are cleaned up in-place during the merge loop.
- `listItems` (RDS path): per-session checks are now parallelized via `Promise.all`, eliminating sequential N+1 latency.

**New optional optimization for `listItems`:**

```typescript
// If your RDS rows already carry `version`, supply `getVersion` to skip the
// extra DynamoDB GetItem entirely when the existing RDS row proves caught-up.
await repository.listItems(
  () => rdsQuery(),
  {
    latestFlg: true,
    transformCommand: (cmd) => ({
      id: cmd.id,
      version: cmd.version,
      // ...map other CommandModel fields to your RDS row shape
    }),
    getVersion: (item) => item.version,  // ← new in v1.2.6
  },
  options,
)
```

**Note:** `getVersion` only short-circuits the **update path** (when the session's `itemId` matches an existing RDS row). Create-new items (session present but not yet reflected in RDS) still fetch the command as before — there is no existing row to derive a version from.

All changes are backward-compatible: `getVersion` is optional, and the cleanup behavior is automatic when `RYW_SESSION_TTL_MINUTES` is enabled. Projects with RYW disabled (env var unset) are unaffected.

---

## Deprecated API Migration

### publish() → publishAsync()

**Deprecated in:** v1.0.0
**Removed in:** TBD

**Before:**
```typescript
await this.commandService.publish(command, options);
```

**After:**
```typescript
await this.commandService.publishAsync(command, options);
```

**Migration Script:**
```bash
# Find all occurrences
grep -r "\.publish(" --include="*.ts" src/

# Replace (use with caution)
find src/ -name "*.ts" -exec sed -i '' 's/\.publish(/\.publishAsync(/g' {} \;
```

---

### publishPartialUpdate() → publishPartialUpdateAsync()

**Deprecated in:** v1.0.0
**Removed in:** TBD

**Before:**
```typescript
await this.commandService.publishPartialUpdate(command, options);
```

**After:**
```typescript
await this.commandService.publishPartialUpdateAsync(command, options);
```

---

### publishSync() Considerations

**Status:** Not deprecated, but use sparingly

**Recommendation:**
```typescript
// Only use publishSync when immediate consistency is required
// Example: User registration where we need the user ID immediately
const result = await this.commandService.publishSync(command, options);

// For most cases, prefer publishAsync
await this.commandService.publishAsync(command, options);
```

---

## Migration Checklist

### Before Migration

- [ ] Backup database
- [ ] Review changelog for target version
- [ ] Check for breaking changes
- [ ] Run test suite on current version
- [ ] Document current API usage patterns

### During Migration

- [ ] Update package.json dependencies
- [ ] Run `npm install`
- [ ] Fix any TypeScript compilation errors
- [ ] Update deprecated API calls
- [ ] Run test suite
- [ ] Test critical workflows manually

### After Migration

- [ ] Deploy to staging environment
- [ ] Run E2E tests
- [ ] Monitor error logs
- [ ] Verify data integrity
- [ ] Update documentation
- [ ] Deploy to production

---

## Automated Migration Checks

When using this skill, Claude will:

1. **Analyze Current Version:**
   ```bash
   npm list @mbc-cqrs-serverless/core
   ```

2. **Check for Deprecated Usage:**
   ```bash
   # Search for deprecated patterns
   grep -r "\.publish(" --include="*.ts" src/
   grep -r "\.publishPartialUpdate(" --include="*.ts" src/
   grep -r "publishSync" --include="*.ts" src/
   ```

3. **Identify Breaking Changes:**
   - Compare current usage against migration guide
   - Flag any patterns that need updating

4. **Generate Migration Plan:**
   - List all files requiring changes
   - Provide specific code updates needed
   - Estimate migration effort

---

## Common Migration Issues

### Issue: ConditionalCheckFailedException after update

**Cause:** Version field handling changed
**Solution:**
```typescript
// Always fetch current version before update
const existing = await this.dataService.getItem(key);
await this.commandService.publishPartialUpdateAsync({
  ...updateData,
  version: existing.version,
}, options);
```

### Issue: DataSyncHandler not triggering

**Cause:** Type mismatch in decorator
**Solution:**
```typescript
// Ensure type matches entity's type field
@DataSyncHandler({ type: 'ORDER' }) // Must match command.type
export class OrderDataSyncRdsHandler implements IDataSyncHandler {}
```

### Issue: Import job stuck in PROCESSING

**Cause:** Missing error handling in v1.0.18
**Solution:** Upgrade to v1.0.19+ for proper error propagation

---

---

### v1.2.7 → v1.3.0

**Change:** AppSync Events API support added (opt-in, no breaking changes)

No code changes are required. `AppSyncEventsService` is registered in `NotificationModule` automatically but does nothing unless `NOTIFICATION_TRANSPORTS` includes `appsync-event`.

**To adopt the new Events API transport:**

**Step 1 — Provision infrastructure (CDK)**

Add `appsyncEvents` and `notificationTransports` to your `Config`:

```typescript
// infra/config/config.ts
export const config: Config = {
  appsyncEvents: {
    enabled: true,
    namespace: 'default',       // must match the ChannelNamespace created in AppSync
    apiKeyExpireDays: 365,
  },
  notificationTransports: 'appsync-graphql,appsync-event', // dual-publish during migration
}
```

Run `cdk deploy` to create the `EventApi` and `ChannelNamespace`. The stack outputs `AppSyncEventsHttpEndpoint` and `AppSyncEventsNamespace`.

**Step 2 — Enable dual-publish (migration phase)**

When `appsyncEvents.enabled: true`, the CDK stack automatically injects these env vars into Lambda/ECS:

```bash
NOTIFICATION_TRANSPORTS=appsync-graphql,appsync-event   # dual-publish
APPSYNC_EVENTS_ENDPOINT=https://xxxx.appsync-api.ap-northeast-1.amazonaws.com/event
APPSYNC_EVENTS_NAMESPACE=default
APPSYNC_ENDPOINT=https://xxxx.appsync-api.ap-northeast-1.amazonaws.com/graphql  # keep existing
```

**Step 3 — Switch to Events API only**

Once all clients have migrated to the Events API, update `notificationTransports` in CDK Config:

```typescript
notificationTransports: 'appsync-event',  // Events API only
```

Then redeploy. `APPSYNC_ENDPOINT` can be removed from the environment.

**Channel subscription patterns (for client-side code):**

```javascript
// All events for a tenant
appsyncClient.subscribe(`/${namespace}/${tenantCode}/*`)

// Filtered by action
appsyncClient.subscribe(`/${namespace}/${tenantCode}/${action}/*`)

// Track one specific command result
appsyncClient.subscribe(`/${namespace}/${tenantCode}/${action}/${sanitizedId}`)
```

Non-alphanumeric characters in `id` (e.g. `#`, `@` from DynamoDB pk/sk) are sanitized to `-` automatically on the server side. Client-side code using `EventsSubscriptionClientImpl` from the example app applies the same sanitization.

**Migration Steps:**
1. Add `appsyncEvents` and `notificationTransports` to CDK `Config` and deploy
2. Verify events arrive via both transports (dual-publish phase)
3. Migrate frontend clients to subscribe via AppSync Events API channels
4. Once all clients migrated, set `notificationTransports: 'appsync-event'` and redeploy

---

### v1.3.0 → v1.3.1

**Change:** Group-based roles added (opt-in, no breaking changes).

`RolesGuard` now checks direct roles from `custom:roles` first, then roles derived from the user's groups in `custom:groups`. `UserContext` gains two fields — `tenantRoles` (direct roles array) and `tenantGroupIds` (group IDs for the active tenant) — while `tenantRole` (singular) is kept for backward compatibility. No code changes are required to upgrade; existing role checks keep working.

**To adopt group-based roles:**

**Step 1 — Add `custom:groups` to the JWT** (tenant-scoped; group → role mappings are NOT in the token):

```json
{
  "custom:roles": "[{\"tenant\":\"tenant-a\",\"role\":\"admin\"}]",
  "custom:groups": "[{\"tenant\":\"tenant-a\",\"groups\":[\"sales-team\"]}]"
}
```

**Step 2 — Implement exactly one resolver** that maps group IDs to roles (loaded from DynamoDB/RDS/config):

```typescript
import {
  GroupRoleResolver,
  IGroupRoleResolver,
} from '@mbc-cqrs-serverless/core';

// Do NOT add @Injectable() — @GroupRoleResolver() already registers the provider
// as a singleton. A second @Injectable() can override the scope and break bootstrap.
@GroupRoleResolver()
export class AppGroupRoleResolver implements IGroupRoleResolver {
  async resolveRoles({ tenantCode, groupIds, claims }) {
    // Map the user's group IDs to roles for this tenant
    return ['viewer', 'reporter'];
  }
}
```

Register the class in your module `providers`. `AuthModule` is imported automatically via `AppModule.forRoot()`.

**Notes / gotchas:**
- The resolver must be a **singleton** — it is resolved once at bootstrap. Avoid `REQUEST`/`TRANSIENT` scope.
- A resolver failure (e.g. DB outage) **propagates as a 5xx**, not a silent 403, so a backend outage is distinguishable from a genuine access denial. Make the resolver resilient (timeouts/retries) if its backing store can be unavailable.
- Malformed `custom:groups` is tolerated (fail-closed → no group roles), so a bad token degrades to direct-role-only checks rather than crashing.
- `getUserRole()` on `RolesGuard` is **deprecated** and no longer called by the default guard. For custom authorization, override `verifyRole`, `resolveGroupRoles`, or `canOverrideTenant` instead.
- Role-name matching is case-sensitive; keep the casing in `custom:roles` consistent with your `@Roles(...)` values.

**Migration Steps:**
1. Upgrade to v1.3.1 — no code changes required; existing `@Roles()` checks keep working.
2. (Optional) Populate `custom:groups` in the JWT and implement one `@GroupRoleResolver()`.
3. Register the resolver in your NestJS module `providers`.

---

## Version Compatibility Matrix

| Core Version | CLI Version | NestJS | Node.js | TypeScript |
|--------------|-------------|--------|---------|------------|
| v1.3.0 | v1.3.0 | 10.x | 18+ | 5.x |
| v1.0.23 | v1.0.23 | 10.x | 18+ | 5.x |
| v1.0.22 | v1.0.22 | 10.x | 18+ | 5.x |
| v1.0.21 | v1.0.21 | 10.x | 18+ | 5.x |
| v1.0.20 | v1.0.20 | 10.x | 18+ | 5.x |

---

## Getting Help

If you encounter migration issues:

1. Check the [changelog](/docs/changelog) for detailed notes
2. Search [GitHub issues](https://github.com/mbc-net/mbc-cqrs-serverless/issues)
3. Review [error catalog](/docs/error-catalog) for specific errors
4. Ask Claude Code for specific migration assistance
