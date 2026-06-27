import { Type } from '@nestjs/common'

import { IDataSyncHandler } from './data-sync-handler.interface'

/**
 * Configuration options for CommandModule.
 * Used when importing CommandModule.register() in your application.
 *
 * @example
 * CommandModule.register({
 *   tableName: 'my-table',
 *   dataSyncHandlers: [OrderDataSyncHandler],
 * })
 */
export interface CommandModuleOptions {
  /** DynamoDB table name for command storage */
  tableName: string
  /** If true, skips errors from previous command versions */
  skipError?: boolean
  /**
   * Custom handlers for syncing command data to read models.
   *
   * **Recommended (primary) registration path.**
   * Classes listed here are automatically added as providers and resolved
   * by the NestJS DI container. This path is explicit about module ownership
   * and is fully covered by the duplicate-detection guard in CommandService.
   *
   * Avoid combining this with `@DataSyncHandler` decorator on the same class —
   * that causes duplicate registration (detected and warned at startup).
   */
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  /** If true, disables the default data sync handler */
  disableDefaultHandler?: boolean
}
