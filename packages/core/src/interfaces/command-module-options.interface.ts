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
  /**
   * Whether `dataSyncHandlers` are registered as providers of CommandModule
   * itself. Defaults to `true` (backward compatible).
   *
   * Set to `false` when the handlers are provided by the importing (domain)
   * module instead — e.g. when they inject a token such as `PRISMA_SERVICE`
   * that only exists in the domain module's scope. CommandService still resolves
   * them globally via `ModuleRef.get(HandlerClass, { strict: false })`.
   */
  registerHandlerProviders?: boolean
  /**
   * Whether to register the `<tableName>_CommandEventHandler` alias provider
   * that the Step Functions data-sync pipeline resolves. Defaults to `true`.
   *
   * Set to `false` on a module that shares a physical table already owned by
   * another module (which registers the alias), to avoid a duplicate-alias
   * collision. Exactly one module per table must register the alias.
   */
  registerEventHandlerAlias?: boolean
}
