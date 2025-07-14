import { TaskModule } from '@mbc-cqrs-serverless/task'
import { Module } from '@nestjs/common'

import { TaskQueueEventFactory } from './event/task-queue-event-factory'
import { MyTaskController } from './my-task.controller'
import { MyTaskService } from './my-task.service'

@Module({
  imports: [
    TaskModule.register({
      taskQueueEventFactory: TaskQueueEventFactory,
    }),
  ],
  providers: [MyTaskService],
  controllers: [MyTaskController],
  exports: [TaskModule],
})
export class CustomTaskModule {}
