import { createMock } from '@golevelup/ts-jest'
import { Test } from '@nestjs/testing'
import { DynamoDbService, S3Service } from '../data-store'
import { SessionService } from '../data-store/session.service'

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { ConfigService } from '@nestjs/config'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'
import {
  DataSyncCommandSfnEvent,
  StepFunctionStateInput,
} from '../command-events/data-sync.sfn.event'
import { CommandEventHandler } from '../commands/command.event.handler'
import { MODULE_OPTIONS_TOKEN } from '../commands/command.module-definition'
import { DataService } from '../commands/data.service'
import { CommandModel, IDataSyncHandler } from '../interfaces'
import { SnsService } from '../queue/sns.service'
import { ExplorerService } from '../services'
import { CommandService } from './command.service'
import { DataSyncDdsHandler } from './handlers/data-sync-dds.handler'
import { HistoryService } from './history.service'
import { DataSyncCommandSfnName } from '../command-events/sfn-name.enum'
import { CommandStatus, getCommandStatus } from './enums/status.enum'
import { TtlService } from './ttl.service'
import { SnsClientFactory } from '../queue/sns-client-factory'
import { SFNClient } from '@aws-sdk/client-sfn'
import { StepFunctionService } from '../step-func/step-function.service'

export class MockedHandler implements IDataSyncHandler {
  async up(cmd: CommandModel): Promise<any> {
    return 'MockedHandler has been called'
  }
  async down(cmd: CommandModel): Promise<any> {}
}

const createEvent = (
  stepStateName: DataSyncCommandSfnName,
  input?: StepFunctionStateInput,
) =>
  new DataSyncCommandSfnEvent({
    input,
    context: {
      Execution: {
        Id: 'arn:aws:states:ap-northeast-1:101010101010:execution:command:master-tenantCode-test-1726027976-v1-1726214572086',
        Input: {
          eventSourceARN:
            'arn:aws:dynamodb:ap-northeast-1:undefined:env-app_name-table_name-command',
          awsRegion: 'ddblocal',
          eventID: '6e4009b4-5dab-4ee2-8570-4713062683cb',
          eventName: 'INSERT',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          dynamodb: {
            ApproximateCreationDateTime: '2024-09-13T08:02:00.000Z',
            Keys: { sk: { S: '1726027976@1' }, pk: { S: 'tenantCode#test' } },
            NewImage: {
              code: { S: '1726027976' },
              updatedBy: { S: '92ca4f68-9ac6-4080-9ae2-2f02a86206a4' },
              createdIp: { S: '127.0.0.1' },
              tenantCode: { S: 'tenantCode' },
              source: { S: '[master]:MasterController.publishCommand' },
              type: { S: 'MASTER' },
              version: { N: '1' },
              createdAt: { S: '2024-09-13T15:02:51+07:00' },
              updatedIp: { S: '127.0.0.1' },
              createdBy: { S: '92ca4f68-9ac6-4080-9ae2-2f02a86206a4' },
              requestId: { S: '45e4edc6-e4ce-4b3a-baf9-3ef4fed82a1c' },
              sk: { S: '1726027976@1' },
              name: { S: '1726027976' },
              attributes: { M: { master: { M: {} } } },
              pk: { S: 'tenantCode#test' },
              id: { S: 'tenantCode#test#1726027976' },
              updatedAt: { S: '2024-09-13T15:02:51+07:00' },
            },
            SequenceNumber: '000000000000000000089',
            SizeBytes: 465,
            StreamViewType: 'NEW_IMAGE',
          },
          source:
            'arn:aws:dynamodb:ap-northeast-1:undefined:env-app_name-table_name-command',
        },
        Name: 'master-tenantCode-test-1726027976-v1-1726214572086',
        RoleArn: 'arn:aws:iam::101010101010:role/DummyRole',
        StartTime: '2024-09-13T08:02:52.094Z',
      },
      State: {
        EnteredTime: '2024-09-13T08:02:54.849Z',
        Name: stepStateName,
        RetryCount: 0,
      },
      StateMachine: {
        Id: 'arn:aws:states:ap-northeast-1:101010101010:stateMachine:command',
        Name: 'command',
      },
    },
  })

const sfnCheckVersionEvent = createEvent(DataSyncCommandSfnName.CHECK_VERSION)

const sfnSetTtlCommandEvent = createEvent(
  DataSyncCommandSfnName.SET_TTL_COMMAND,
  {
    result: 0,
  },
)

const sfnHistoryCopyEvent = createEvent(DataSyncCommandSfnName.HISTORY_COPY, {
  result: 'ok',
})

const sfnTransformDataEvent = createEvent(
  DataSyncCommandSfnName.TRANSFORM_DATA,
  {
    result: 'ok',
  },
)

const sfnSyncDataEvent = createEvent(DataSyncCommandSfnName.SYNC_DATA, {
  prevStateName: 'transform_data',
  result: 'MockedHandler',
})

const sfnFinishDataEvent = createEvent(DataSyncCommandSfnName.FINISH)

