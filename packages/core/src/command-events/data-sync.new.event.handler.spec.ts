import { ConfigService } from '@nestjs/config'
import { DataSyncNewCommandEventHandler } from './data-sync.new.event.handler'
import { Test } from '@nestjs/testing'
import { mockClient } from 'aws-sdk-client-mock'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { StepFunctionService } from '../step-func/step-function.service'
import { DynamoDbService } from '../data-store'
import { DataSyncNewCommandEvent } from './data-sync.new.event'
import 'aws-sdk-client-mock-jest'

const dynamoInsertEvent = new DataSyncNewCommandEvent({
  eventSourceARN:
    'arn:aws:dynamodb:ap-northeast-1:undefined:env-app_name-table_name-command',
  awsRegion: 'ddblocal',
  eventID: 'abda71d5-1342-45d5-bb63-9e150345becf',
  eventName: 'INSERT',
  eventVersion: '1.1',
  eventSource: 'aws:dynamodb',
  dynamodb: {
    Keys: { sk: { S: '1726027976@1' }, pk: { S: 'tenantCode#test' } },
    NewImage: {
      code: { S: '1726027976' },
      updatedBy: { S: '92ca4f68-9ac6-4080-9ae2-2f02a86206a4' },
      createdIp: { S: '127.0.0.1' },
      tenantCode: { S: 'tenantCode' },
      source: { S: '[master]:MasterController.publishCommand' },
      type: { S: 'testing' },
      version: { N: '1' },
      createdAt: { S: '2024-09-11T14:36:24+07:00' },
      updatedIp: { S: '127.0.0.1' },
      createdBy: { S: '92ca4f68-9ac6-4080-9ae2-2f02a86206a4' },
      requestId: { S: '03204d78-534b-4019-a7fe-a077096854a5' },
      sk: { S: '1726027976@1' },
      name: { S: '1726027976' },
      attributes: { M: { master: { M: {} } } },
      pk: { S: 'tenantCode#test' },
      id: { S: 'test#1726027976' },
      updatedAt: { S: '2024-09-11T14:36:24+07:00' },
    },
    SequenceNumber: '000000000000000000085',
    SizeBytes: 455,
    StreamViewType: 'NEW_IMAGE',
  },
  source:
    'arn:aws:dynamodb:ap-northeast-1:undefined:env-app_name-table_name-command',
})

const sfnArn = 'arn:aws:states:ap-northeast-1:101010101010:stateMachine:command'

describe('DataSyncNewCommandEventHandler', () => {
  let handler: DataSyncNewCommandEventHandler
  let stepFunctionService: StepFunctionService
  const sfnMock = mockClient(SFNClient)

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DataSyncNewCommandEventHandler,
        StepFunctionService,
        {
          provide: ConfigService,
          useValue: {
            get: () => sfnArn,
          },
        },
        {
          provide: DynamoDbService,
          useValue: {
            getModuleName: () => 'table_name',
          },
        },
      ],
    })
      .overrideProvider(SFNClient)
      .useValue(sfnMock)
      .compile()

    handler = moduleRef.get<DataSyncNewCommandEventHandler>(
      DataSyncNewCommandEventHandler,
    )
    stepFunctionService =
      moduleRef.get<StepFunctionService>(StepFunctionService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    sfnMock.reset()
  })

  it('should trigger step function with the correct start command', () => {
    // Arrange
    const startExecutionSpy = jest.spyOn(stepFunctionService, 'startExecution')
    // Action
    handler.execute(dynamoInsertEvent)

    // Assert
    expect(startExecutionSpy).toHaveBeenCalledWith(
      sfnArn,
      dynamoInsertEvent,
      expect.stringMatching(/table_name-tenantCode-test-1726027976-v1-.*/),
    )
    expect(sfnMock).toHaveReceivedCommandTimes(StartExecutionCommand, 1)
    expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
      stateMachineArn: sfnArn,
      name: expect.stringMatching(
        /table_name-tenantCode-test-1726027976-v1-.*/,
      ),
      input: JSON.stringify(dynamoInsertEvent),
    })
  })

  it('should warn and return undefined when state machine does not exist', async () => {
    // Arrange
    const error = new Error('State Machine Does Not Exist')
    error.name = 'StateMachineDoesNotExist'
    sfnMock.on(StartExecutionCommand).rejects(error)

    const warnSpy = jest.spyOn(handler['logger'], 'warn')

    // Action
    const result = await handler.execute(dynamoInsertEvent)

    // Assert
    expect(result).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('State machine not found'),
    )
  })

  it('should rethrow other errors', async () => {
    // Arrange
    const error = new Error('Some other error')
    error.name = 'InternalError'
    sfnMock.on(StartExecutionCommand).rejects(error)

    // Action & Assert
    await expect(handler.execute(dynamoInsertEvent)).rejects.toThrow(
      'Some other error',
    )
  })
})
