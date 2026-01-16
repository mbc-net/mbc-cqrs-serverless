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

## Version Compatibility Matrix

| Core Version | CLI Version | NestJS | Node.js | TypeScript |
|--------------|-------------|--------|---------|------------|
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
