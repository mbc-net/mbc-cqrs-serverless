import { createMock } from '@golevelup/ts-jest'
import { Test } from '@nestjs/testing'
import { DynamoDbService } from '../data-store'
import { DataSyncCommandSfnEvent } from './data-sync.sfn.event'
import { DataSyncCommandSfnEventHandler } from './data-sync.sfn.event.handler'

import 'aws-sdk-client-mock-jest'
import { CommandEventHandler } from '../commands/command.event.handler'
import { MODULE_OPTIONS_TOKEN } from '../commands/command.module-definition'
import { DataService } from '../commands/data.service'

const sfnCheckVersionEvent = new DataSyncCommandSfnEvent({
  input: {},
  context: {
    Execution: {
      Id: 'arn:aws:states:ap-northeast-1:101010101010:execution:command:table_name-tenantCode-test-1726027976-v1-1726045913658',
      Input: {
        eventSourceARN:
          'arn:aws:dynamodb:ap-northeast-1:undefined:env-app_name-table_name-command',
        awsRegion: 'ddblocal',
        eventID: '35ac6b52-fdd8-46da-9d63-3e3dace9ed2f',
        eventName: 'INSERT',
        eventVersion: '1.1',
        eventSource: 'aws:dynamodb',
        dynamodb: {
          ApproximateCreationDateTime: '2024-09-11T09:11:00.000Z',
          Keys: { sk: { S: '1726027976@1' }, pk: { S: 'tenantCode#test' } },
          NewImage: {
            code: { S: '1726027976' },
            updatedBy: { S: '92ca4f68-9ac6-4080-9ae2-2f02a86206a4' },
            createdIp: { S: '127.0.0.1' },
            tenantCode: { S: 'tenantCode' },
            source: { S: '[master]:MasterController.publishCommand' },
            type: { S: 'testing' },
            version: { N: '1' },
            createdAt: { S: '2024-09-11T16:11:52+07:00' },
            updatedIp: { S: '127.0.0.1' },
            createdBy: { S: '92ca4f68-9ac6-4080-9ae2-2f02a86206a4' },
            requestId: { S: 'b4d83fe2-c2a0-41f7-9cd1-10998ec2f8e8' },
            sk: { S: '1726027976@1' },
            name: { S: '1726027976' },
            attributes: { M: { master: { M: {} } } },
            pk: { S: 'tenantCode#test' },
            id: { S: 'test#1726027976' },
            updatedAt: { S: '2024-09-11T16:11:52+07:00' },
          },
          SequenceNumber: '000000000000000000226',
          SizeBytes: 455,
          StreamViewType: 'NEW_IMAGE',
        },
        source:
          'arn:aws:dynamodb:ap-northeast-1:undefined:env-app_name-table_name-command',
      },
      Name: 'table_name-tenantCode-test-1726027976-v1-1726045913658',
      RoleArn: 'arn:aws:iam::101010101010:role/DummyRole',
      StartTime: '2024-09-11T09:11:53.665Z',
    },
    State: {
      EnteredTime: '2024-09-11T09:11:53.666Z',
      Name: 'check_version',
      RetryCount: 0,
    },
    StateMachine: {
      Id: 'arn:aws:states:ap-northeast-1:101010101010:stateMachine:command',
      Name: 'command',
    },
  },
})

describe('DataSyncCommandSfnEventHandler', () => {
  describe('execute', () => {
    let dataSyncHandler: DataSyncCommandSfnEventHandler
    let commandEventHandler: CommandEventHandler
    let dataService: DataService

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          DataSyncCommandSfnEventHandler,
          {
            provide: DynamoDbService,
            useValue: {
              getModuleName: () => 'table_name',
            },
          },
          {
            provide: 'table_name_other' + '_CommandEventHandler',
            useValue: createMock<CommandEventHandler>(),
          },
          {
            provide: 'table_name' + '_CommandEventHandler',
            useClass: CommandEventHandler,
          },
          {
            provide: MODULE_OPTIONS_TOKEN,
            useValue: {
              tableName: 'table_name',
            },
          },
        ],
      })
        .useMocker(createMock)
        .compile()

      dataSyncHandler = moduleRef.get<DataSyncCommandSfnEventHandler>(
        DataSyncCommandSfnEventHandler,
      )
      commandEventHandler = moduleRef.get<string, CommandEventHandler>(
        'table_name' + '_CommandEventHandler',
      )
      dataService = moduleRef.get<DataService>(DataService)
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should be call event with the correct event and handler', () => {
      // Arrange
      const executionHandlerSpy = jest.spyOn(commandEventHandler, 'execute')
      jest.spyOn(dataService, 'getItem').mockResolvedValue({} as any)
      // // Action
      dataSyncHandler.execute(sfnCheckVersionEvent)
      // Assert
      expect(executionHandlerSpy).toHaveBeenCalledWith(sfnCheckVersionEvent)
    })
  })
  describe('execute', () => {
    let dataSyncHandler: DataSyncCommandSfnEventHandler
    let otherCommandEventHandler: CommandEventHandler
    let dataService: DataService

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          DataSyncCommandSfnEventHandler,
          {
            provide: DynamoDbService,
            useValue: {
              getModuleName: () => 'table_name',
            },
          },
          {
            provide: 'table_name_other' + '_CommandEventHandler',
            useValue: createMock<CommandEventHandler>(),
          },
          {
            provide: 'table_name' + '_CommandEventHandler',
            useClass: CommandEventHandler,
          },
          {
            provide: MODULE_OPTIONS_TOKEN,
            useValue: {
              tableName: 'table_name',
            },
          },
        ],
      })
        .useMocker(createMock)
        .compile()

      dataSyncHandler = moduleRef.get<DataSyncCommandSfnEventHandler>(
        DataSyncCommandSfnEventHandler,
      )
      otherCommandEventHandler = moduleRef.get<string, CommandEventHandler>(
        'table_name_other' + '_CommandEventHandler',
      )
      dataService = moduleRef.get<DataService>(DataService)
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should not be call event with the wrong handler', () => {
      // Arrange
      const executionHandlerSpy = jest.spyOn(
        otherCommandEventHandler,
        'execute',
      )
      jest.spyOn(dataService, 'getItem').mockResolvedValue({} as any)
      // // Action
      dataSyncHandler.execute(sfnCheckVersionEvent)
      // Assert
      expect(executionHandlerSpy).toHaveBeenCalledTimes(0)
    })
  })
})
