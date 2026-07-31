/**
 * Marker on command records for how the command was applied.
 * {@link CommandSyncMode.SYNC} means synchronous publish (no Step Functions pipeline).
 */
export enum CommandSyncMode {
  SYNC = 'SYNC',
}
