/**
 * @description Defines the configuration for the dynamic ImportModule using ConfigurableModuleBuilder.
 */
import { ConfigurableModuleBuilder, ModuleMetadata, Type } from '@nestjs/common'

import { ImportEntityProfile, IZipFinalizationHook } from './interface'

// --- Injection Tokens for our internal provider maps ---
export const IMPORT_STRATEGY_MAP = 'ImportStrategyMapInjectToken'
export const PROCESS_STRATEGY_MAP = 'ProcessStrategyMapInjectToken'
export const ZIP_FINALIZATION_HOOKS = 'ZipFinalizationHooksInjectToken'

/**
 * The main options object for the ImportModule's `register` method.
 */
export interface ImportModuleOptions {
  /**
   * (Required) An array of profiles, where each profile defines the complete
   * import configuration for a specific entity.
   */
  profiles: ImportEntityProfile[]

  /**
   * (Optional) An array of modules that export the providers needed by the
   * classes in the profiles
   */
  imports?: ModuleMetadata['imports']

  /**
   * (Optional) Enables the built-in `/import` and `/import/csv` endpoints.
   */
  enableController?: boolean

  /**
   * (Optional) Array of ZIP finalization hooks that execute after ZIP import completes.
   * Hooks run in parallel and errors are logged without failing the job.
   */
  zipFinalizationHooks?: Type<IZipFinalizationHook>[]
}

// --- Configurable Module Setup ---
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<ImportModuleOptions>()
    // The module will always be configured with the profiles array.
    .setExtras<{ profiles: ImportEntityProfile[] }>(
      { profiles: [] },
      (definition, extras) => ({
        ...definition,
        profiles: extras.profiles,
      }),
    )
    .build()
