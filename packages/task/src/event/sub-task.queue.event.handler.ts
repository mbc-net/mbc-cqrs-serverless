import {
  EventHandler,
  IEventHandler,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'

import { TaskStatusEnum } from '../enums/status.enum'
import { TaskService } from '../task.service'
import { SubTaskQueueEvent } from './sub-task.queue.event'

@EventHandler(SubTaskQueueEvent)
export class SubTaskQueueEventHandler
  implements IEventHandler<SubTaskQueueEvent>
{
  private readonly logger = new Logger(SubTaskQueueEventHandler.name)

  constructor(private readonly taskService: TaskService) {}

  async execute(event: SubTaskQueueEvent): Promise<any> {
    this.logger.debug('sub task queue event executing::', event)

    const task = event.subTaskEvent

    const subTasks = await this.taskService.getAllSubTask(task) // children key

    const taskStatus = await this.taskService.formatTaskStatus(subTasks)

    await this.taskService.updateStepFunctionTask(
      {
        pk: task.pk,
        sk: task.sk.split(KEY_SEPARATOR).slice(0, -1).join(KEY_SEPARATOR),
      },
      taskStatus,
      taskStatus.subTaskSucceedCount + taskStatus.subTaskFailedCount ===
        taskStatus.subTaskCount
        ? TaskStatusEnum.COMPLETED
        : TaskStatusEnum.PROCESSING,
    )
  }
}
