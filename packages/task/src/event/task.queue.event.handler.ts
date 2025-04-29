import {
  EventBus,
  EventHandler,
  IEventHandler,
  StepFunctionService,
} from '@mbc-cqrs-serverless/core'
import { Inject, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'

import { TaskTypesEnum } from '../enums'
import { TaskStatusEnum } from '../enums/status.enum'
import { TASK_QUEUE_EVENT_FACTORY } from '../task.module-definition'
import { TaskService } from '../task.service'
import { TaskQueueEvent } from './task.queue.event'
import { ITaskQueueEventFactory } from './task.queue.event-factory.interface'

@EventHandler(TaskQueueEvent)
export class TaskQueueEventHandler
  implements IEventHandler<TaskQueueEvent>, OnModuleInit
{
  private readonly logger = new Logger(TaskQueueEventHandler.name)
  // We can not inject event module here because of event source can be disabled
  private eventBus: EventBus
  private readonly sfnTaskArn: string

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly taskService: TaskService,
    @Inject(TASK_QUEUE_EVENT_FACTORY)
    private readonly eventFactory: ITaskQueueEventFactory,
    private readonly configService: ConfigService,
    private readonly sfnService: StepFunctionService,
  ) {
    this.sfnTaskArn = this.configService.get<string>('SFN_TASK_ARN', '')
  }

  onModuleInit() {
    const enableEventSourceModule = process.env.EVENT_SOURCE_DISABLED !== 'true'
    if (enableEventSourceModule) {
      this.eventBus = this.moduleRef.get(EventBus, { strict: false })
    }
  }

  async execute(event: TaskQueueEvent): Promise<any> {
    this.logger.debug('task queue event executing::', event)

    if (event.taskEvent.taskKey.pk.startsWith(TaskTypesEnum.SFN_TASK)) {
      await this.handleStepFunctionTask(event)
    } else {
      await this.handleTask(event)
    }
  }

  async handleTask(event: TaskQueueEvent): Promise<any> {
    const taskKey = event.taskEvent.taskKey
    this.logger.debug('task key: ', taskKey)

    try {
      await this.taskService.updateStatus(taskKey, TaskStatusEnum.PROCESSING)
      const events = await this.eventFactory.transformTask(event)
      const result = await Promise.all(
        events.map((event) => this.eventBus.execute(event)),
      )
      // update status completed
      await this.taskService.updateStatus(taskKey, TaskStatusEnum.COMPLETED, {
        result,
      })
    } catch (error) {
      // update status failed
      this.logger.error(error)
      await Promise.all([
        this.taskService.updateStatus(taskKey, TaskStatusEnum.FAILED, {
          error,
        }),
        this.taskService.publishAlarm(event, (error as Error).stack),
      ])
      throw error
    }
  }

  async handleStepFunctionTask(event: TaskQueueEvent): Promise<any> {
    const taskKey = event.taskEvent.taskKey
    this.logger.debug('step function task key: ', taskKey)

    try {
      this.logger.debug('step function task update PROCESSING status')
      await this.taskService.updateStepFunctionTask(
        taskKey,
        {},
        TaskStatusEnum.PROCESSING,
      )

      this.logger.debug('step function task create subtask')

      const subTasks = await this.taskService.createSubTask(event)

      this.logger.debug('step function task has subtask = ', subTasks)

      this.logger.debug('step function task update subtask attr in parent task')

      await this.taskService.updateStepFunctionTask(
        taskKey,
        {
          subTaskCount: subTasks.length,
          subTaskSucceedCount: 0,
          subTaskFailedCount: 0,
          subTaskRunningCount: 0,
          subTasks: subTasks.map((subTask) => ({
            pk: subTask.pk,
            sk: subTask.sk,
            status: subTask.status,
          })),
        },
        TaskStatusEnum.PROCESSING,
      )

      const ddbKey = event.taskEvent.taskKey
      const ddbRecordId = `${ddbKey.pk || 'pk'}-${ddbKey.sk || 'sk'}`
        .replaceAll('#', '-')
        .replace('@', '-v')
        .replace(
          /[^0-9A-Za-z_-]+/g,
          `__${Math.random().toString(36).substring(2, 4)}__`,
        )

      const sfnExecName = `${ddbRecordId}-${Date.now()}`

      this.logger.debug('step function task sfn Exec Name', sfnExecName)

      await this.sfnService.startExecution(
        this.sfnTaskArn,
        subTasks,
        sfnExecName,
      )
    } catch (error) {
      // update status failed
      this.logger.error(error)
      await Promise.all([
        this.taskService.updateStatus(taskKey, TaskStatusEnum.FAILED, {
          error: (error as Error).stack,
        }),
        this.taskService.publishAlarm(event, (error as Error).stack),
      ])
      throw error
    }
  }
}
