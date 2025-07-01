import { ITaskQueueEventFactory } from '@mbc-cqrs-serverless/task'
import { StepFunctionTaskEvent } from '@mbc-cqrs-serverless/task'
import { Logger } from '@nestjs/common'

import { MasterSfnTaskEvent } from '../../master/handler/master-sfn-task.event'

export class TaskQueueEventFactory implements ITaskQueueEventFactory {
  private readonly logger = new Logger(TaskQueueEventFactory.name)

  async transformStepFunctionTask(
    event: StepFunctionTaskEvent,
  ): Promise<any[]> {
    this.logger.debug('Received StepFunctionTaskEvent', event)

    const taskKeySk = event.taskKey.sk
    this.logger.debug(`Evaluating taskKey.sk: ${taskKeySk}`)

    if (taskKeySk.startsWith('MASTER_COPY')) {
      this.logger.debug(`Matched MASTER_COPY_SK_PREFIX (MASTER_COPY)`)
      return [new MasterSfnTaskEvent(event)]
    }

    this.logger.debug(`No matching SK prefix found for: ${taskKeySk}`)
    return []
  }
}
