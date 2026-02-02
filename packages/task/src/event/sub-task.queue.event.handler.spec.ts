import { Test, TestingModule } from '@nestjs/testing'

import { createMock } from '@golevelup/ts-jest'
import {
  DataStoreModule,
  DynamoDbService,
  QueueModule,
  SnsService,
} from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  SubTaskQueueEvent,
  TaskEntity,
  TaskModule,
  TaskService,
  TaskStatusEnum,
} from '..'
import { SubTaskQueueEventHandler } from './sub-task.queue.event.handler'

const tasks = [
  {
    pk: 'SFN_TASK#mbc',
    sk: 'test#01JKSCHHRN0VS7K5H2FWZKK1FH#1',
    status: TaskStatusEnum.COMPLETED,
  },
  {
    pk: 'SFN_TASK#mbc',
    sk: 'test#01JKSCHHRN0VS7K5H2FWZKK1FH#2',
    status: TaskStatusEnum.FAILED,
  },
  {
    pk: 'SFN_TASK#mbc',
    sk: 'test#01JKSCHHRN0VS7K5H2FWZKK1FH#3',
    status: TaskStatusEnum.PROCESSING,
  },
].map(
  (task) =>
    new TaskEntity({
      ...task,
      tenantCode: 'tenant-code',
      attributes: {},
    }),
)

const sqsMessage = {
  messageId: '739f77c1-7c59-49e5-950e-f4124117f2b2',
  receiptHandle: '',
  body: '{"action":"sub-task-status","pk":"SFN_TASK#mbc","sk":"test#01JKSCHHRN0VS7K5H2FWZKK1FH#1","table":"dev-task-sfn-iteration-map-tasks","id":"SFN_TASK#mbc#test#01JKSCHHRN0VS7K5H2FWZKK1FH#1","tenantCode":"mbc","content":{"status":"COMPLETED","attributes":{"result":[["Result after process 7051.110175869866"]]}}}',
  attributes: {
    ApproximateReceiveCount: '1',
    AWSTraceHeader: '',
    SentTimestamp: '1739240041111',
    SenderId: 'AIDAIERWYNSNBY7YRB6SY',
    ApproximateFirstReceiveTimestamp: '1739240041123',
  },
  messageAttributes: {
    action: {
      stringValue: 'sub-task-status',
      stringListValues: [],
      binaryListValues: [],
      dataType: 'String',
    },
  },
  md5OfMessageAttributes: '',
  md5OfBody: '',
  eventSource: 'aws:sqs',
  eventSourceARN:
    'arn:aws:sqs:ap-northeast-1:1010101010:dev-task-sfn-iteration-map-sub-task-status-queue',
  awsRegion: 'ap-northeast-1',
}

describe('SubTaskQueueEventHandler', () => {
  let handler: SubTaskQueueEventHandler
  let taskService: TaskService
  const mockTableName = 'tasks'

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubTaskQueueEventHandler],
    })
      .useMocker(createMock)
      .overrideProvider(TaskService)
      .useValue(createMock<TaskService>())
      .compile()

    handler = module.get<SubTaskQueueEventHandler>(SubTaskQueueEventHandler)
    taskService = module.get<TaskService>(TaskService)
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
    expect(taskService).toBeDefined()
  })

  describe('execute', () => {
    beforeEach(() => {
      jest.resetAllMocks()
    })
    it('should execute the sub task queue event handler', async () => {
      const event = new SubTaskQueueEvent().fromSqsRecord(sqsMessage)

      jest.spyOn(taskService, 'getAllSubTask').mockResolvedValue(tasks)
      jest.spyOn(taskService, 'formatTaskStatus').mockResolvedValue({
        subTaskCount: tasks.length,
        subTaskFailedCount: 1,
        subTaskRunningCount: 1,
        subTaskSucceedCount: 1,
        subTasks: tasks.map((task) => ({
          pk: task.pk,
          sk: task.sk,
          status: task.status,
        })),
      })
      jest.spyOn(taskService, 'updateStepFunctionTask').mockResolvedValue()

      await handler.execute(event)

      expect(taskService.getAllSubTask).toHaveBeenCalledTimes(1)
      expect(taskService.updateStepFunctionTask).toHaveBeenCalledTimes(1)
    })

    it('should update status as PROCESSING if not all sub-tasks are completed', async () => {
      const event = new SubTaskQueueEvent().fromSqsRecord(sqsMessage)

      jest.spyOn(taskService, 'getAllSubTask').mockResolvedValue(tasks)
      const taskStatus = {
        subTaskCount: tasks.length,
        subTaskFailedCount: 1,
        subTaskRunningCount: 1,
        subTaskSucceedCount: 1,
        subTasks: tasks.map((task) => ({
          pk: task.pk,
          sk: task.sk,
          status: task.status,
        })),
      }
      jest.spyOn(taskService, 'formatTaskStatus').mockResolvedValue(taskStatus)

      await handler.execute(event)

      expect(taskService.updateStepFunctionTask).toHaveBeenCalledWith(
        {
          pk: event.subTaskEvent.pk,
          sk: 'test#01JKSCHHRN0VS7K5H2FWZKK1FH',
        },
        taskStatus,
        TaskStatusEnum.PROCESSING,
      )
    })
  })
})
