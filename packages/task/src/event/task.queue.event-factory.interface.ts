import {
  DefaultEventFactory,
  IEvent,
  KEY_SEPARATOR,
  StepFunctionsEvent,
} from '@mbc-cqrs-serverless/core'
import { SQSEvent } from 'aws-lambda'

import { SubTaskQueueEvent } from './sub-task.queue.event'
import { TaskQueueEvent } from './task.queue.event'
import { StepFunctionTaskEvent } from './task.sfn.event'

export const DEFAULT_TASK_ACTION_QUEUE = 'task-action-queue'
export const DEFAULT_SUB_TASK_STATUS_QUEUE = 'sub-task-status-queue'

export interface ITaskQueueEventFactory<TEvent extends IEvent = any> {
  transformTask?(event: TaskQueueEvent): Promise<TEvent[]>
  transformStepFunctionTask?(event: StepFunctionTaskEvent): Promise<TEvent[]>
}

export class EventFactoryAddedTask extends DefaultEventFactory {
  async transformSqs(event: SQSEvent): Promise<IEvent[]> {
    const curEvents = await super.transformSqs(event)
    const taskEvents = event.Records.map((record) => {
      if (record.eventSourceARN.endsWith(DEFAULT_TASK_ACTION_QUEUE)) {
        const task = new TaskQueueEvent().fromSqsRecord(record)
        // do not handle sub task
        if (task.taskEvent.taskEntity.sk.split(KEY_SEPARATOR).length > 2)
          return undefined
        return task
      }
      if (record.eventSourceARN.endsWith(DEFAULT_SUB_TASK_STATUS_QUEUE)) {
        return new SubTaskQueueEvent().fromSqsRecord(record)
      }
      return undefined
    }).filter((event) => !!event)

    return [...taskEvents, ...curEvents]
  }

  async transformStepFunction(
    event: StepFunctionsEvent<any>,
  ): Promise<IEvent[]> {
    if (event.context.StateMachine.Name.includes('sfn-task')) {
      const sfnTaskEvents = new StepFunctionTaskEvent(event)
      return [sfnTaskEvents]
    }
    return super.transformStepFunction(event)
  }
}
