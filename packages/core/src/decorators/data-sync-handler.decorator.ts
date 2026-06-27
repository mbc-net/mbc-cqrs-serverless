import 'reflect-metadata'

import { DATA_SYNC_HANDLER_METADATA } from './constants'

/**
 * Marks a class as a DataSyncHandler for the specified command table.
 *
 * @param commandTableName - The raw table name as passed to `CommandModule.register({ tableName })`.
 *   Do NOT use the fully-qualified table name (e.g. "dev-my-table-command").
 *   Pass the same raw value as in the `register()` call (e.g. "my-table").
 *   A wrong name silently prevents handler discovery with no error or warning.
 *
 * Recommended usage: prefer `CommandModule.register({ dataSyncHandlers: [MyHandler] })` as the
 * primary registration path. Use this decorator only when auto-discovery across modules is needed.
 * Mixing both paths for the same handler class causes duplicate registration (guarded by
 * CommandService which logs a warning and deduplicates).
 *
 * **Minification warning:** The async (Step Functions) execution path identifies handlers by
 * `constructor.name` at runtime. If you bundle with esbuild, webpack + terser, or any minifier,
 * you MUST enable class-name preservation (e.g. `keepNames: true` in esbuild,
 * `keep_classnames: true` in terser). Without it, class names are mangled and the `SYNC_DATA`
 * state cannot locate handlers, causing `SyncDataHandler empty!` errors for every command.
 */
export const DataSyncHandler = (commandTableName: string): ClassDecorator => {
  return (target: object) => {
    Reflect.defineMetadata(DATA_SYNC_HANDLER_METADATA, commandTableName, target)
  }
}
