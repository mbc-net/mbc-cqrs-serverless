# Freeze configuration updates while other commands continue

This small server-side example uses the real `CommandService` extension point
to admit configuration updates only while a tenant's gate is open **and still
at the generation the request originally observed**. Other commands continue.
It is an educational policy, not a maintenance controller or an HTTP server.

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
  witnessTableName: 'configuration-gates', infrastructureImports: [...] })`
  from your application's imports. `tableName` is the core base name; the witness
  name is the full physical table name. Supply existing modules exporting
  `DynamoDbService`, `SessionService`, `S3Service`, `SnsService`, `ConfigService`
  and `StepFunctionService`, or use the application's existing global providers.
- [admission.spec.ts](./admission.spec.ts): verifies ordering, missing/cross-tenant
  witnesses, checks, propagation of failure and real Nest injection.
- [maintenance.local-test.ts](./maintenance.local-test.ts): runnable acceptance,
  stop, close/reopen, unrelated-command and fresh-request demonstrations.

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
transaction and have suitable IAM permissions. A rejected write can leave an
S3 object uploaded before the transaction; plan orphan retention/cleanup.
See [boundary and operational details](../../docs/development/command-admission.md#boundary-and-lifecycle).

Potential adaptations include maintenance/data migration, stale-job or
lease-owner fencing, and approval/authorization revocation. Each needs an
authoritative, atomically updated witness and suitable scope. Lease changes
must advance a fencing token; revocation must change the checked authorization
witness. External side effects, previously accepted work, and authorization in
other stores/Regions require additional coordination—the hook alone does not
make those operations safe.
