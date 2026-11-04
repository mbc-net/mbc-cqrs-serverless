# Command admission implementation validation

Worktree: `/Users/koichi.murakami/code/ai-support-agent/ai-support-agent/.claude/codex-requests/environment-unification-r2a/framework-worktree`

Branch: `feature/command-admission-conditions`; initial HEAD:
`f4e851b9673ddb3cd30584989d5955cd5a3eb158`. Initial working tree was clean.
Validation date: November 5, 2026 (JST). Node 24.22.0, npm 11.19.1.
The explicitly designated existing worktree was reused. No subagents were used.

## Changed files

- `packages/core/src/commands/command.service.ts`: protected hook and common initial persistence boundary.
- `packages/core/src/data-store/dynamodb.service.ts`: validated conditional transaction adapter using the existing serializer.
- `packages/core/src/commands/command.service.spec.ts`: adapt the existing in-memory persistence mock to the new adapter.
- `packages/core/src/commands/command-admission.spec.ts`: publisher/duplicate/partial paths, default behavior, failure boundaries, downstream ordering and accepted-command TTL/drain behavior.
- `packages/core/src/data-store/dynamodb-admission.spec.ts`: transaction composition, default Put, 99/100 limits, malformed checks, rejection propagation and S3 size boundaries.
- `packages/core/test/e2e/command-admission.e2e-spec.ts`: isolated real DynamoDB Local test.
- `packages/core/test/jest-admission-local.json`: independent runner without destructive posttest lifecycle hooks.
- `docs/development/command-admission.md`: developer contract and operational guidance.
- `docs/development/command-admission-validation.md`: this validation record.

## Commands and results

Dependency installation:

- `npm ci --ignore-scripts --no-audit --no-fund`: failed on existing npm peer resolution (`picomatch@4.0.5` versus `4.0.7`).
- `npm ci --ignore-scripts --no-audit --no-fund --legacy-peer-deps`: passed, 2337 packages installed into this worktree. No manifest/lockfile/version changes.

Baseline:

```sh
NODE_ENV=test ./node_modules/.bin/jest --runInBand --silent packages/core/src/commands/command.service.spec.ts packages/core/src/data-store/dynamodb.service.spec.ts
```

Passed: 2 suites, 56 tests before production implementation changes.

Test-first red:

```sh
NODE_ENV=test ./node_modules/.bin/jest --runInBand --silent packages/core/src/commands/command-admission.spec.ts packages/core/src/data-store/dynamodb-admission.spec.ts
```

The new tests preceded implementation. Both suites failed TypeScript compilation
because `putItemWithConditions` did not exist. An attempted runtime red with
`--globals '{"ts-jest":{"diagnostics":false}}'` initially exhausted memory due
to an unbounded deep mock in the partial-async latest-item lookup. Explicitly
mocking that lookup resolved the test harness defect. The first green attempt
had the same harness issue before that correction.

After fixing the harness, the original HEAD versions of the two production
files were temporarily materialized and restored with a `finally` block to
verify runtime red using the same command plus the diagnostics flag. Result:
42 failed, 1 passed (hook not called/new adapter absent). No git reset or stash
was used. Final validation restored normal TypeScript diagnostics.

Final targeted green:

```sh
NODE_ENV=test ./node_modules/.bin/jest --runInBand --silent packages/core/src/commands/command-admission.spec.ts packages/core/src/data-store/dynamodb-admission.spec.ts packages/core/src/commands/command.service.spec.ts packages/core/src/data-store/dynamodb.service.spec.ts
```

Passed: **4 suites, 99 tests**.

Broader core regression:

```sh
NODE_ENV=test ./node_modules/.bin/jest --runInBand --silent packages/core/src
```

94 suites passed, 1 failed; 2365 tests passed, 44 skipped, 17 failed. The failed
suite was `nestjs-platform-express-behavior.spec.ts`: sandbox `listen EPERM`
prevented Supertest from opening a local server, followed by null-address errors.
This broader run preceded the six additional default-contract/session assertions;
the final targeted run includes those assertions. No complete all-green core
suite or coverage-threshold result is claimed.

Build and lint:

```sh
npm run build --workspace @mbc-cqrs-serverless/core
./node_modules/.bin/eslint packages/core/src/commands/command.service.ts packages/core/src/data-store/dynamodb.service.ts
./node_modules/.bin/eslint --no-ignore --parser-options '{"project":null}' packages/core/src/commands/command-admission.spec.ts packages/core/src/data-store/dynamodb-admission.spec.ts packages/core/test/e2e/command-admission.e2e-spec.ts
git diff --check
```

All passed on the final implementation. Tests are excluded by repository ESLint
configuration and production tsconfig; the new test files were explicitly linted
without type-aware parsing and unit tests were compiled by ts-jest. An initial
attempt to force type-aware ESLint on test files failed because those files are
excluded from tsconfig. The pre-existing `command.service.spec.ts` remains under
repository test-file lint exclusions; its added mock was exercised by Jest.
Only affected production/new test files were ESLint-fixed; no repository-wide
lint/fix command was used.

## Real DynamoDB status: not executed against a database

The local integration runner was invoked:

```sh
./node_modules/.bin/jest --config packages/core/test/jest-admission-local.json --runInBand
```

It compiled, then failed in setup with `connect EPERM 127.0.0.1:18765`. No table
was created and no database assertions executed. Docker access was also denied
(`docker version --format '{{.Server.Version}}'`). Java 21 is available, but
fetching the DynamoDB Local archive with
`curl --fail --location --max-time 60 https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz -o /tmp/r2a-dynamodb-local/archive.tar.gz`
failed DNS resolution. Existing local harness files were inspected; their
port-8000 download/start and destructive posttest scripts were not run.

Run the independent local test in an environment permitting loopback networking
before relying on real DynamoDB transaction verification. No cloud request,
deployment mutation, publish, commit, push, stash, or reset was performed.

## Review and limits

One final MBC code-review pass inspected the production diff, new tests and
English documentation after test-harness corrections. No confirmed CRITICAL,
HIGH or MEDIUM implementation defect remained. Review checked that all three
initial writes share the boundary, partial delegates retain their behavior,
serializer/S3 code is reused, errors escape before downstream writes, and TTL,
status/task and drain paths remain outside admission.

Validation is limited by the sandbox networking failures above; this is not a
claim of fully verified real-DynamoDB behavior. S3 orphans on rejected persistence
remain possible by design. Application policy and deployment permissions are
not implemented. This is the core extension foundation, not completion of R2a.

## Parent verification after sandbox restrictions were lifted (2026-11-05)

The parent ran the existing local integration suite against a dedicated in-memory Docker DynamoDB Local at 127.0.0.1:18765. Result: 1 suite / 1 test passed; stale-generation rejection and immutable command preservation were verified on real DynamoDB Local. No cloud endpoint or credentials were used.

The broader core suite was rerun with localhost test-server permissions: `NODE_ENV=test ./node_modules/.bin/jest --maxWorkers=4 --silent packages/core/src`. Result: 95 suites passed, 2388 tests passed, 44 skipped, 19 snapshots passed. This supersedes the earlier EPERM limitation above.

An independent reviewer reran the targeted 99 tests and found no confirmed CRITICAL/HIGH/MEDIUM defects. The two production source files at the baseline are byte-equivalent to v1.5.0. Application integration and package publication remain pending.
