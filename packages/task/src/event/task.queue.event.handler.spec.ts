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
  ITaskQueueEventFactory,
  SubTaskQueueEvent,
  TASK_QUEUE_EVENT_FACTORY,
  TaskEntity,
  TaskModule,
  TaskQueueEvent,
  TaskQueueEventHandler,
  TaskService,
  TaskStatusEnum,
} from '..'

const sfnTaskEventMessage = {
  messageId: 'bf261744-7735-4881-87b4-5211b282a4b2',
  receiptHandle:
    'AQEBwPzMDUj7xFxEQR+gDavgXPgqBCDsx7Wo5DVyESeDHjo3Hx/MCGD+rYrMFmbgCMzYd2QwJeSm1DXLiRAanSfZJddd0y6jSFMb8T7byIIZ0C4+YnOKqnN1JwnyIJgN8J/vfKHckqP/7VaV4T0203MHR1IexEOAUFq9ZCugSPGBfvcBCwaaOx5/JIWQ73YGVGsj0VS4nLpECrCk/JI5tCvqHM24HEy1TvhS9Yy2TbEvMKpobErL2yukZi9g04UriRbiOdWLBdmeCllNqAMlfAmC2I4O9GfyW6zpfV9+jG18YYq1RfP6iUWj/FndVDUdgJ8PYy6zgsszqZen3Ek+9yR8JhLCsMXqz5pHJ+RzBvLV2s0IBnrjapluhgdw1WOsdab1/8pzMc1XxxoYJO2JgPI4ZaDBFudZkX7oHd+Jkcm5Sbh2bXUYhqQyFLGG7v0pTmgr',
  body: '{"action":"task-execute","eventID":"11431e0681d648c49202560da9915554","eventName":"INSERT","eventVersion":"1.1","eventSource":"aws:dynamodb","awsRegion":"ap-northeast-1","dynamodb":{"ApproximateCreationDateTime":1739264811,"Keys":{"sk":{"S":"test#01JKT45QNNBKJ9BEBHR3CXABYF"},"pk":{"S":"SFN_TASK#mbc"}},"NewImage":{"code":{"S":"01JKT45QNNBKJ9BEBHR3CXABYF"},"updatedBy":{"S":"e774caf8-0051-70e2-5f63-272f041b56a9"},"createdIp":{"S":"117.7.238.234"},"tenantCode":{"S":"mbc"},"type":{"S":"test"},"version":{"N":"0"},"createdAt":{"S":"2025-02-11T18:06:50+09:00"},"input":{"L":[{"M":{"key":{"S":"value1"}}},{"M":{"key":{"S":"value2"}}},{"M":{"key":{"S":"value3"}}},{"M":{"key":{"S":"value4"}}},{"M":{"key":{"S":"value5"}}},{"M":{"key":{"S":"value6"}}}]},"updatedIp":{"S":"117.7.238.234"},"createdBy":{"S":"e774caf8-0051-70e2-5f63-272f041b56a9"},"requestId":{"S":"f10b2bb6-a8ff-4353-a17e-1f24613b8474"},"name":{"S":"test"},"sk":{"S":"test#01JKT45QNNBKJ9BEBHR3CXABYF"},"id":{"S":"SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF"},"pk":{"S":"SFN_TASK#mbc"},"status":{"S":"CREATED"},"updatedAt":{"S":"2025-02-11T18:06:50+09:00"}},"SequenceNumber":"21117700000000082887985843","SizeBytes":559,"StreamViewType":"NEW_IMAGE"},"eventSourceARN":"arn:aws:dynamodb:ap-northeast-1:101010101010:table/dev-task-sfn-iteration-map-tasks/stream/2025-02-07T06:30:08.871","source":"arn:aws:dynamodb:ap-northeast-1:101010101010:table/dev-task-sfn-iteration-map-tasks/stream/2025-02-07T06:30:08.871","_taskEntity":{"code":"01JKT45QNNBKJ9BEBHR3CXABYF","updatedBy":"e774caf8-0051-70e2-5f63-272f041b56a9","createdIp":"117.7.238.234","tenantCode":"mbc","type":"test","version":0,"createdAt":"2025-02-11T18:06:50+09:00","input":[{"key":"value1"},{"key":"value2"},{"key":"value3"},{"key":"value4"},{"key":"value5"},{"key":"value6"}],"updatedIp":"117.7.238.234","createdBy":"e774caf8-0051-70e2-5f63-272f041b56a9","requestId":"f10b2bb6-a8ff-4353-a17e-1f24613b8474","name":"test","sk":"test#01JKT45QNNBKJ9BEBHR3CXABYF","id":"SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF","pk":"SFN_TASK#mbc","status":"CREATED","updatedAt":"2025-02-11T18:06:50+09:00"}}',
  attributes: {
    ApproximateReceiveCount: '1',
    AWSTraceHeader:
      'Root=1-67ab132b-69243920d30d30e185c27f9e;Parent=591b12d741e2a42d;Sampled=1;Lineage=1:df2a4fce:0',
    SentTimestamp: '1739264811834',
    SenderId: 'AIDAIERWYNSNBY7YRB6SY',
    ApproximateFirstReceiveTimestamp: '1739264811842',
  },
  messageAttributes: {
    action: {
      stringValue: 'task-execute',
      stringListValues: [],
      binaryListValues: [],
      dataType: 'String',
    },
  },
  md5OfMessageAttributes: '38ef573d67fecac30c04114d4f6f8f30',
  md5OfBody: '20cb89e3231c549a5eb061ddaafa4bfa',
  eventSource: 'aws:sqs',
  eventSourceARN:
    'arn:aws:sqs:ap-northeast-1:101010101010:dev-task-sfn-iteration-map-task-action-queue',
  awsRegion: 'ap-northeast-1',
}

describe('TaskQueueEventHandler', () => {
  let handler: TaskQueueEventHandler
  let taskService: TaskService

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskQueueEventHandler,
        {
          provide: TASK_QUEUE_EVENT_FACTORY,
          useValue: createMock<ITaskQueueEventFactory>({}),
        },
      ],
    })
      .useMocker(createMock)
      .overrideProvider(TaskService)
      .useValue(createMock<TaskService>())
      .compile()

    handler = module.get<TaskQueueEventHandler>(TaskQueueEventHandler)
    taskService = module.get<TaskService>(TaskService)
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  describe('execute', () => {
    beforeEach(() => {
      jest.restoreAllMocks()
    })

    it('should execute step function task', async () => {
      const event = new TaskQueueEvent().fromSqsRecord(sfnTaskEventMessage)
      jest
        .spyOn(handler, 'handleStepFunctionTask')
        .mockResolvedValue(() => Promise.resolve({}))

      await handler.execute(event)

      expect(handler.handleStepFunctionTask).toHaveBeenCalledTimes(1)
    })
  })
})
