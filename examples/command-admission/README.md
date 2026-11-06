# Freeze configuration updates while other commands continue

This small server-side example uses the real `CommandService` extension point
to admit configuration updates only while a tenant's gate is open **and still
at the generation the request originally observed**. Other commands continue.
It is an educational policy, not a production maintenance controller or an HTTP
server.

## Try it from the repository root

Use the repository's existing installed dependencies and core checkout; no
package installation or generated application is needed. Node.js 22+ is required.

```sh
npm run build --workspace @mbc-cqrs-serverless/core
./node_modules/.bin/tsc -p examples/command-admission/tsconfig.json
./node_modules/.bin/jest --config examples/command-admission/jest.config.cjs --runInBand
./node_modules/.bin/eslint --no-ignore --config examples/command-admission/.eslintrc.cjs 'examples/command-admission/*.ts'
```

The root `npm run build` builds workspace packages; this example needs the
explicit `tsc` command above because examples are excluded from that build.
The first Jest command runs offline unit/DI tests. To exercise **actual DynamoDB
transactions**, start your existing DynamoDB Local on port 8000, then run:

```sh
./node_modules/.bin/jest --config examples/command-admission/jest.local.config.cjs --runInBand
```

This separate runner creates unique command, data and gate tables, seeds a
configuration at version 12, runs the races below, and deletes only its own
tables. It never starts/stops Docker or a database process. To use another local
port, prefix the command with
`COMMAND_ADMISSION_DYNAMODB_ENDPOINT=http://127.0.0.1:18765`.
Only `http://127.0.0.1:<port>` or `http://localhost:<port>` (1–65535, optional
trailing slash) is allowed. Credentials are fixed dummy values; general AWS
endpoint variables are ignored. No cloud account is needed. These tests are
outside existing core E2E discovery and must be invoked explicitly.

## The race this solves

| Time | Request | Maintenance controller |
| --- | --- | --- |
| 1 | Captures tenant gate: open, generation **7** | |
| 2 | Reads configuration command version **12**; builds update | |
| 3 | | Closes gate and atomically increments generation to **8** |
| 4 | Attempts command **13** with original generation **7**: rejected | |
| 5 | | Reopens gate and atomically increments generation to **9** |
| 6 | Old generation **7** is still rejected, even though gate is open | |
| 7 | A new request captures **9**, rereads version **12**, rebuilds and may publish **13** | |

A preflight check alone has a read/write race. Command version CAS prevents
competing updates to the same command version, but cannot detect a change to a
separate maintenance item. The hook adds a tenant-scoped `ConditionCheck` for
`active = true`, `mode = normal`, and the **original** generation to the same
DynamoDB transaction as the immutable command `Put`. Either both succeed or no
new command exists. Closing and reopening must each advance the generation;
never reset it or recreate a gate with a previously used generation.

## Follow the code

- [application.ts](./application.ts): `ConfigurationApplication.update` captures
  admission **before** reading/building the configuration update, then calls the
  inherited `publishAsync` with the observed command version, never
  `VERSION_LATEST`. Read from command history rather than assuming a possibly
  lagging projection is the current command version. Deleted configurations are
  rejected before publication so an update cannot revive them. The command
  retains the observed ID, code, name and type and updates the value; core
  supplies the normal publication metadata.
- [admission.ts](./admission.ts): an application-owned `AsyncLocalStorage` carries
  an immutable witness through that operation. The subclass only supplies
  checks; it does not copy the publisher or serializer. `CONFIG#` resource keys
  are protected; unrelated keys return `[]`. Missing context and mismatched
  tenant/key ownership fail closed for protected writes reaching the hook.
- [example.module.ts](./example.module.ts): real Nest registration. Call
  `ConfigurationExampleModule.register({ tableName: 'settings',
  witnessTableName: 'dev-myapp-configuration-gates', infrastructureImports: [...] })`
  from your application's imports. `tableName` is the core base name; the witness
  name is the full physical table name, including any stack prefix that your IAM
  policy requires. Supply existing modules exporting
  `DynamoDbService`, `SessionService`, `S3Service`, `SnsService`, `ConfigService`
  and `StepFunctionService`, or use the application's existing global providers.
- [admission.spec.ts](./admission.spec.ts): verifies ordering, missing/cross-tenant
  witnesses, checks, propagation of failure and real Nest injection.
- [maintenance.local-test.ts](./maintenance.local-test.ts): runnable acceptance,
  stop, close/reopen, unrelated-command and fresh-request demonstrations.