const createWaitConfirmEvent = (
  version: number,
  taskToken = 'test-task-token',
) => {
  const sk = `1726027976@${version}`
  return new DataSyncCommandSfnEvent({
    taskToken,
    input: undefined,
    context: {
      Execution: {
        Id: 'arn:aws:states:ap-northeast-1:101010101010:execution:command:test-v2',
        Input: {
          eventSourceARN:
            'arn:aws:dynamodb:ap-northeast-1:undefined:env-app_name-table_name-command',
          awsRegion: 'ddblocal',
          eventID: 'test-event-id',
          eventName: 'INSERT',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          dynamodb: {
            ApproximateCreationDateTime: '2024-09-13T08:02:00.000Z',
            Keys: { sk: { S: sk }, pk: { S: 'tenantCode#test' } },
            NewImage: {
              pk: { S: 'tenantCode#test' },
              sk: { S: sk },
              version: { N: String(version) },
              requestId: { S: 'req-1' },
            },
            SequenceNumber: '1',
            SizeBytes: 100,
            StreamViewType: 'NEW_IMAGE',
          },
          source:
            'arn:aws:dynamodb:ap-northeast-1:undefined:env-app_name-table_name-command',
        },
        Name: 'test-execution',
        RoleArn: 'arn:aws:iam::101010101010:role/DummyRole',
        StartTime: '2024-09-13T08:02:52.094Z',
      },
      State: {
        EnteredTime: '2024-09-13T08:02:54.849Z',
        Name: DataSyncCommandSfnName.WAIT_PREV_COMMAND,
        RetryCount: 0,
      },
      StateMachine: {
        Id: 'arn:aws:states:ap-northeast-1:101010101010:stateMachine:command',
        Name: 'command',
      },
    },
  })
}

function makeWaitConfirmTokenHandler(
  commandService: {
    updateTaskToken: jest.Mock
    getItem: jest.Mock
  },
  sfnService: { resumeExecution: jest.Mock },
): {
  h: CommandEventHandler
  logSpy: jest.Mock
  warnSpy: jest.Mock
  errorSpy: jest.Mock
  publishSpy: jest.Mock
} {
  const publishSpy = jest.fn().mockResolvedValue(undefined)
  const h = new (CommandEventHandler as any)(
    { tableName: 'test-table' },
    commandService,
    null,
    null,
    null,
    { publish: publishSpy },
    { get: jest.fn().mockReturnValue('alarm_topic_arn') },
    sfnService,
  )
  const logSpy = jest.fn()
  const warnSpy = jest.fn()
  const errorSpy = jest.fn()
  h.logger = {
    debug: jest.fn(),
    log: logSpy,
    warn: warnSpy,
    error: errorSpy,
  }
  return { h, logSpy, warnSpy, errorSpy, publishSpy }
}

const keys = {
  NODE_ENV: 'env',
  APP_NAME: 'app_name',
  SNS_TOPIC_ARN: 'main_topic_arn',
  SNS_ALARM_TOPIC_ARN: 'alarm_topic_arn',
}

