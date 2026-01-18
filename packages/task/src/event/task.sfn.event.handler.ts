import {
  EventBus,
  EventHandler,
  IEventHandler,
} from '@mbc-cqrs-serverless/core'
import { Inject, Logger, OnModuleInit } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'

import { TaskStatusEnum } from '../enums'
import { TASK_QUEUE_EVENT_FACTORY } from '../task.module-definition'
import { TaskService } from '../task.service'
import { ITaskQueueEventFactory } from './task.queue.event-factory.interface'
import { StepFunctionTaskEvent } from './task.sfn.event'

@EventHandler(StepFunctionTaskEvent)
export class TaskSfnEventHandler
  implements IEventHandler<StepFunctionTaskEvent>, OnModuleInit
{
  private readonly logger: Logger = new Logger(TaskSfnEventHandler.name)
  // We cannot inject event module here because of event source can be disabled
  private eventBus: EventBus

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly taskService: TaskService,
    @Inject(TASK_QUEUE_EVENT_FACTORY)
    private readonly eventFactory: ITaskQueueEventFactory,
  ) {}

  onModuleInit() {
    const enableEventSourceModule = process.env.EVENT_SOURCE_DISABLED !== 'true'
    if (enableEventSourceModule) {
      this.eventBus = this.moduleRef.get(EventBus, { strict: false })
    }
  }

  async execute(event: StepFunctionTaskEvent): Promise<any> {
    this.logger.debug('executing::', event)

    const taskKey = event.taskKey
    this.logger.debug('sfn task key: ', taskKey)

    try {
      await this.taskService.updateSubTaskStatus(
        taskKey,
        TaskStatusEnum.PROCESSING,
      )
      const events = await this.eventFactory.transformStepFunctionTask(event)
      const result = await Promise.all(
        events.map((event) => this.eventBus.execute(event)),
      )
      // update status completed
      await this.taskService.updateSubTaskStatus(
        taskKey,
        TaskStatusEnum.COMPLETED,
        {
          result,
        },
      )
    } catch (error) {
      // update status failed
      this.logger.error(error)
      await Promise.all([
        this.taskService.updateSubTaskStatus(taskKey, TaskStatusEnum.FAILED, {
          error: (error as Error).stack,
        }),
        this.taskService.publishAlarm(event, (error as Error).stack),
      ])
      // throw error // continue sfn regardless of whether they would succeed or fail
    }
  }
}
