import { DynamicModule, Module } from '@nestjs/common'

import {
  MasterModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from '../master.module-definition'
import { MyTaskController } from './my-task.controller'
import { MyTaskService } from './my-task.service'

@Module({
  providers: [MyTaskService],
  controllers: [MyTaskController],
})
export class CustomTaskModule {
  /**
   * MasterControllerGuard is resolved in this module, so it needs its own copy
   * of the options to know whether controllerAuth is set.
   */
  static register(
    options: Pick<MasterModuleOptions, 'controllerAuth' | 'commonTenantCode'>,
  ): DynamicModule {
    return {
      module: CustomTaskModule,
      providers: [{ provide: MODULE_OPTIONS_TOKEN, useValue: options }],
    }
  }
}
