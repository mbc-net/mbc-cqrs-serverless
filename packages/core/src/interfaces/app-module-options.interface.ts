import { EnvironmentVariables } from '../env.validation'

export interface AppModuleOptions {
  rootModule: any
  validateClass: typeof EnvironmentVariables
}
