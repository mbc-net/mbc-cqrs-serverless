import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import {
  ITaskQueueEventFactory,
  TASK_QUEUE_EVENT_FACTORY,
  TaskEntity,
  TaskService,
  TaskStatusEnum,
} from '..'
import { StepFunctionTaskEvent } from './task.sfn.event'
import { TaskSfnEventHandler } from './task.sfn.event.handler'
import {
  EventBus,
  EventHandler,
  IEventHandler,
} from '@mbc-cqrs-serverless/core'
import { createMock } from '@golevelup/ts-jest'

class TestSfnTaskEvent extends StepFunctionTaskEvent {}

@EventHandler(TestSfnTaskEvent)
export class TestSfnTaskEventHandler
  implements IEventHandler<TestSfnTaskEvent>
{
  async execute(event: TestSfnTaskEvent): Promise<any> {
    return `Result after process`
  }
}

describe('TaskSfnEventHandler', () => {
  let handler: TaskSfnEventHandler
  let taskService: TaskService
  let eventBus: EventBus
  let logger: Logger

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskSfnEventHandler,
        TestSfnTaskEventHandler,
        {
          provide: TASK_QUEUE_EVENT_FACTORY,
          useValue: createMock<ITaskQueueEventFactory>({
            transformStepFunctionTask: async (event) => [
              new TestSfnTaskEvent(event),
            ],
          }),
        },
        EventBus,
      ],
    })
      .useMocker(createMock)
      .compile()

    handler = module.get<TaskSfnEventHandler>(TaskSfnEventHandler)
    handler.onModuleInit()
    // taskService = module.get<TaskService>(TaskService)
    // eventBus = module.get<EventBus>(EventBus)
    // logger = module.get<Logger>(Logger)
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  describe('execute', () => {
    it('should execute the task sfn event handler', async () => {
      const event = new StepFunctionTaskEvent({
        input: new TaskEntity({
          id: 'SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF#4',
          pk: 'SFN_TASK#mbc',
          sk: 'test#01JKT45QNNBKJ9BEBHR3CXABYF#4',
          version: 0,
          code: '01JKT45RYBG2CJDRBVMB087PD2',
          type: 'test',
          name: 'test',
          tenantCode: 'mbc',
          status: TaskStatusEnum.CREATED,
          input: {
            key: 'value5',
          },
          requestId: 'f10b2bb6-a8ff-4353-a17e-1f24613b8474',
          createdAt: new Date('2025-02-11T09:06:51.980Z'),
          updatedAt: new Date('2025-02-11T09:06:51.980Z'),
          createdBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
          updatedBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
          createdIp: '117.7.238.234',
          updatedIp: '117.7.238.234',
        }),
        context: {
          Execution: {
            Id: 'arn:aws:states:ap-northeast-1:101010101010:execution:dev-task-sfn-interation-map-sfn-task-handler:SFN_TASK-mbc-test-01JKT45QNNBKJ9BEBHR3CXABYF-1739264812217',
            Input: [
              {
                id: 'SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF#0',
                pk: 'SFN_TASK#mbc',
                sk: 'test#01JKT45QNNBKJ9BEBHR3CXABYF#0',
                version: 0,
                code: '01JKT45RYAGH2055FBC3Q9HB28',
                type: 'test',
                name: 'test',
                tenantCode: 'mbc',
                status: 'CREATED',
                input: {
                  key: 'value1',
                },
                requestId: 'f10b2bb6-a8ff-4353-a17e-1f24613b8474',
                createdAt: '2025-02-11T09:06:51.978Z',
                updatedAt: '2025-02-11T09:06:51.978Z',
                createdBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                updatedBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                createdIp: '117.7.238.234',
                updatedIp: '117.7.238.234',
              },
              {
                id: 'SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF#1',
                pk: 'SFN_TASK#mbc',
                sk: 'test#01JKT45QNNBKJ9BEBHR3CXABYF#1',
                version: 0,
                code: '01JKT45RYBTMAGTMPNG9ZRX84G',
                type: 'test',
                name: 'test',
                tenantCode: 'mbc',
                status: 'CREATED',
                input: {
                  key: 'value2',
                },
                requestId: 'f10b2bb6-a8ff-4353-a17e-1f24613b8474',
                createdAt: '2025-02-11T09:06:51.979Z',
                updatedAt: '2025-02-11T09:06:51.979Z',
                createdBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                updatedBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                createdIp: '117.7.238.234',
                updatedIp: '117.7.238.234',
              },
              {
                id: 'SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF#2',
                pk: 'SFN_TASK#mbc',
                sk: 'test#01JKT45QNNBKJ9BEBHR3CXABYF#2',
                version: 0,
                code: '01JKT45RYB66FJ1RW6HGGAMHAM',
                type: 'test',
                name: 'test',
                tenantCode: 'mbc',
                status: 'CREATED',
                input: {
                  key: 'value3',
                },
                requestId: 'f10b2bb6-a8ff-4353-a17e-1f24613b8474',
                createdAt: '2025-02-11T09:06:51.979Z',
                updatedAt: '2025-02-11T09:06:51.979Z',
                createdBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                updatedBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                createdIp: '117.7.238.234',
                updatedIp: '117.7.238.234',
              },
              {
                id: 'SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF#3',
                pk: 'SFN_TASK#mbc',
                sk: 'test#01JKT45QNNBKJ9BEBHR3CXABYF#3',
                version: 0,
                code: '01JKT45RYB5SJZYJ8ENPVNX50R',
                type: 'test',
                name: 'test',
                tenantCode: 'mbc',
                status: 'CREATED',
                input: {
                  key: 'value4',
                },
                requestId: 'f10b2bb6-a8ff-4353-a17e-1f24613b8474',
                createdAt: '2025-02-11T09:06:51.979Z',
                updatedAt: '2025-02-11T09:06:51.979Z',
                createdBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                updatedBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                createdIp: '117.7.238.234',
                updatedIp: '117.7.238.234',
              },
              {
                id: 'SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF#4',
                pk: 'SFN_TASK#mbc',
                sk: 'test#01JKT45QNNBKJ9BEBHR3CXABYF#4',
                version: 0,
                code: '01JKT45RYBG2CJDRBVMB087PD2',
                type: 'test',
                name: 'test',
                tenantCode: 'mbc',
                status: 'CREATED',
                input: {
                  key: 'value5',
                },
                requestId: 'f10b2bb6-a8ff-4353-a17e-1f24613b8474',
                createdAt: '2025-02-11T09:06:51.980Z',
                updatedAt: '2025-02-11T09:06:51.980Z',
                createdBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                updatedBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                createdIp: '117.7.238.234',
                updatedIp: '117.7.238.234',
              },
              {
                id: 'SFN_TASK#mbc#test#01JKT45QNNBKJ9BEBHR3CXABYF#5',
                pk: 'SFN_TASK#mbc',
                sk: 'test#01JKT45QNNBKJ9BEBHR3CXABYF#5',
                version: 0,
                code: '01JKT45RYCGBGHA5XVXRHC2BV9',
                type: 'test',
                name: 'test',
                tenantCode: 'mbc',
                status: 'CREATED',
                input: {
                  key: 'value6',
                },
                requestId: 'f10b2bb6-a8ff-4353-a17e-1f24613b8474',
                createdAt: '2025-02-11T09:06:51.980Z',
                updatedAt: '2025-02-11T09:06:51.980Z',
                createdBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                updatedBy: 'e774caf8-0051-70e2-5f63-272f041b56a9',
                createdIp: '117.7.238.234',
                updatedIp: '117.7.238.234',
              },
            ],
            StartTime: '2025-02-11T09:06:52.344Z',
            Name: 'SFN_TASK-mbc-test-01JKT45QNNBKJ9BEBHR3CXABYF-1739264812217',
            RoleArn:
              'arn:aws:iam::101010101010:role/Devsfn-task-infraInfraSta-taskhandlerstatemachineRo-WP2YT2ahoiHk',
          },
          StateMachine: {
            Id: 'arn:aws:states:ap-northeast-1:101010101010:stateMachine:dev-task-sfn-interation-map-sfn-task-handler',
            Name: 'dev-task-sfn-interation-map-sfn-task-handler',
          },
          State: {
            Name: 'iterator',
            EnteredTime: '2025-02-11T09:07:23.008Z',
            RetryCount: 0,
          },
        },
        source:
          'arn:aws:states:ap-northeast-1:101010101010:stateMachine:dev-task-sfn-interation-map-sfn-task-handler',
      })

      // taskService.updateStatus.mockResolvedValue()
      // taskService.updateSubTaskStatus.mockResolvedValue()
      // eventBus.execute.mockResolvedValue()

      await handler.execute(event)

      // expect(logger.debug).toHaveBeenCalledTimes(1)
      // expect(taskService.updateStatus).toHaveBeenCalledTimes(1)
      // expect(taskService.updateSubTaskStatus).toHaveBeenCalledTimes(1)
      // expect(eventBus.execute).toHaveBeenCalledTimes(1)
    })
  })
})
