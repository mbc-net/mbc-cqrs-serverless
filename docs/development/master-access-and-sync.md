# Master data access control and per-system sync

## Why use system scoping?

Several products can share master data maintained in one central service, the
**hub**. Each product keeps its own copy through an asynchronous feed and never
calls the hub at read time. The `master` package supports this with three
opt-in parts:

1. `controllerAuth` protects the built-in master routes.
2. A `systemId` on each master setting, plus an optional access resolver that
   grants read and write per system and per setting.
3. Data you can use to publish every change to SNS, one filtered queue per
   system. The framework ships no publisher. You write it as an ordinary
   `IDataSyncHandler`.

An application that sets neither `controllerAuth` nor a resolver keeps today's
behaviour, apart from these differences:

- The two copy fixes (see [Behaviour changes](#behaviour-changes)).
- A `__systemId` key sent by a client in `attributes` is removed.
- Responses go through `toPublicRow`, so a row stored earlier with a
  client-planted `__systemId` comes back with that value as a top-level
  `systemId` and without the key in `attributes`.
- With `enableController`, the `GET /api/master-access` route is added.
- The DTOs accept `systemId` (setting create and bulk items, list searches) and
  `includeCommon` (list searches). Without a resolver `systemId` is ignored.
- `POST /api/master-bulk` upserts the settings first and the data rows after,
  instead of both at once.

## Terms

| Term | Meaning |
|---|---|
| Tenant | Which customer the data belongs to. Part of the key, `MASTER#<tenantCode>`. |
| `systemId` | Which product the data is for. Stored in `attributes.__systemId`, outside the key. One per row. |
| `shared` | Reserved `systemId` for data every system receives. A row with no stored `systemId` counts as `shared`. |
| Common tenant | Default data for all customers. Set with the `commonTenantCode` option (default `common`). Unrelated to `systemId`. |
| Hub | The central service where master data is edited. |
| Consumer | A product service that holds a filtered copy. |

Tenant and system are independent axes. Because `systemId` is not in the key,
each `settingCode` has one owner within a tenant.

## Protect the built-in routes

Set `controllerAuth` on `MasterModule`. Setting it, even as `{}`, turns on a
guard on `MasterDataController`, `MasterSettingController`,
`MasterBulkController`, `MasterAccessController` and `MyTaskController`.

```ts
MasterModule.register({
  enableController: true,
  controllerAuth: { read: [], write: ['master_editor'] },
  dataSyncHandlers: [MasterDataSyncRdsHandler, MasterPublishSyncHandler],
  prismaService: PrismaService,
})
```

- A request with no `sub` claim is rejected.
- `read` empty (or omitted) means any logged-in user. `write` empty (or
  omitted) falls back to `system_admin` only. `system_admin` always passes, and
  group-derived roles count.
- `GET` routes and the two `POST .../check-exist` routes are reads. Everything
  else is a write.
- The requested tenant must equal the caller's tenant, unless the request reads
  the common tenant or the caller holds a cross-tenant role. Otherwise the
  guard answers `BadRequestException('Invalid tenant code')`. `POST /copy`
  checks the source as a read and each target as a write, and needs
  `system_admin` whatever `controllerAuth.write` says.
- Without `controllerAuth` the routes stay unguarded and `MasterModule` logs a
  startup warning.

`enableCopyTask` registers the master copy handler. It defaults to the value of
`enableController`, so an application that turns the controllers off to write
its own routes can still copy.

## Store and expose `systemId`

`systemId` lives in `attributes.__systemId` (constant
`MASTER_SYSTEM_ATTRIBUTE`, reader `getSystemId(row)`).

- `__systemId` sent by a client is always removed, with or without a resolver.
  Only the master services write it.
- API responses show `systemId` at the top level and hide `__systemId` from
  `attributes`. Write responses do this too.
- A new setting may carry `systemId` in `CommonSettingDto`, `TenantSettingDto`
  or a bulk setting item. A setting with the same code as one already visible
  through the tenant-then-common lookup inherits its `systemId`. A conflicting
  explicit value is a 400.
- A data row never accepts `systemId` from the client. It takes the value of
  its effective setting (the tenant's, then the common tenant's).
- `systemId` is stored in lower case, so `APP-A` is stored as `app-a`. `'*'` is
  not a valid owner and is a 400.
- `systemId` is immutable once set, including on soft-deleted rows. A
  differing value on upsert is a 400. The comparison ignores case.
- Group and user settings are personal overrides. They never store `systemId`,
  and access checks use the effective setting for the last key segment.
- Ownership rules run only when a resolver is registered. Without one the
  services ignore `systemId`.
- With a resolver, a new data row whose setting cannot be found is rejected. An
  existing row whose setting is gone stays writable and untagged.

## Write a resolver

Register one class with `@MasterAccessResolver()`. It applies `@Injectable()`
for you, so do not add it. More than one resolver throws at startup. With a
resolver registered, access is denied by default and grants are a union. If the
resolver throws, the request fails and nothing is granted. There is no
framework bypass for `system_admin`: your resolver decides, usually by
returning `*` grants.

```ts
import {
  IMasterAccessResolver,
  MasterAccessGrant,
  MasterAccessResolver,
  ResolveMasterAccessInput,
} from '@mbc-cqrs-serverless/master'

@MasterAccessResolver()
export class AppMasterAccessResolver implements IMasterAccessResolver {
  async resolveGrants(
    input: ResolveMasterAccessInput, // userId, tenantCode, roles, claims
  ): Promise<MasterAccessGrant[]> {
    if (!input.userId) return []
    if (input.roles.includes('system_admin')) {
      return [{ systemId: '*', settingCode: '*', read: true, write: true }]
    }
    const grants: MasterAccessGrant[] = [
      // everyone may read shared data
      { systemId: 'shared', settingCode: '*', read: true, write: false },
    ]
    if (input.roles.includes('app_a_editor')) {
      grants.push({ systemId: 'app-a', settingCode: '*', read: true, write: true })
    }
    return grants
  }
}
```

A grant has `systemId` (or `'*'`), `settingCode` (or `'*'`), `read` and
`write`. Write implies read. The resolver returns grants, not yes or no,
because list endpoints put the filter in the SQL query, which keeps pagination
and `total` correct. Grants are resolved once per request event, and for a
caller who is not logged in, once per `scope.tenantCode` within that event.

Add the class to the providers of a module that is loaded with `MasterModule`.

### What the services check

`MasterDataService` and `MasterSettingService` enforce access, so your own
routes get the check too. Methods take `{ invokeContext }` plus these optional
fields:

```ts
interface MasterAccessOptions {
  invokeContext?: IInvoke
  scope?: { tenantCode?: string; systemId?: string } // narrows only
  skipAccessCheck?: boolean // trusted internal work
  systemId?: string         // internal callers only, used by copy
}
```

With a resolver registered, the checks run in this order:

1. `skipAccessCheck`: pass.
2. No `invokeContext`: 403. This also applies to the read methods. **Server-side
   code on the hub must pass `{ invokeContext }`, or `skipAccessCheck: true`
   for trusted internal work.**
3. Tenant gate: the record's tenant must equal the caller's tenant, be a common
   tenant for a read, or the caller must hold a cross-tenant role. A logged-in
   caller with no `custom:tenant` claim may only use a header-named tenant that
   is a common tenant, unless they hold a cross-tenant role.
4. Not logged in and writing: 403.
5. Not logged in and no `scope.tenantCode`: 403. Set `scope.tenantCode` on
   your own anonymous routes.
6. Grants must cover the record's `systemId` (or `shared`) and setting code.

List endpoints build an `OR` of the grants into the Prisma `where`. `shared`
also matches `NULL`. Grant values and the search value are compared in lower
case. A search `systemId` or `scope.systemId` only narrows the result. No grants
means an empty list. `checkExistCode` applies the tenant gate only, so a form
can warn about a code owned by a system the user cannot see.

Group and user setting rows sync to RDS with a `NULL` system id. A limited
settings list leaves them out (`sk` starting with `MASTER_SETTING#GROUP#` or
`MASTER_SETTING#USER#`), because their access follows the base setting. Only a
caller whose grants need no filter, such as `*` on `*`, sees them in the list.

Pass `includeCommon: true` in the search of `listByRds` or `list` to add common
tenant rows whose code the caller's tenant does not have. It is off by default
and only adds rows. In `listByRds`, data rows of a soft-deleted setting are
hidden per tenant: the tenant's rows by the settings deleted in the tenant, the
common rows by the settings deleted in the common tenant.

### Master copy

`MasterSettingService.copy` requires the `system_admin` role and a
`{ systemId: '*', settingCode: '*', write: true }` grant from the resolver. With
`controllerAuth`, the route also requires `system_admin` regardless of `write`.
Copying to other tenants relies on `system_admin` being a cross-tenant role
(`DEFAULT_CROSS_TENANT_ROLES`, from the `CROSS_TENANT_ROLES` env value, default
`system_admin`). The background step (`MasterSfnTaskEventHandler`) runs with
`skipAccessCheck` and carries the source owner through the internal `systemId`
option, so it works with no user claims.

### Access endpoint for the UI

`GET /api/master-access` returns `{ enabled, grants }`. With no resolver it is
`{ enabled: false, grants: [] }`. For a logged-out caller it is
`{ enabled: true, grants: [] }` and the resolver is not called. Applications
with their own routes can call `MasterAccessService.getAccess({ invokeContext })`.

### Tag existing data

```ts
await masterSettingService.assignSystem(
  { code: 'APP_A_ROUTE_TYPE', systemId: 'app-a', tenantCode: 'acme' },
  { invokeContext },
)
```

- It requires a resolver, and write access on the target system and on
  `shared`. With no `tenantCode` it covers every tenant and needs a
  cross-tenant role.
- `systemId` is stored in lower case. `'*'` is a 400.
- It finds candidate rows through RDS, settings by `masterCode` and data rows
  by `masterTypeCode`, where `system_id` is `NULL`. For each one it reads the
  latest command and skips the row when that command already has a
  `systemId` or does not exist, so a column that is not written yet or lags
  behind cannot overwrite an owner. It publishes with the command's version
  and counts only the rows it publishes.
- It is a migration tool with no built-in route. Run it before consumers
  subscribe. The Lambda timeout is a ceiling, so split the work per tenant.

## Add the RDS column

Add a nullable `system_id` column and write it in the RDS handler:

```prisma
systemId String? @map("system_id")
@@index([tenantCode, systemId])
```

```ts
update: { /* ... */ systemId: getSystemId(cmd) },
create: { /* ... */ systemId: getSystemId(cmd) },
```

New projects get both from the template. **Applications generated earlier must
add the `system_id` column and write `systemId: getSystemId(cmd)` in their own
RDS handler, because `update-scheme.ts` does not change an existing schema or
handler.** Until then the column stays `NULL` and every row counts as `shared`
in list filters. The column is needed only when a resolver is registered.

## Publish changes to SNS

Write an ordinary `IDataSyncHandler` and register it in `dataSyncHandlers`.
`cmd.attributes.__systemId` carries the owner. `SnsService.publish` sets only
the `action` attribute and `SnsClientFactory` is not exported, so the handler
creates its own `SNSClient` from `SNS_ENDPOINT` and `SNS_REGION`. SNS ignores
message attributes a filter policy does not name, so existing subscribers are
unaffected. Publish to a dedicated topic so consumers never need access to the
main topic.

```ts
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import {
  CommandModel,
  IDataSyncHandler,
  KEY_SEPARATOR,
  removeSortKeyVersion,
} from '@mbc-cqrs-serverless/core'
import { MASTER_SYSTEM_ATTRIBUTE } from '@mbc-cqrs-serverless/master'
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class MasterPublishSyncHandler implements IDataSyncHandler {
  private readonly logger = new Logger(MasterPublishSyncHandler.name)
  private readonly sns = new SNSClient({
    endpoint: process.env.SNS_ENDPOINT,
    region: process.env.SNS_REGION,
  })

  async up(cmd: CommandModel): Promise<void> {
    const sk = removeSortKeyVersion(cmd.sk)
    const parts = sk.split(KEY_SEPARATOR)
    // Skip group and user settings: MASTER_SETTING#<type>#<id>#<code>
    if (parts[0] === 'MASTER_SETTING' && parts.length > 2) return

    const { [MASTER_SYSTEM_ATTRIBUTE]: owner, ...attributes } =
      (cmd.attributes as Record<string, unknown>) ?? {}
    const systemId = (owner as string) ?? 'shared'
    const message = {
      action: 'master-sync',
      systemId,
      tenantCode: cmd.tenantCode,
      id: cmd.id,
      pk: cmd.pk,
      sk,
      code: cmd.code,
      name: cmd.name,
      type: cmd.type,
      seq: cmd.seq,
      version: cmd.version,
      isDeleted: cmd.isDeleted ?? false,
      attributes,
      updatedAt: cmd.updatedAt,
    }
    const command = new PublishCommand({
      TopicArn: process.env.MASTER_SYNC_TOPIC_ARN,
      Message: JSON.stringify(message),
      MessageAttributes: {
        action: { DataType: 'String', StringValue: 'master-sync' },
        systemId: { DataType: 'String', StringValue: systemId },
        tenantCode: { DataType: 'String', StringValue: cmd.tenantCode },
      },
    })

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.sns.send(command)
        return
      } catch (error) {
        this.logger.warn(`publish failed (${attempt}/3) for ${cmd.id}`, error)
        await new Promise((r) => setTimeout(r, attempt * 200))
      }
    }
    // Do not throw: see "Failure handling".
    this.logger.error(`master-sync publish gave up for ${cmd.id}; replay needed`)
  }

  async down(): Promise<void> {}
}
```

Adapt the field names to your command entity. The body above is the
recommended contract: `systemId`, `tenantCode`, `id`, `pk`, `sk` without the
`@version` suffix, `code`, `name`, `type`, `seq`, `version`, `isDeleted`,
`attributes` without the reserved key, and `updatedAt`.

### Failure handling

The handler must not throw. A failed `sync_data` state leaves a non-finish
status, so later versions of the same key can each wait up to 24 hours. Retry a
bounded number of times, then log, alarm and return normally. The consumer's
copy is stale until a replay. A message over the SNS size limit takes the same
path.

### Replay

`CommandService.reSyncData()` re-runs every non-DynamoDB handler over the whole
data table, so it replays through your handler. It also re-runs the RDS handler
and covers every system. For a narrower replay, write your own scan with
`DynamoDbService.listAllItems`. Use replay to onboard a new consumer or recover
from a failed publish.

## Consumer contract

The framework ships nothing for the receiving side.

- Create an SQS queue subscribed to the topic with `rawMessageDelivery: true`,
  a DLQ and a filter such as
  `{ "action": ["master-sync"], "systemId": ["app-a", "shared"] }`. SNS filter
  values are case-sensitive, and `systemId` is stored in lower case, so write
  the values in lower case. A filter change can take up to 15 minutes to apply.
- Delivery is at least once and unordered. Apply a message only if `version` is
  greater than the stored version.
- Deletes are soft (`isDeleted: true`). Deleting a setting emits no messages for
  its data rows, so consumers should hide those rows.
- Keep `pk` and `tenantCode` unchanged when storing.
- **A consumer that also filters on `tenantCode` must include the common
  tenant**, because settings often exist only there.
- Re-delivered rows are normal during a replay.

## Behaviour changes

- Master copy reads data from the source setting's tenant. It used to read from
  a hard-coded `meltec` tenant.
- Master copy now copies sequences. The comparison used the target tenant on
  both sides, so nothing was ever copied. A target behind the source jumps to
  the source's value.

## Rollout order on the hub

1. Upgrade the backend packages and set `controllerAuth`.
2. Add the RDS column, write it in your own RDS handler, upgrade the frontend
   package, then register the resolver. The old UI cannot send `systemId`, so
   creating a setting would need write access on `shared`.
3. Tag existing data with `assignSystem`. Untagged rows count as `shared` and
   would reach every system.
4. Create the topic, register the publish handler and subscribe consumer
   queues.
5. Replay existing data with `CommandService.reSyncData()`.
