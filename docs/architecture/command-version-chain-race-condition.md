# Known Issue: Command Version Chain Can Stall Permanently (`WAIT_PREV_COMMAND` Race Condition)

Status: **Unfixed, confirmed in production-derived data**
Affects: `@mbc-cqrs-serverless/core` (task-token command chaining, introduced in
commit `5e0a3a2` "feat: implement task token management and command chaining
in command service and event handler")
Audience: framework maintainers / contributors working on `packages/core/src/commands`
and `packages/cli/templates/infra/libs/infra-stack.ts` (command-handler state machine)

## Summary

When two or more versions of the same entity are published in quick succession via
`CommandService.publishAsync()`, the mechanism that resumes a version waiting on its
predecessor (`checkNextToken` → `resumeExecution`) can miss its one and only
opportunity to fire. When that happens, the waiting version's Step Functions execution
never advances past `wait_prev_command`, and **every subsequent version of that same
entity piles up behind it, forever** — none of them ever reach `TRANSFORM_DATA` /
`SYNC_DATA`, so the RDS (or other) read-side projection stops receiving updates for
that entity while the DynamoDB command log keeps accepting new versions indefinitely.

This was diagnosed from a real downstream incident: a consumer application's "delete"
button appeared to silently no-op. The DELETE API returned 200 every time, and the
DynamoDB command table showed the delete had been recorded (`isDeleted: true`) — but
the read-side table never updated, so the entity kept reappearing in list views. The
consumer had already retried the delete ~30 times over 7 weeks, each retry adding a
new stuck version on top of the pile, with no error surfaced anywhere.

## The chaining mechanism (as designed)

Each entity version is processed as its own independent Step Functions execution.
State machine (`packages/cli/templates/infra/libs/infra-stack.ts`, `command-handler`):

```
check_version → check_version_result (Choice)
  result=0  → set_ttl_command → history_copy → transform_data → sync_data_all → finish
  result=1  → wait_prev_command → set_ttl_command → ... (same as above)
  result=-1 → fail
```

- **`check_version`** (`CommandEventHandler.checkVersion`,
  `packages/core/src/commands/command.event.handler.ts`): compares the version this
  execution is processing (`commandVersion`) against `1 + data.version` (i.e. the
  version the read-side data table would be at *next*). If they match, the command
  can proceed immediately (`result: 0`). If the command is *ahead* of what the data
  table expects (`nextVersion < commandVersion`) and an older command version still
  exists, it must wait its turn (`result: 1`) — this is what routes it into
  `wait_prev_command`.

- **`wait_prev_command`** is a `WAIT_FOR_TASK_TOKEN` Lambda task
  (`waitConfirmToken` in `command.event.handler.ts`). It stores the SFN task token on
  the DynamoDB command row (`CommandService.updateTaskToken`) and then blocks. No
  `TimeoutSeconds`/`HeartbeatSeconds` is configured on this state
  (`infra-stack.ts`, `waitPrevCommand = lambdaInvoke('wait_prev_command', ...,
  WAIT_FOR_TASK_TOKEN)`), so the execution can sit here indefinitely (bounded only by
  the Standard Workflow's ~1 year execution ceiling).

- **`finish`** (`checkNextToken` in `command.event.handler.ts`): once a version's own
  chain completes, it looks up **exactly one** row — `currentVersion + 1`
  (`CommandService.getNextCommand`, a single `dynamoDbService.getItem`, not a query/
  scan) — and, **only if that row already has a `taskToken` stored**, calls
  `sfnService.resumeExecution(nextCommand.taskToken, ...)` (a `SendTaskSuccess`
  call, `StepFunctionService.resumeExecution` in
  `packages/core/src/step-func/step-function.service.ts`). If the next version
  doesn't exist yet, or exists but hasn't reached `wait_prev_command` yet (no
  `taskToken`), `checkNextToken` just logs a warning/debug line and returns `null`.
  **It is never called again for that pair of versions.**

## The race

`checkNextToken` for version *N* and `waitConfirmToken` for version *N+1* run as two
independent, concurrently-scheduled Step Functions executions with **no
synchronization between them beyond "does the DynamoDB row already have a
`taskToken` at the instant I look"**:

```
version N execution:      ... → sync_data_all → finish → checkNextToken(N+1)
version N+1 execution:    check_version → wait_prev_command → waitConfirmToken (writes taskToken)
```

If `checkNextToken(N+1)` runs **before** version N+1's own execution has reached
`waitConfirmToken` (e.g. version N+1 hasn't even been created yet, or its Lambda
invocation for `check_version`/`wait_prev_command` is still cold-starting / queued),
the resume signal is lost. Version N+1 stores its `taskToken` a moment later, but
nothing is watching for that — the only trigger for a resume is version N's `finish`
step, which already ran and returned `null`.

Once N+1 is stuck, N+2 is affected too, transitively: N+2's `check_version` compares
against `data.version`, which is now frozen at whatever N-1 (or earlier) last wrote,
so `nextVersion < commandVersion` again, and N+2 also routes into
`wait_prev_command`. This repeats for every later version. **The stall is permanent
and grows with every subsequent write to the entity — there is no self-healing path
in the current design.**

This is fundamentally a **fire-once notification with no retry/reconciliation**,
racing against **two independently-scheduled asynchronous executions with no shared
ordering guarantee**. Whether the race is lost depends on Lambda cold-start latency,
DynamoDB Streams/EventBridge propagation delay, and how close together in time the
two `publishAsync()` calls were made — i.e. it is inherently non-deterministic and
cannot be fixed by "just adding a delay" anywhere in application code.

## Evidence from the field

Two entities (`ISSUE` type, downstream `ai-support-agent` application, dev
environment) were found with 20–35 stacked command versions, where:

- Version 1 completed normally (`status: finish:FINISHED`).
- **Every version from 2 onward** was permanently stuck at
  `status: wait_prev_command:FINISHED` (meaning the *wait_prev_command Lambda
  itself* finished successfully — i.e. `waitConfirmToken` ran and stored the
  token — but the **execution** was still `RUNNING` in Step Functions, paused on
  the task token, sometimes for 7+ weeks).
- Every stuck version's DynamoDB row had a `taskToken` populated.
- The read-side (RDS) row was frozen at `version = 1` the entire time, while the
  DynamoDB command log advanced to version 35 / 20 respectively.
- `aws stepfunctions list-executions --status-filter RUNNING` on the same state
  machine returned **676** running executions in that single dev account at time of
  investigation, with the same pattern (`v1123`, `v1122`, ... stacked) visible on
  unrelated `ALERT` entities — indicating this is not an edge case specific to one
  entity type, but a systemic risk for any entity that receives closely-spaced
  `publishAsync()` writes.

## Suggested directions for a fix (not yet implemented, needs design)

None of these have been implemented or validated — they are starting points for
whoever picks this up:

1. **Make `checkNextToken` retry-safe / idempotent-poll instead of fire-once.**
   E.g. a scheduled reconciliation (EventBridge rule + Lambda, or a Step Functions
   retry/wait loop) that periodically scans for command rows with
   `status = wait_prev_command:FINISHED` whose execution is still `RUNNING` and
   whose *previous* version's chain has already finished, then re-attempts
   `resumeExecution`. This closes the window without changing the happy-path
   latency.
2. **Close the window at the source**: have `waitConfirmToken` (N+1) check, right
   after storing its own token, whether version N has *already* finished (i.e. the
   race lost the other way — N finished before N+1 even reached
   `wait_prev_command`) and self-resume if so, instead of relying solely on N's
   `checkNextToken` to find it.
3. **Alarm on stuck chains.** `checkNextToken`'s "no token" branch
   (`command.event.handler.ts`, the `else` in `checkNextToken`) and the
   `wait_prev_command` state having no timeout mean a stuck chain currently
   produces at most a single WARN log line and is otherwise invisible. Consider:
   - Adding `TimeoutSeconds` to the `wait_prev_command` state so executions
     transition to a detectable `TIMED_OUT` status instead of hanging
     indefinitely, and/or
   - A CloudWatch alarm on Step Functions executions exceeding an expected duration
     for this state machine, and/or
   - Publishing to the existing `publishAlarm`/SNS alarm topic
     (`CommandEventHandler.publishAlarm`) when `checkNextToken` finds no next
     command version *and* the current chain's own age suggests something is
     accumulating (this needs a way to distinguish "legitimately no next version
     yet" from "next version exists elsewhere and lost the race" — see the
     `getNextCommand` note below).
4. **Consider whether the per-version-execution model is the right primitive at
   all.** An alternative design: a single long-lived "sequencer" execution per
   entity (or per pk) that pulls the next pending command version itself (poll/
   pop from a queue ordered by version) rather than relying on N-1 to push N
   forward. This removes the two-sided race entirely at the cost of a different
   scaling/concurrency model. Out of scope to design here, but worth evaluating
   before investing further in patching the fire-once notification.

## Operational workaround used in the field (data-repair only, not a code fix)

For the two entities above, the read-side row was repaired directly (bypassing the
stuck chain) rather than resuming it, specifically **because resuming the chain
would have re-executed every intermediate `DataSyncHandler.up()` call for versions
2..N**, including business-logic side effects (e.g. a downstream escalation/
notification handler keyed off status-change diffs) that are not idempotent with
respect to *when* they run — replaying a 7-week-old status transition "live" would
have re-triggered that side effect now. This is a hazard specific to any consumer
whose `DataSyncHandler`s are not purely idempotent replays of past state (most
non-trivial ones aren't), and worth calling out explicitly to anyone advising
"just resume the token" as a fix: it is not always safe.

The steps actually taken (dev environment):

1. Compute the true latest command version and its `isDeleted`/attribute state by
   enumerating **all** command rows for the entity and sorting by the numeric
   `version` attribute — **not** by DynamoDB's lexicographic `sk` string ordering
   (`...@9` sorts after `...@35` lexicographically, which will silently pick the
   wrong "latest" item if you naively take the last item of a `Query` response).
2. Directly update the read-side row to match that final state (here: `is_deleted =
   true`, `version = <latest>`).
3. `StopExecution` (not `SendTaskSuccess`) on every `RUNNING` execution belonging to
   the entity, to clean up the orphaned executions without invoking any
   `DataSyncHandler` code.

This is a manual, per-incident recovery, not a fix for the underlying race — it
does not prevent recurrence for this or any other entity.
