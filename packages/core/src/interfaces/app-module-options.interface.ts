import { ClassConstructor } from 'class-transformer'

import { EnvironmentVariables } from '../env.validation'

/**
 * Configuration options for the root AppModule.
 * Used when bootstrapping the NestJS application.
 *
 * @example
 * bootstrap({
 *   rootModule: AppModule,
 *   envCls: CustomEnvironmentVariables,
 * })
 */
export interface AppModuleOptions {
  /** The root NestJS module class */
  rootModule: any
  /** Optional custom environment variables class for validation */
  envCls?: ClassConstructor<EnvironmentVariables>
}
