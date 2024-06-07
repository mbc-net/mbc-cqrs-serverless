import { DefaultEventFactory, IEvent } from '@mbc-cqrs-severless/core'
import { SQSEvent } from 'aws-lambda'

import { TaskQueueEvent } from './task.queue.event'

export const DEFAULT_TASK_ACTION_QUEUE = 'task-action-queue'

export interface ITaskQueueEventFactory<TEvent extends IEvent = any> {
  transformTask(event: TaskQueueEvent): Promise<TEvent[]>
}

export class EventFactoryAddedTask extends DefaultEventFactory {
  async transformSqs(event: SQSEvent): Promise<IEvent[]> {
    const curEvents = await super.transformSqs(event)
    const taskEvents = event.Records.map((record) => {
      if (record.eventSourceARN.endsWith(DEFAULT_TASK_ACTION_QUEUE)) {
        return new TaskQueueEvent().fromSqsRecord(record)
      }
      return undefined
    }).filter((event) => !!event)

    return [...taskEvents, ...curEvents]
  }
}
