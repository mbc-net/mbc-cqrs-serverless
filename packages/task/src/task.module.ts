import { DynamicModule, Module } from '@nestjs/common'

import { TaskEventHandler } from './event/task.event.handler'
import { TaskQueueEventHandler } from './event/task.queue.event.handler'
import { TaskController } from './task.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
  TASK_QUEUE_EVENT_FACTORY,
} from './task.module-definition'
import { TaskService } from './task.service'

@Module({
  controllers: [TaskController],
  providers: [TaskService, TaskEventHandler, TaskQueueEventHandler],
  exports: [TaskService],
})
export class TaskModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    module.providers.push({
      provide: TASK_QUEUE_EVENT_FACTORY,
      useClass: options.taskQueueEventFactory,
    })

    return {
      ...module,
    }
  }
}
