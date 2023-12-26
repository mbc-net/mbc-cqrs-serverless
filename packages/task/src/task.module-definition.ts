import { ConfigurableModuleBuilder } from '@nestjs/common'
import { Type } from '@nestjs/common'

import { ITaskQueueEventFactory } from './event/task.queue.event-factory.interface'

export const TASK_QUEUE_EVENT_FACTORY = 'TaskQueueEventFactoryInjectToken'

export interface TaskModuleOptions {
  taskQueueEventFactory: Type<ITaskQueueEventFactory>
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<TaskModuleOptions>().build()
