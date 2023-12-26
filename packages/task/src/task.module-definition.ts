import { ConfigurableModuleBuilder } from '@nestjs/common'
import { Type } from '@nestjs/common'

import { ITaskQueueEventFactory } from './event/task.queue.event-factory.interface'

export interface TaskModuleOptions {
  taskQueueEventFactory: Type<ITaskQueueEventFactory>
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<TaskModuleOptions>().build()