describe('DataSyncCommandSfnEventHandler', () => {
  describe('execute', () => {
    let commandEventHandler: CommandEventHandler
    const dynamoDBMock = mockClient(DynamoDBClient)
    const snsMock = mockClient(SNSClient)
    const sfnMock = mockClient(SFNClient)

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          CommandEventHandler,
          CommandService,
          DataService,
          HistoryService,
          S3Service,
          DynamoDbService,
          SnsService,
          MockedHandler,
          TtlService,
          SnsClientFactory,
          StepFunctionService,
          {
            provide: SessionService,
            useValue: createMock<SessionService>(),
          },
          {
            provide: SFNClient,
            useValue: sfnMock,
          },
          {
            provide: MODULE_OPTIONS_TOKEN,
            useValue: {
              tableName: 'table_name',
              dataSyncHandlers: [MockedHandler],
            },
          },
          {
            provide: ExplorerService,
            useValue: createMock<ExplorerService>({
              exploreDataSyncHandlers: () => ({
                dataSyncHandlers: [MockedHandler],
              }),
            }),
          },
          {
            provide: DataSyncDdsHandler,
            useClass: MockedHandler,
          },
          {
            provide: ConfigService,
            useValue: createMock<ConfigService>({
              get: jest.fn((key) => {
                return keys[key] ?? 'default'
              }),
            }),
          },
        ],
      }).compile()
      commandEventHandler =
        moduleRef.get<CommandEventHandler>(CommandEventHandler)

      const commandService = moduleRef.get<CommandService>(CommandService)
      commandService.onModuleInit()
    })

    afterEach(() => {
      jest.clearAllMocks()
      dynamoDBMock.reset()
      snsMock.reset()
      sfnMock.reset()
    })

    it('should return result = 0 when executing the correct check version event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action
      const result = await commandEventHandler.execute(sfnCheckVersionEvent)

      // Assert
      expect(result).toEqual({ result: 0 })
    })

    it('should return result = 1 when executing the correct check version event and the data is not stable', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({
        Item: {
          version: {
            N: '-1', //
          },
        },
      })

      // Action
      const result = await commandEventHandler.execute(sfnCheckVersionEvent)

      // Assert
      expect(result).toEqual({ result: 1 })
    })

    it('should return result = -1 when executing the stale check version event ', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({
        Item: {
          version: {
            N: '1',
          },
        },
      })

      // Action
      const result = await commandEventHandler.execute(sfnCheckVersionEvent)

      // Assert
      expect(result).toEqual(expect.objectContaining({ result: -1 }))
    })

    it('should publish sns alarm when executing the stale check version event ', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({
        Item: {
          version: {
            N: '1',
          },
        },
      })

      // Action
      const result = await commandEventHandler.execute(sfnCheckVersionEvent)

      // Assert
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 3)
      expect(snsMock).toHaveReceivedNthCommandWith(2, PublishCommand, {
        Message: expect.stringMatching(
          /(?=.*"action":"sfn-alarm")(?=.*next version must be 2 but got 1)/g,
        ),
      })
    })

    it('should call the AWS service with the correct parameters when executing the correct check version event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action
      await commandEventHandler.execute(sfnCheckVersionEvent)

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommandTimes(UpdateItemCommand, 2)
      expect(dynamoDBMock).toHaveReceivedCommandTimes(GetItemCommand, 2)
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)

      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        Message: expect.stringContaining('check_version'),
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(1, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'check_version:STARTED' },
        }),
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(2, GetItemCommand, {
        TableName: 'env-app_name-table_name-data',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976' } },
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(4, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'check_version:FINISHED' },
        }),
      })
    })

    it('should return result = ok when executing the correct set ttl command event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock
        .on(GetItemCommand)
        .resolves({ Item: { sk: { S: '1726027976' }, version: { N: '1' } } })

      // Action
      const result = await commandEventHandler.execute(sfnSetTtlCommandEvent)

      // Assert
      expect(result).toEqual({ result: 'ok' })
    })

    it('should call the AWS service with the correct parameters when executing the set ttl command event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock
        .on(GetItemCommand)
        .resolves({ Item: { sk: { S: '1726027976' }, version: { N: '1' } } })

      // Action
      await commandEventHandler.execute(sfnSetTtlCommandEvent)

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommandTimes(UpdateItemCommand, 2)

      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        Message: expect.stringContaining('set_ttl_command'),
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(1, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'set_ttl_command:STARTED' },
        }),
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(2, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'set_ttl_command:FINISHED' },
        }),
      })
    })

    it('should return result = ok when executing the correct history copy event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock
        .on(GetItemCommand)
        .resolves({ Item: { sk: { S: '1726027976' }, version: { N: '1' } } })

      // Action
      const result = await commandEventHandler.execute(sfnHistoryCopyEvent)

      // Assert
      expect(result).toEqual({ result: 'ok' })
    })

    it('should call the AWS service with the correct parameters when executing the correct history copy event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock
        .on(GetItemCommand)
        .resolves({ Item: { sk: { S: '1726027976' }, version: { N: '1' } } })

      // Action
      await commandEventHandler.execute(sfnHistoryCopyEvent)

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommandTimes(UpdateItemCommand, 2)
      expect(dynamoDBMock).toHaveReceivedCommandTimes(GetItemCommand, 2)
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)

      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        Message: expect.stringContaining('history_copy'),
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(1, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'history_copy:STARTED' },
        }),
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(2, GetItemCommand, {
        TableName: 'env-app_name-table_name-data',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976' } },
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(3, GetItemCommand, {
        Key: {
          pk: { S: 'MASTER#test' },
          sk: { S: 'TTL#env-app_name-table_name-history' },
        },
        TableName: 'env-app_name-master-data',
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(4, PutItemCommand, {
        TableName: 'env-app_name-table_name-history',
        Item: {
          sk: { S: '1726027976@1' },
          version: { N: '1' },
          ttl: { NULL: true },
        },
      })
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(5, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'history_copy:FINISHED' },
        }),
      })
    })

    it('should return the array of handlers when executing the correct transform data event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action
      const result = await commandEventHandler.execute(sfnTransformDataEvent)

      console.log('result,', result)

      // Assert: dedup が効いていれば MockedHandler は 1 件のみ
      expect(result).toHaveLength(1)
      expect(result).toEqual(
        expect.arrayContaining([
          { prevStateName: 'transform_data', result: 'MockedHandler' },
        ]),
      )
    })

    it('should call the AWS service with the correct parameters when executing the correct transform data event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action
      await commandEventHandler.execute(sfnTransformDataEvent)

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommandTimes(UpdateItemCommand, 2)
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)

      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        Message: expect.stringContaining('transform_data'),
      })

      expect(dynamoDBMock).toHaveReceivedNthCommandWith(1, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'transform_data:STARTED' },
        }),
      })

      expect(dynamoDBMock).toHaveReceivedNthCommandWith(2, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'transform_data:FINISHED' },
        }),
      })
    })

    it('should throw not found handler error and publish sns alarm when executing the sync data event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action & Assert
      await expect(
        commandEventHandler.execute(
          createEvent(DataSyncCommandSfnName.SYNC_DATA, {
            prevStateName: 'transform_data',
          }),
        ),
      ).rejects.toThrow('SyncDataHandler not found!')

      expect(snsMock).toHaveReceivedNthCommandWith(3, PublishCommand, {
        Message: expect.stringMatching(
          /(?=.*"action":"sfn-alarm")(?=.*Error: SyncDataHandler not found!)/g,
        ),
      })
    })

    it('should throw empty handler error and publish sns alarm when executing the sync data event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action & Assert
      await expect(
        commandEventHandler.execute(
          createEvent(DataSyncCommandSfnName.SYNC_DATA, {
            prevStateName: 'transform_data',
            result: 'HandlerNotExist',
          }),
        ),
      ).rejects.toThrow('SyncDataHandler empty!')

      expect(snsMock).toHaveReceivedNthCommandWith(3, PublishCommand, {
        Message: expect.stringMatching(
          /(?=.*"action":"sfn-alarm")(?=.*Error: SyncDataHandler empty!)/g,
        ),
      })
    })

    it('should rethrow original error when publishAlarm SNS rejects after step failure', async () => {
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })
      snsMock.on(PublishCommand).callsFake(async (input) => {
        const message = JSON.parse(String(input.Message))
        if (message.action === 'sfn-alarm') {
          throw new Error('SNS unavailable')
        }
        return {}
      })

      await expect(
        commandEventHandler.execute(
          createEvent(DataSyncCommandSfnName.SYNC_DATA, {
            prevStateName: 'transform_data',
          }),
        ),
      ).rejects.toThrow('SyncDataHandler not found!')

      expect(dynamoDBMock).toHaveReceivedCommandWith(UpdateItemCommand, {
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'sync_data:FAILED' },
        }),
      })
    })

    it('should return version-mismatch errorDetails when publishAlarm SNS rejects', async () => {
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({
        Item: {
          version: {
            N: '1',
          },
        },
      })
      snsMock.on(PublishCommand).callsFake(async (input) => {
        const message = JSON.parse(String(input.Message))
        if (message.action === 'sfn-alarm') {
          throw new Error('SNS unavailable')
        }
        return {}
      })

      await expect(
        commandEventHandler.execute(sfnCheckVersionEvent),
      ).resolves.toEqual(
        expect.objectContaining({
          result: -1,
          error: 'version is not match',
        }),
      )
    })

    it('should call handler up when executing the correct sync data event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action
      const result = await commandEventHandler.execute(sfnSyncDataEvent)

      // Assert
      expect(result).toEqual('MockedHandler has been called')
    })

    it('should call the AWS service with the correct parameters when executing the correct sync data event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action
      await commandEventHandler.execute(sfnSyncDataEvent)

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommandTimes(UpdateItemCommand, 2)
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)

      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        Message: expect.stringContaining('sync_data'),
      })

      expect(dynamoDBMock).toHaveReceivedNthCommandWith(1, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'sync_data:STARTED' },
        }),
      })

      expect(dynamoDBMock).toHaveReceivedNthCommandWith(2, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'sync_data:FINISHED' },
        }),
      })
    })

    it('should call the AWS service with the correct parameters when executing the finish data event', async () => {
      // Arrange
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      snsMock.on(PublishCommand).resolves({} as any)
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })

      // Action
      await commandEventHandler.execute(sfnFinishDataEvent)

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommandTimes(UpdateItemCommand, 2)
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2)

      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        Message: expect.stringContaining('finish'),
      })

      expect(dynamoDBMock).toHaveReceivedNthCommandWith(1, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'finish:STARTED' },
        }),
      })

      expect(dynamoDBMock).toHaveReceivedNthCommandWith(3, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'finish:FINISHED' },
        }),
      })
    })
  })

  describe('transformData - empty handler list warning', () => {
    function makeHandler(handlers: any[]) {
      const mockCommandService = {
        dataSyncHandlers: handlers,
        updateStatus: jest.fn().mockResolvedValue(undefined),
      }
      const warnSpy = jest.fn()
      const h = new (CommandEventHandler as any)(
        { tableName: 'test-table' },
        mockCommandService,
        null,
        null,
        null,
        { publish: jest.fn().mockResolvedValue(undefined) },
        { get: jest.fn().mockReturnValue('') },
        null,
      )
      h.logger = { debug: jest.fn(), warn: warnSpy }
      return { h, warnSpy }
    }

    it('should emit a warn log when dataSyncHandlers is empty', async () => {
      const { h, warnSpy } = makeHandler([])
      const event = createEvent(DataSyncCommandSfnName.TRANSFORM_DATA, {
        result: 'ok',
      })

      await h['transformData'](event)

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][0]).toContain('no sync will occur')
    })

    it('should NOT emit a warn log when dataSyncHandlers is non-empty', async () => {
      const { h, warnSpy } = makeHandler([new MockedHandler()])
      const event = createEvent(DataSyncCommandSfnName.TRANSFORM_DATA, {
        result: 'ok',
      })

      await h['transformData'](event)

      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('should map each handler to its constructor.name in the SFN input', async () => {
      const { h } = makeHandler([new MockedHandler()])
      const event = createEvent(DataSyncCommandSfnName.TRANSFORM_DATA, {
        result: 'ok',
      })

      const result = (await h['transformData'](event)) as any[]

      expect(result).toHaveLength(1)
      expect(result[0].result).toBe('MockedHandler')
      expect(result[0].prevStateName).toBe(
        DataSyncCommandSfnName.TRANSFORM_DATA,
      )
    })
  })

  describe('checkNextToken - resume error classification', () => {
    function makeCheckNextTokenHandler(
      commandService: any,
      sfnService: any,
    ): {
      h: any
      warnSpy: jest.Mock
      errorSpy: jest.Mock
      publishSpy: jest.Mock
    } {
      const publishSpy = jest.fn().mockResolvedValue(undefined)
      const h = new (CommandEventHandler as any)(
        { tableName: 'test-table' },
        commandService,
        null,
        null,
        null,
        { publish: publishSpy },
        { get: jest.fn().mockReturnValue('alarm_topic_arn') },
        sfnService,
      )
      const warnSpy = jest.fn()
      const errorSpy = jest.fn()
      h.logger = {
        debug: jest.fn(),
        log: jest.fn(),
        warn: warnSpy,
        error: errorSpy,
      }
      return { h, warnSpy, errorSpy, publishSpy }
    }

    function nextCommandWithToken(sk = 'order#001@2') {
      return {
        getNextCommand: jest.fn().mockResolvedValue({
          version: 2,
          taskToken: 'some-token',
          sk,
          status: 'wait:WAIT_PREV_COMMAND',
        }),
      }
    }

    it('should warn and not alarm when resumeExecution fails with TaskDoesNotExist', async () => {
      const nextCommandSk = 'order#001@2'
      const duplicate = new Error('Task does not exist')
      duplicate.name = 'TaskDoesNotExist'
      const mockSfnService = {
        resumeExecution: jest.fn().mockRejectedValue(duplicate),
      }

      const { h, warnSpy, errorSpy, publishSpy } = makeCheckNextTokenHandler(
        nextCommandWithToken(nextCommandSk),
        mockSfnService,
      )
      const event = createEvent(DataSyncCommandSfnName.FINISH)

      await expect(h['checkNextToken'](event)).resolves.toBeNull()

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][0]).toContain(event.commandKey.pk)
      expect(warnSpy.mock.calls[0][0]).toContain(nextCommandSk)
      expect(warnSpy.mock.calls[0][0]).toContain('TaskDoesNotExist')
      expect(errorSpy).not.toHaveBeenCalled()
      expect(publishSpy).not.toHaveBeenCalled()
    })

    it('should error and publish alarm when resumeExecution fails with TaskTimedOut', async () => {
      const nextCommandSk = 'order#001@2'
      const timedOut = new Error('Task timed out')
      timedOut.name = 'TaskTimedOut'
      const mockSfnService = {
        resumeExecution: jest.fn().mockRejectedValue(timedOut),
      }

      const { h, warnSpy, errorSpy, publishSpy } = makeCheckNextTokenHandler(
        nextCommandWithToken(nextCommandSk),
        mockSfnService,
      )
      const event = createEvent(DataSyncCommandSfnName.FINISH)

      await expect(h['checkNextToken'](event)).resolves.toBeNull()

      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()
      expect(errorSpy.mock.calls[0][0]).toContain(event.commandKey.pk)
      expect(errorSpy.mock.calls[0][0]).toContain(nextCommandSk)
      expect(errorSpy.mock.calls[0][0]).toContain('TaskTimedOut')
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sfn-alarm',
          content: expect.objectContaining({
            errorMessage: expect.objectContaining({
              push_resume_failed: true,
              nextVersion: 2,
              nextSk: nextCommandSk,
              errorName: 'TaskTimedOut',
              cause: 'Task timed out',
            }),
          }),
        }),
        'alarm_topic_arn',
      )
    })

    it('should error and publish alarm when resumeExecution fails unexpectedly', async () => {
      const nextCommandSk = 'order#001@2'
      const unexpected = new Error('AccessDeniedException')
      unexpected.name = 'AccessDeniedException'
      const mockSfnService = {
        resumeExecution: jest.fn().mockRejectedValue(unexpected),
      }

      const { h, warnSpy, errorSpy, publishSpy } = makeCheckNextTokenHandler(
        nextCommandWithToken(nextCommandSk),
        mockSfnService,
      )
      const event = createEvent(DataSyncCommandSfnName.FINISH)

      await expect(h['checkNextToken'](event)).resolves.toBeNull()

      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            errorMessage: expect.objectContaining({
              push_resume_failed: true,
              errorName: 'AccessDeniedException',
            }),
          }),
        }),
        'alarm_topic_arn',
      )
    })
  })

  describe('checkNextToken - push-side consistent read', () => {
    const COMMAND_TABLE = 'env-app-table_name-command'

    function makeCheckNextTokenWithRealCommandService() {
      const dynamoGetItem = jest.fn()
      const dynamoDbService = {
        getItem: dynamoGetItem,
        getTableName: jest.fn().mockReturnValue(COMMAND_TABLE),
      }
      const commandService = new (CommandService as any)(
        { tableName: 'table_name' },
        dynamoDbService,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      )
      const resumeExecution = jest.fn().mockResolvedValue(undefined)
      const h = new (CommandEventHandler as any)(
        { tableName: 'table_name' },
        commandService,
        null,
        null,
        null,
        null,
        { get: jest.fn().mockReturnValue('') },
        { resumeExecution },
      )
      h.logger = { debug: jest.fn(), log: jest.fn(), warn: jest.fn() }
      return { h, dynamoGetItem, resumeExecution }
    }

    it('should read next command with consistentRead via getNextCommand', async () => {
      const { h, dynamoGetItem, resumeExecution } =
        makeCheckNextTokenWithRealCommandService()
      dynamoGetItem.mockResolvedValue(undefined)

      const event = createEvent(DataSyncCommandSfnName.FINISH)
      const result = await h['checkNextToken'](event)

      expect(dynamoGetItem).toHaveBeenCalledTimes(1)
      expect(dynamoGetItem).toHaveBeenCalledWith(
        COMMAND_TABLE,
        { pk: 'tenantCode#test', sk: '1726027976@2' },
        { consistentRead: true },
      )
      expect(resumeExecution).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should resume next command when getNextCommand finds a taskToken', async () => {
      const { h, dynamoGetItem, resumeExecution } =
        makeCheckNextTokenWithRealCommandService()
      dynamoGetItem.mockResolvedValue({
        version: 2,
        taskToken: 'next-token',
        sk: '1726027976@2',
      })

      const event = createEvent(DataSyncCommandSfnName.FINISH)
      await h['checkNextToken'](event)

      expect(dynamoGetItem).toHaveBeenCalledWith(
        COMMAND_TABLE,
        { pk: 'tenantCode#test', sk: '1726027976@2' },
        { consistentRead: true },
      )
      expect(resumeExecution).toHaveBeenCalledWith('next-token', {
        result: 'resumed_by_prev_version',
        prevVersion: 1,
      })
    })
  })

  describe('waitConfirmToken - pull-side self-resume', () => {
    const finishStartedStatus = getCommandStatus(
      DataSyncCommandSfnName.FINISH,
      CommandStatus.STATUS_STARTED,
    )
    const finishStatus = getCommandStatus(
      DataSyncCommandSfnName.FINISH,
      CommandStatus.STATUS_FINISHED,
    )

    it('should self-resume when predecessor is finish:STARTED', async () => {
      const taskToken = 'self-resume-started-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue({
          version: 1,
          status: finishStartedStatus,
          sk: '1726027976@1',
        }),
      }
      const mockSfnService = {
        resumeExecution: jest.fn().mockResolvedValue(undefined),
      }

      const { h } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      const result = await h['waitConfirmToken'](event)

      expect(mockCommandService.updateTaskToken).toHaveBeenCalledWith(
        event.commandKey,
        taskToken,
      )
      expect(mockCommandService.getItem).toHaveBeenCalledWith(
        { pk: 'tenantCode#test', sk: '1726027976@1' },
        { consistentRead: true },
      )
      expect(mockSfnService.resumeExecution).toHaveBeenCalledWith(taskToken, {
        result: 'resumed_by_prev_version',
        prevVersion: 1,
      })
      expect(result).toEqual({ result: { token: taskToken } })
    })

    it('should self-resume when predecessor is finish:FINISHED', async () => {
      const taskToken = 'self-resume-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue({
          version: 1,
          status: finishStatus,
          sk: '1726027976@1',
        }),
      }
      const mockSfnService = {
        resumeExecution: jest.fn().mockResolvedValue(undefined),
      }

      const { h } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      const result = await h['waitConfirmToken'](event)

      expect(mockCommandService.updateTaskToken).toHaveBeenCalledWith(
        event.commandKey,
        taskToken,
      )
      expect(mockCommandService.getItem).toHaveBeenCalledWith(
        { pk: 'tenantCode#test', sk: '1726027976@1' },
        { consistentRead: true },
      )
      expect(mockSfnService.resumeExecution).toHaveBeenCalledWith(taskToken, {
        result: 'resumed_by_prev_version',
        prevVersion: 1,
      })
      expect(result).toEqual({ result: { token: taskToken } })
    })

    it('should not resume when predecessor is finish:FAILED', async () => {
      const taskToken = 'wait-failed-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue({
          version: 1,
          status: getCommandStatus(
            DataSyncCommandSfnName.FINISH,
            CommandStatus.STATUS_FAILED,
          ),
          sk: '1726027976@1',
        }),
      }
      const mockSfnService = {
        resumeExecution: jest.fn().mockResolvedValue(undefined),
      }

      const { h } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      await h['waitConfirmToken'](event)

      expect(mockCommandService.updateTaskToken).toHaveBeenCalled()
      expect(mockSfnService.resumeExecution).not.toHaveBeenCalled()
    })

    it('should not resume when predecessor is not finish:FINISHED', async () => {
      const taskToken = 'wait-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue({
          version: 1,
          status: getCommandStatus(
            DataSyncCommandSfnName.SYNC_DATA,
            CommandStatus.STATUS_FINISHED,
          ),
          sk: '1726027976@1',
        }),
      }
      const mockSfnService = {
        resumeExecution: jest.fn().mockResolvedValue(undefined),
      }

      const { h } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      await h['waitConfirmToken'](event)

      expect(mockCommandService.updateTaskToken).toHaveBeenCalled()
      expect(mockSfnService.resumeExecution).not.toHaveBeenCalled()
    })

    it('should not lookup predecessor when version is 1', async () => {
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn(),
      }
      const mockSfnService = {
        resumeExecution: jest.fn(),
      }

      const { h } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(1, 'v1-token')

      await h['waitConfirmToken'](event)

      expect(mockCommandService.getItem).not.toHaveBeenCalled()
      expect(mockSfnService.resumeExecution).not.toHaveBeenCalled()
    })

    it('should error, publish alarm, and not throw when getItem rejects during predecessor lookup', async () => {
      jest.useFakeTimers()
      const taskToken = 'get-item-fail-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest
          .fn()
          .mockRejectedValue(
            new Error('ProvisionedThroughputExceededException'),
          ),
      }
      const mockSfnService = {
        resumeExecution: jest.fn(),
      }

      const { h, errorSpy, publishSpy } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      const pending = h['waitConfirmToken'](event)
      await jest.runAllTimersAsync()
      await expect(pending).resolves.toEqual({
        result: { token: taskToken },
      })

      expect(mockCommandService.updateTaskToken).toHaveBeenCalled()
      expect(mockCommandService.getItem).toHaveBeenCalledTimes(3)
      expect(mockSfnService.resumeExecution).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()
      expect(errorSpy.mock.calls[0][0]).toContain('tenantCode#test')
      expect(errorSpy.mock.calls[0][0]).toContain('after retries')
      expect(errorSpy.mock.calls[0][0]).toContain(
        'self-resume backstop degraded',
      )
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sfn-alarm',
          content: expect.objectContaining({
            errorMessage: expect.objectContaining({
              self_resume_predecessor_read_failed: true,
              cause: 'ProvisionedThroughputExceededException',
            }),
          }),
        }),
        'alarm_topic_arn',
      )

      jest.useRealTimers()
    })

    it('should self-resume when getItem succeeds on retry after one failure', async () => {
      const taskToken = 'retry-then-resume-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest
          .fn()
          .mockRejectedValueOnce(
            new Error('ProvisionedThroughputExceededException'),
          )
          .mockResolvedValueOnce({
            version: 1,
            status: finishStartedStatus,
            sk: '1726027976@1',
          }),
      }
      const mockSfnService = {
        resumeExecution: jest.fn().mockResolvedValue(undefined),
      }

      const { h } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      await expect(h['waitConfirmToken'](event)).resolves.toEqual({
        result: { token: taskToken },
      })

      expect(mockCommandService.getItem).toHaveBeenCalledTimes(2)
      expect(mockSfnService.resumeExecution).toHaveBeenCalledWith(taskToken, {
        result: 'resumed_by_prev_version',
        prevVersion: 1,
      })
    })

    it('should error, publish alarm, and not throw when getItem rejects every attempt', async () => {
      jest.useFakeTimers()
      const taskToken = 'get-item-fail-all-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest
          .fn()
          .mockRejectedValue(
            new Error('ProvisionedThroughputExceededException'),
          ),
      }
      const mockSfnService = { resumeExecution: jest.fn() }

      const { h, errorSpy, publishSpy } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      const pending = h['waitConfirmToken'](event)
      await jest.runAllTimersAsync()
      await expect(pending).resolves.toEqual({ result: { token: taskToken } })

      expect(mockCommandService.getItem).toHaveBeenCalledTimes(3)
      expect(mockSfnService.resumeExecution).not.toHaveBeenCalled()
      expect(errorSpy.mock.calls[0][0]).toContain('after retries')
      expect(errorSpy.mock.calls[0][0]).toContain(
        'self-resume backstop degraded',
      )
      expect(publishSpy).toHaveBeenCalled()

      jest.useRealTimers()
    })

    it('should back off exponentially between getItem attempts', async () => {
      jest.useFakeTimers()
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockRejectedValue(new Error('ThrottlingException')),
      }
      const mockSfnService = { resumeExecution: jest.fn() }

      const { h } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, 'backoff-token')

      const pending = h['waitConfirmToken'](event)

      // Attempt 1 fails immediately
      await Promise.resolve()
      expect(mockCommandService.getItem).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(99)
      expect(mockCommandService.getItem).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(1)
      expect(mockCommandService.getItem).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(199)
      expect(mockCommandService.getItem).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(1)
      expect(mockCommandService.getItem).toHaveBeenCalledTimes(3)

      await expect(pending).resolves.toEqual({
        result: { token: 'backoff-token' },
      })

      jest.useRealTimers()
    })

    it('should warn and not alarm when resumeExecution fails with TaskDoesNotExist', async () => {
      const taskToken = 'dup-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue({
          version: 1,
          status: finishStatus,
          sk: '1726027976@1',
        }),
      }
      const duplicateError = new Error('Task does not exist')
      duplicateError.name = 'TaskDoesNotExist'
      const mockSfnService = {
        resumeExecution: jest.fn().mockRejectedValue(duplicateError),
      }

      const { h, warnSpy, errorSpy, publishSpy } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      await expect(h['waitConfirmToken'](event)).resolves.toEqual({
        result: { token: taskToken },
      })

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][0]).toContain('already consumed')
      expect(warnSpy.mock.calls[0][0]).toContain('TaskDoesNotExist')
      expect(errorSpy).not.toHaveBeenCalled()
      expect(publishSpy).not.toHaveBeenCalled()
    })

    it('should warn and not alarm when self-resume fails with TaskTimedOut', async () => {
      const taskToken = 'timed-out-dup-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue({
          version: 1,
          status: finishStatus,
          sk: '1726027976@1',
        }),
      }
      const timedOut = new Error('Task timed out')
      timedOut.name = 'TaskTimedOut'
      const mockSfnService = {
        resumeExecution: jest.fn().mockRejectedValue(timedOut),
      }

      const { h, warnSpy, errorSpy, publishSpy } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      await expect(h['waitConfirmToken'](event)).resolves.toEqual({
        result: { token: taskToken },
      })

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][0]).toContain('TaskTimedOut')
      expect(errorSpy).not.toHaveBeenCalled()
      expect(publishSpy).not.toHaveBeenCalled()
    })

    it('should error and publish alarm when resumeExecution fails unexpectedly', async () => {
      const taskToken = 'resume-fail-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue({
          version: 1,
          status: finishStatus,
          sk: '1726027976@1',
        }),
      }
      const unexpected = new Error('AccessDeniedException')
      unexpected.name = 'AccessDeniedException'
      const mockSfnService = {
        resumeExecution: jest.fn().mockRejectedValue(unexpected),
      }

      const { h, warnSpy, errorSpy, publishSpy } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      const event = createWaitConfirmEvent(2, taskToken)

      await expect(h['waitConfirmToken'](event)).resolves.toEqual({
        result: { token: taskToken },
      })

      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()
      expect(errorSpy.mock.calls[0][0]).toContain('failed unexpectedly')
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sfn-alarm',
          content: expect.objectContaining({
            errorMessage: expect.objectContaining({
              self_resume_failed: true,
              cause: 'AccessDeniedException',
            }),
          }),
        }),
        'alarm_topic_arn',
      )
    })

    it('should not fail the step when publishAlarm rejects after getItem failure', async () => {
      jest.useFakeTimers()
      const taskToken = 'alarm-fail-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockRejectedValue(new Error('ThrottlingException')),
      }
      const mockSfnService = { resumeExecution: jest.fn() }

      const { h, publishSpy } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      publishSpy.mockRejectedValue(new Error('SNS unavailable'))
      const event = createWaitConfirmEvent(2, taskToken)

      const pending = h['waitConfirmToken'](event)
      await jest.runAllTimersAsync()
      await expect(pending).resolves.toEqual({
        result: { token: taskToken },
      })

      jest.useRealTimers()
    })

    it('should not fail the step when publishAlarm rejects after unexpected resume error', async () => {
      const taskToken = 'alarm-on-resume-fail-token'
      const mockCommandService = {
        updateTaskToken: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue({
          version: 1,
          status: finishStartedStatus,
          sk: '1726027976@1',
        }),
      }
      const accessDenied = Object.assign(new Error('AccessDeniedException'), {
        name: 'AccessDeniedException',
      })
      const mockSfnService = {
        resumeExecution: jest.fn().mockRejectedValue(accessDenied),
      }

      const { h, publishSpy } = makeWaitConfirmTokenHandler(
        mockCommandService,
        mockSfnService,
      )
      publishSpy.mockRejectedValue(new Error('SNS unavailable'))
      const event = createWaitConfirmEvent(2, taskToken)

      await expect(h['waitConfirmToken'](event)).resolves.toEqual({
        result: { token: taskToken },
      })
    })
  })
})
