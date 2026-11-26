# Strict inline publication

`CommandModule.register` can opt a domain into the `strict-inline-v1` profile.
This is a **publication-only** boundary, not a deployment or projection feature.
Applications that omit it retain the existing behavior.

```typescript
export const LEDGER_TRANSPORT = Symbol('LEDGER_TRANSPORT')

CommandModule.register({
  tableName: 'asset-ledger',
  safety: { profile: 'strict-inline-v1' },
  strictDataStoreToken: LEDGER_TRANSPORT,
})
```

The module exports `CommandService` and the caller's unique symbol for the
domain-owned `DynamoDbService`. It does not export a bare datastore token,
repository, projection service, history service, or event-handler alias.
Use a different symbol per domain. Do not export a bare `CommandService` from
the enclosing domain module or register the same physical table in multiple
owners.

## Supported command operations

- `publishAsync` requires an explicit nonnegative safe integer base version,
  below `Number.MAX_SAFE_INTEGER`, and an unversioned sort key. It publishes at
  most once per invocation; equal input can produce a positive no-op (`null`).
- `getItem` requires an explicit positive version suffix and forces a strongly
  consistent read. It does not search for a latest version or a projection.
- Other command operations, including sync/partial publication, duplicate,
  latest lookup, status notification, history/TTL mutation, and resynchronizing
  projections, fail before I/O in this profile.

No data-sync handler or event-handler alias is installed. Explicit handler
options that contradict the profile are rejected. An application needing
projection or processing pipelines must design and verify those separately;
this profile alone must not be substituted for an existing production module.

## Transport, logging, and storage

The domain owns a new DynamoDB client with `maxAttempts: 1`, including TTL
configuration and enabled RYW session operations. Endpoint and region use the
existing configuration. No shared client or global logging policy is changed.
The owner destroys its dedicated client at module shutdown. The normal
credential chain still applies: tests must supply isolated dummy credentials
and a loopback endpoint.

Command, TTL, session, and datastore logging on the supported path uses fixed
events. Attributes, credentials, user/tenant/item keys, task tokens, request
context, and raw SDK errors are not passed to the underlying logger. Strict
publication and datastore errors carry fixed messages without raw causes.
Conditional failure types are preserved using a fixed allowlist.

Attributes must remain inline: at most 128 KiB of UTF-8 JSON, and at most
300 KiB for a marshalled Put or observed item. The strict limits are independent of the legacy
`ATTRIBUTE_LIMIT_SIZE` setting. Oversized writes and S3 attribute references
are rejected before calling S3; there is no alternate storage path.
Attribute JSON size is measured from the unmarshalled native representation on
both writes and reads. A caller's `toJSON` projection does not determine the
budget; the content that is actually persisted does.
Set members are measured as JSON arrays so their contents also consume the budget.
Binary values and binary-set members are measured as base64 strings, including
the native-item budget. Buffer and Uint8Array responses therefore use identical
budgets without changing the stored or returned binary types.
The map key `__proto__` is unsupported at every depth in the strict profile:
the SDK does not preserve it reliably. Writes and native reads reject it before
I/O or decoding instead of silently dropping its value. Legacy behavior is unchanged.
Datastore query/update expression payloads have request budgets; a partial
update does not atomically prove a size limit for the complete resulting item.
The supported command operations use complete Put/read payloads, not partial
updates. Trusted control code must supply its own state and transaction bounds.

A failed TTL configuration read stops before the command write. A missing TTL
row is a successful observation of no configuration; a malformed existing
configuration is an error. A failed RYW session write occurs after command
acceptance and remains nonfatal. It never triggers another command write and
does not prove session or projection completion.

The named datastore's raw `client` getter is available for trusted domain
control transactions. Direct SDK calls bypass the datastore's error mapping
and logging boundary; their consumers must apply their own fixed errors and
must not log payloads or raw errors.

## Remaining application requirements

This profile does not implement durable enrollment, all-writer fencing,
authorization freshness, external recovery epochs, ownership reservations,
rollback reconciliation, or runtime configuration. Lost acknowledgements can
leave an uncertain outcome. Do not automatically retry, release a pending
operation, recreate enrollment, or switch to another profile after failure.

The source implementation is based on the framework development tree, not an
in-place patch of an application's installed package. Validate the exact built
package and application integration before adopting it. No package release or
application dependency update is implied.

## Validation

Run unit tests with the normal repository Jest configuration. The isolated
native DynamoDB test is separate because it requires Java and an already
installed DynamoDB Local distribution:

```sh
STRICT_INLINE_DYNAMODB_HOME=/path/to/dynamodb-local \
  node node_modules/jest/bin/jest.js \
  --config packages/core/test/jest-strict-inline.json --runInBand
```

The test fails if its prerequisite is missing; it never downloads or substitutes
a mock implementation. It owns and cleans up its loopback server, tables,
clients, and ephemeral working directory. All test inputs are synthetic.
