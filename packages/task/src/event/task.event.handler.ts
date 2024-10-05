import {
  EventHandler,
  IEventHandler,
  SnsService,
} from '@mbc-cqrs-sererless/core'
import { Logger } from '@nestjs/common'

import { TaskStatusEnum } from '../enums/status.enum'
import { TaskService } from '../task.service'
import { TASK_EVENT_ACTION, TaskEvent } from './task.event'

@EventHandler(TaskEvent)
export class TaskEventHandler implements IEventHandler<TaskEvent> {
  private readonly logger = new Logger(TaskEventHandler.name)

  constructor(
    private readonly snsService: SnsService,
    private readonly taskService: TaskService,
  ) {}

  async execute(event: TaskEvent): Promise<any> {
    this.logger.debug('task event executing::', event)
    // publish event to sns
    await this.snsService.publish({ action: TASK_EVENT_ACTION, ...event })

    return await this.taskService.updateStatus(
      event.taskKey,
      TaskStatusEnum.QUEUED,
    )
  }
}
