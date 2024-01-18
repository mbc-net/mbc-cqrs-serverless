import { ClassConstructor } from 'class-transformer'

import { EnvironmentVariables } from '../env.validation'

export interface AppModuleOptions {
  rootModule: any
  envCls?: ClassConstructor<EnvironmentVariables>
}
