import { Module } from '@nestjs/common'

import { TaskEventHandler } from './event/task.event.handler'
import { TaskQueueEventHandler } from './event/task.queue.event.handler'
import { TaskController } from './task.controller'
import { ConfigurableModuleClass } from './task.module-definition'
import { TaskService } from './task.service'

@Module({
  controllers: [TaskController],
  providers: [TaskService, TaskEventHandler, TaskQueueEventHandler],
  exports: [TaskService],
})
export class TaskModule extends ConfigurableModuleClass {}
