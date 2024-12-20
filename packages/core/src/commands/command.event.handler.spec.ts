import { createMock } from '@golevelup/ts-jest'
import { Test } from '@nestjs/testing'
import { DynamoDbService, S3Service } from '../data-store'

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
import { TtlService } from './ttl.service'
import { SnsClientFactory } from '../queue/sns-client-factory'

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
      expect(dynamoDBMock).toHaveReceivedCommandTimes(GetItemCommand, 1)
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
      expect(dynamoDBMock).toHaveReceivedNthCommandWith(3, UpdateItemCommand, {
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

      // Assert
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

      expect(dynamoDBMock).toHaveReceivedNthCommandWith(2, UpdateItemCommand, {
        TableName: 'env-app_name-table_name-command',
        Key: { pk: { S: 'tenantCode#test' }, sk: { S: '1726027976@1' } },
        ExpressionAttributeValues: expect.objectContaining({
          ':status': { S: 'finish:FINISHED' },
        }),
      })
    })
  })
})
