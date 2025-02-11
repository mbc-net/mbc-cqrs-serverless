import { DataStoreModule, QueueModule } from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { SubTaskQueueEventHandler } from './event/sub-task.queue.event.handler'
import { TaskEventHandler } from './event/task.event.handler'
import { TaskQueueEventHandler } from './event/task.queue.event.handler'
import { TaskSfnEventHandler } from './event/task.sfn.event.handler'
import { TaskController } from './task.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
  TASK_QUEUE_EVENT_FACTORY,
} from './task.module-definition'
import { TaskService } from './task.service'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [
    TaskService,
    TaskEventHandler,
    TaskQueueEventHandler,
    TaskSfnEventHandler,
    SubTaskQueueEventHandler,
  ],
  exports: [TaskService, SubTaskQueueEventHandler],
})
export class TaskModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    if (!module.providers) {
      module.providers = []
    }
    module.providers.push({
      provide: TASK_QUEUE_EVENT_FACTORY,
      useClass: options.taskQueueEventFactory,
    })

    if (options.enableController) {
      if (!module.controllers) {
        module.controllers = []
      }
      module.controllers.push(TaskController)
    }

    return {
      ...module,
    }
  }
}