- [migration.ts](./migration.ts): a data migration built on the same gate. See
  [Migrate data behind the gate](#migrate-data-behind-the-gate).
- [migration.spec.ts](./migration.spec.ts) and
  [migration.local-test.ts](./migration.local-test.ts): gate retries, draining,
  fencing, resuming and idempotence.

The registration helper appends `{ provide: CommandService, useClass:
ConfigurationCommands }` to the **same registered `CommandModule`**. Its exports,
options, event-handler alias, and inherited constructor dependencies remain
intact. Registering a subclass only in an importing module would leave the
original service inside `CommandModule`. The DI test initializes the real module
and verifies that its event handler and Repository call the same subclass
instance and that the command table is bound correctly. The Repository test
exercises a pending-session read through `getItem`, since Repository reads and
merges commands rather than publishing them.

The test harness mocks AWS collaborators and the TTL configuration lookup; the
local runner uses the real DynamoDB adapter, serialization, command version
validation and async publication lifecycle. It does not exercise streams,
projections, S3 offload or a deployed maintenance workflow. Mock tests alone do
not prove DynamoDB atomicity.
The local acceptance assertion expects `createdAt` to be a `Date`: the real
core DynamoDB adapter restores date fields when reading a stored command.

## Migrate data behind the gate

`ConfigurationMigration.migrate(tenant, options)` changes the stored format from
`{ value }` to `{ schemaVersion: 2, settings: { value } }`:

| Step | What happens | Why |
| --- | --- | --- |
| 1. Close | The gate moves to `active = false`, `mode = migration` and a new generation | New requests fail, and requests holding an older generation are rejected atomically |
| 2. Drain | Requires no command newer than the data row, and the latest command at `finish:FINISHED`. If the data row has expired, requires every command for the key at `finish:FINISHED` | A command accepted before the close could otherwise overwrite migrated data, or recreate expired data in the old format |
| 3. Migrate | Publishes the new format with `publishSync` under a migration witness | Keeps the command history, version check and history table |
| 4. Verify | Rereads the data row with a consistent read | Reopens only if the stored data is what was written |
| 5. Reopen | Moves the gate back to `normal` if it still holds the generation from step 1 | Reopening also rejects anything holding an older generation |

The migration command passes through the same hook. It needs the gate **closed at
the held generation**, while requests need it open, so neither can write under the
other's state. If another controller moves the gate, the migration command is
rejected and the gate is not reopened.

Every failure leaves the gate closed, which stops updates rather than risking
mixed data. A deleted configuration stays deleted. The application keeps writing
either format because data can be in the old format until a tenant has been migrated.

### Recover from a failure

Call `migrate` again after fixing the cause. It keeps the generation it holds,
skips data that is already migrated, and adds no command when nothing changes.

There are two exceptions: `Configuration command failed`, and
`have not drained` for a command that never finishes. A process that dies after
persisting a command leaves it at its starting status, so that message shows the
command and status to inspect. Wait for as long as your pipeline normally takes and
confirm that the writer has stopped. Rerunning cannot clear these commands, and core
cannot publish the same version twice, so resolve them first while the gate stays
closed:

| Blocking command `@N` | What to do | Then |
| --- | --- | --- |
| The migration wrote it, and the data row is **below** `N` or missing | Delete the command row. No data was applied, so this only removes the attempt | Call `migrate` |
| The data row is **at** `N` | Repair what failed, such as a custom data sync handler, then set the status with `commands.updateStatus(key, 'finish:FINISHED')` | Call `migrate` |
| A normal request wrote it | Decide per application. Deleting it discards an update that was accepted | Call `migrate` |

Command rows are the audit log, so record what you changed and why.

This example has limits that a production migration must address:

- It writes no log and sends no alert. A failure leaves updates blocked, so the
  controller must alert on it. Errors are plain messages for reading, not a typed
  API to branch on.
- It migrates one key per tenant. Real data needs a key list or scan, resumable
  progress, and a drain check for every key.
- `migrate` does not wait or poll. A controller should retry later when commands
  have not drained.
- It assumes one controller at a time and has no authorization. A resuming
  controller reuses the held generation, so the fence does not stop it from racing
  an earlier run that is still alive. Use a lock, protect the controller, and never
  expose it to a request path.
- A closed gate blocks only the keys that the hook protects. Other writers,
  including anything writing to the data table directly, need their own controls.
- Only the configuration data row is verified. Projections from custom data sync
  handlers and external side effects need their own checks.
- The local tests stand in for the stream pipeline by writing the data row and
  status directly, so the deployed pipeline is not exercised.

## Trust boundary and operational limits

Only trusted server code chooses the authenticated tenant, resource key and
operation; validate the new value before calling `update`. Do not expose raw
command inputs, the context provider, gate generation or bypass flags in a
request DTO. `AsyncLocalStorage` separates concurrent server operations; it is
not itself an authorization system. Await the operation within its capture
scope. Workers must capture before reading/building their work too.

The hook must **not** read a fresh witness: that would reauthorize an old payload
after reopening. Do not retry a rejected payload with a refreshed generation.
A new attempt must capture again, reread current state and rebuild the update.
The `transition` helper in the local test illustrates an atomic generation
increment, not an administrator-facing maintenance API.

This official extension preserves the normal serializer, S3 offload, TTL,
session and history behavior. Default core behavior remains no checks. A dirty
check that finds no change skips admission because it creates no command.
Previously accepted work can still drain: close admission, coordinate/drain
accepted work, then migrate; reopening alone does not complete maintenance.
Witness and command tables must participate in the same account/Region
transaction, and the witness table needs `dynamodb:ConditionCheckItem`. A rejected
write can leave an S3 object uploaded before the transaction; plan orphan
retention/cleanup. See [boundary and operational details](../../docs/development/command-admission.md#boundary-and-lifecycle).

A gate that is already closed fails in `capture` with a plain `Configuration
updates are unavailable` error, before anything is read. A stale generation, or a
gate that closes after `capture`, surfaces as `CommandAdmissionRejectedException`
(HTTP 409), which is distinct from an ordinary version conflict. Every command in this example
checks one tenant-wide gate, so concurrent updates may also fail with
`CommandAdmissionContentionException` (HTTP 503) on the DynamoDB service, even
though DynamoDB Local does not reproduce it. See
[rejections and HTTP responses](../../docs/development/command-admission.md#rejections-and-http-responses)
and [capacity and contention](../../docs/development/command-admission.md#capacity-and-contention).

Potential adaptations also include stale-job or lease-owner fencing, and approval/authorization revocation. Each needs an
authoritative, atomically updated witness and suitable scope. Lease changes
must advance a fencing token; revocation must change the checked authorization
witness. External side effects, previously accepted work, and authorization in
other stores/Regions require additional coordination—the hook alone does not
make those operations safe.
