# Atomic command admission

## Why use admission checks?

A maintenance window may need to freeze configuration updates while messages
and other commands continue. A preflight gate read can become stale before the
command is persisted. Command version CAS protects the command's version, but
cannot detect a separate gate closing and reopening in between. Checking the
original tenant-scoped gate generation in the command-write transaction closes
that gap.

Start with the [runnable configuration-freeze example](../../examples/command-admission/README.md).
It includes an actual `CommandService` subclass, server-owned witness context,
same-module Nest registration, offline DI tests and a separate DynamoDB Local
runner. Capture the witness **before** reading/building the update, retain the
observed command version, and never refresh the witness inside the hook or retry
an old payload with a new generation.

Potential applications include maintenance/data migrations, stale-job or
lease-owner fencing, and approval/authorization revocation. These require
application-specific authoritative witnesses updated atomically, same-account/
Region transaction tables, and coordination of already accepted work and external
side effects. The hook alone is not a complete maintenance or authorization
system. Using the extension rather than copying the publisher preserves its
serializer, S3, TTL, session and history lifecycle.

## Extension point

`CommandService` exposes a protected extension point for server-owned subclasses:

```ts
protected async getCommandAdmissionConditions(
  command: Readonly<CommandModel>,
  options: ICommandOptions,
): Promise<ConditionCheck[]>
```

`ConditionCheck` is the low-level AWS SDK type from `@aws-sdk/client-dynamodb`.
The default implementation returns `[]`, preserving ordinary conditional
`PutItem` behavior. There is no request option to bypass admission or supply
arbitrary transaction writes.

Override this method in the application's registered command-service subclass.
Construct checks from trusted server context and authoritative witness state.
For example, a generation witness check can use this shape (table, tenant key,
and generation must be resolved by the application):

```ts
return [{
  TableName: witnessTable,
  Key: { pk: { S: tenantKey }, sk: { S: witnessKey } },
  ConditionExpression: '#generation = :expected',
  ExpressionAttributeNames: { '#generation': 'generation' },
  ExpressionAttributeValues: { ':expected': { N: String(expectedGeneration) } },
}]
```

Do not mutate the command, its nested attributes, or the returned checks during
persistence. `Readonly` is a TypeScript contract, not a runtime deep freeze.
Application policy, including which commands need fencing, trusted generation
selection, tenant isolation, and coordinated witness updates, remains outside
core. A preflight read alone is not atomic admission: the returned check is
what enforces the witness at the command-write boundary.

## Boundary and lifecycle

The hook runs after existing input/version validation, dirty checking and command
metadata construction, immediately before the initial command is serialized.
It receives the persisted versioned sort key in every path. `publishSync`,
`publishAsync`, and `duplicate` share this boundary; partial update entry points
continue to merge/delegate to the corresponding publisher. A no-op dirty check
still returns without calling the hook. Existing TTL calculation may read before
the hook; initial-command persistence and downstream writes have not occurred.

With checks, `DynamoDbService.putItemWithConditions(table, item, putCondition,
checks)` sends one `TransactWriteItemsCommand` containing the command `Put` and
then only `ConditionCheck` entries. The command retains
`attribute_not_exists(pk) AND attribute_not_exists(sk)`. Without checks it calls
the original `putItem`. Both use the same private serializer, preserving dates,
undefined removal, class instances, and large-attribute S3 offload. Input
attributes are not replaced with an S3 pointer.

