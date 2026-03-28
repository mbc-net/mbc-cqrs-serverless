/**
 * How import publishes commands to CommandService for CSV / queue import paths.
 *
 * **ASYNC (default)** — Uses `publishAsync` / `publishPartialUpdateAsync`. Commands are
 * written for the normal orchestrated pipeline (e.g. Step Functions) where completion is
 * asynchronous relative to the importer Lambda.
 *
 * **SYNC** — Uses `publishSync` / `publishPartialUpdateSync`. Runs the full command
 * pipeline **inline in the same Lambda invocation** (command → TTL → history → data →
 * sync handlers → status). It does **not** wait on a separate Step Functions execution;
 * it **bypasses** that async orchestration by executing handlers synchronously.
 *
 * **CSV Distributed Map batches** — In `csv_rows_handler`, rows in a batch are processed
 * **sequentially**. Each SYNC row awaits `publishSync`, so total duration grows with batch
 * size × per-row latency. Large `ItemBatcher` settings (e.g. 100 rows) combined with
 * SYNC can exceed the Lambda timeout. Prefer ASYNC for large imports; use SYNC only when
 * batches are small, per-row work is cheap, and you have sized Step Functions batching /
 * Lambda timeout accordingly.
 */
export enum ImportPublishMode {
  SYNC = 'SYNC',
  ASYNC = 'ASYNC',
}
