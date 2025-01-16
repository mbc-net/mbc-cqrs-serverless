export interface ModuleOptions {
  /**
   * The name of the module.
   */
  name: string
  /**
   * Flag to indicate if prisma schema is created.
   */
  schema: boolean
  /**
   * Command processing mode
   */
  mode: 'sync' | 'async'
}