Hook exceptions propagate unchanged, and transaction failures propagate as
described in [Rejections and HTTP responses](#rejections-and-http-responses).
There is no plain-Put
fallback. Sync TTL/history/data/handlers/status and async session writes run only
after successful acceptance, in their existing order. Duplicate retains its
existing behavior (including no new session write). TTL updates, projections,
status/task-token updates and draining already accepted commands do not invoke
admission. Closing a witness does not retroactively reject accepted work.

## Rejections and HTTP responses

`putItemWithConditions` classifies a cancelled transaction by its
`CancellationReasons`, which follow `TransactItems` order: index 0 is the command
`Put` and the remaining entries are the checks. The first matching row applies:

| Cancellation reasons | Exception | HTTP | What the caller should do |
| --- | --- | --- | --- |
| A check has `ConditionalCheckFailed` | `CommandAdmissionRejectedException` | 409 | Stop. A new attempt must capture again, reread and rebuild |
| The `Put` has `ConditionalCheckFailed` | `ConditionalCheckFailedException` | 409 | Same as a version conflict on an ordinary Put: reread and rebuild |
| Any entry has `TransactionConflict` | `CommandAdmissionContentionException` | 503 | Retry later. A new attempt must still capture again, reread and rebuild |
| Anything else, or no reasons | Original `TransactionCanceledException` | 500 | Treat as a server error |

A failed check takes priority over a version conflict because the whole request
is stale. Core does not retry automatically. The admission exceptions keep the
AWS error as `cause`, and applications can catch them to return another response,
such as 503 during a planned maintenance window. None of these outcomes means the
command was accepted. Never retry through an unfenced path.

The two new exceptions are Nest `HttpException` subclasses, so outside HTTP
handlers they behave like any other thrown error. Without checks, the ordinary
`PutItem` path and its exceptions are unchanged.

## Validation and operational limits

The adapter rejects a non-array, more than 99 checks, unexpected fields (including
transaction write actions), missing/wrong required types, malformed attribute
value types and invalid return-value enums before serialization/S3 upload.
Checks use AWS AttributeValue maps, not plain JavaScript values. DynamoDB still
validates expressions, numeric value syntax, table/key schemas, duplicate item
targets and service size limits. Do not target the command item itself, or the
same item twice. All participating tables must support the same regional/account
transaction. The command plus checks must fit DynamoDB's transaction limits;
S3 offload does not remove limits on the remaining item or check payloads.

The transaction needs `dynamodb:PutItem` on the command table and
`dynamodb:ConditionCheckItem` on every witness table. The CLI infrastructure
template grants both, but only on tables whose names start with the stack prefix.
Give a witness table that prefix or grant it separately. Projects generated from
an earlier template must add the permission themselves. Without it, the request
fails with an access-denied error rather than a rejection.

### Capacity and contention

DynamoDB performs two underlying operations for every item in a transaction, and
consumes that capacity even when the transaction is cancelled. A check therefore
adds cost to each protected command, on top of the doubled cost of the `Put`.

According to the AWS documentation, an item in a `TransactWriteItems` request
conflicts with another ongoing `TransactWriteItems` request that includes the same
item. A single witness checked by many concurrent commands may therefore cancel
some of them with `TransactionConflict`, even while the gate is open. A
`PutItem`, `UpdateItem` or `DeleteItem` on the witness can also fail with
`TransactionConflictException`, so a maintenance controller that updates the gate
must retry until the update succeeds. The AWS SDK does not retry cancelled
transactions.

This has not been measured against the DynamoDB service. DynamoDB Local reported
no conflicts in a test with 200 concurrent transactions on one witness, so passing
local tests say nothing about this behavior. Load test the expected concurrency in
a real environment, and consider narrower witnesses if conflicts are frequent.

S3 upload happens before the DynamoDB request, as it does with ordinary Put.
A rejected transaction can leave an orphaned S3 object, just like a failed Put.
No rollback/delete is attempted and the caller's object pointer remains unchanged.
Account for orphan retention/cleanup separately.

## Validation commands

From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund --legacy-peer-deps
NODE_ENV=test ./node_modules/.bin/jest --runInBand --silent packages/core/src/commands/command-admission.spec.ts packages/core/src/data-store/dynamodb-admission.spec.ts packages/core/src/commands/command.service.spec.ts packages/core/src/data-store/dynamodb.service.spec.ts
npm run build --workspace @mbc-cqrs-serverless/core
./node_modules/.bin/eslint packages/core/src/commands/command.service.ts packages/core/src/data-store/dynamodb.service.ts
```

The existing lockfile requires legacy peer resolution with npm 11.19.1 in the
implementation environment; no manifest or lockfile update is needed.

The standard CI command, `npx lerna run test:e2e --scope=@mbc-cqrs-serverless/core`,
uses `test/jest-e2e.json`, which discovers `command-admission.e2e-spec.ts`
alongside the existing suites. Its setup starts DynamoDB Local on port **8000**;
the admission test defaults to `http://127.0.0.1:8000`. No exclusion or separate
CI service is required.

An independent runner is also provided without the existing `posttest:e2e`
kill script or full harness setup. With DynamoDB Local already running on 8000:

```sh
./node_modules/.bin/jest --config packages/core/test/jest-admission-local.json --runInBand
```

For a dedicated process on port **18765**, start your own DynamoDB Local Java
distribution and explicitly override the test endpoint:

```sh
java -Djava.library.path=/path/to/DynamoDBLocal_lib -jar /path/to/DynamoDBLocal.jar -inMemory -sharedDb -port 18765
# In another terminal, from the repository root:
COMMAND_ADMISSION_DYNAMODB_ENDPOINT=http://127.0.0.1:18765 ./node_modules/.bin/jest --config packages/core/test/jest-admission-local.json --runInBand
```

`COMMAND_ADMISSION_DYNAMODB_ENDPOINT` accepts only `http://127.0.0.1:<port>`
or `http://localhost:<port>`, with an integer port from 1 through 65535 and an
optional trailing slash. Empty values, credentials, paths, queries, fragments,
and other hosts or schemes are rejected before client creation. General AWS
endpoint variables (including `DYNAMODB_ENDPOINT`) are ignored; credentials
remain fixed dummy values. The test creates a uniquely named table and deletes
only that table. It verifies stale-witness rejection without a
command row, matching-witness acceptance, and immutable-command conflict
rejection. Stop only the process you started. No cloud resources are used.
