import { createMock } from '@golevelup/ts-jest'
import { Test } from '@nestjs/testing'
import { ModuleMocker, MockFunctionMetadata } from 'jest-mock'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { CommandModel, DataModel, DetailKey } from '../interfaces'
import { CommandService } from './command.service'
import { DataService } from './data.service'
import { addSortKeyVersion } from '../helpers/key'
import { BadRequestException } from '@nestjs/common'
import { TtlService } from './ttl.service'
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { ConfigService } from '@nestjs/config'
import 'aws-sdk-client-mock-jest'
import { mockClient } from 'aws-sdk-client-mock'

const moduleMocker = new ModuleMocker(global)

function buildItem(key: DetailKey, version = 0, attributes = {}) {
  return {
    ...key,
    id: key.pk + '#' + key.sk,
    code: '',
    name: '',
    version,
    tenantCode: '',
    type: '',
    attributes,
  }
}

const config = {
  DYNAMODB_ENDPOINT: 'http://localhost:8000',
  DYNAMODB_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'local',
  AWS_SECRET_ACCESS_KEY: 'local',
  AWS_DEFAULT_REGION: 'ap-northeast-1',
  NODE_ENV: 'local',
  APP_NAME: 'suisss-recruit',
}

describe('CommandService', () => {
  let commandService: CommandService

  beforeEach(async () => {
    const dataSet: {
      command: CommandModel[]
      data: DataModel[]
    } = {
      command: [
        buildItem({ pk: 'master', sk: 'max_value@1' }, 1),
        buildItem({ pk: 'master', sk: 'max_value@2' }, 2),
        buildItem({ pk: 'master', sk: 'max_value@3' }, 3),
        buildItem({ pk: 'master', sk: 'max_value@4' }, 3),
        buildItem({ pk: 'master', sk: 'max_value@5' }, 5),
        buildItem({ pk: 'master', sk: 'max_value@6' }, 6),
        buildItem({ pk: 'master', sk: 'max_value@7' }, 7),
        buildItem({ pk: 'master', sk: 'max_value@8' }, 8),
        buildItem({ pk: 'master', sk: 'max_value@9' }, 9),
        buildItem({ pk: 'master', sk: 'max_value@10' }, 10),
        buildItem({ pk: 'master', sk: 'max_value@11' }, 11),
      ],
      data: [buildItem({ pk: 'master', sk: 'max_value' }, 5)],
    }

    const moduleRef = await Test.createTestingModule({
      providers: [CommandService, DataService],
    })
      .useMocker((token) => {
        if (typeof token === 'string') {
          // CONFIGURABLE_MODULE_OPTIONS[...]
          return { tableName: '' }
        }

        if (token === DynamoDbService) {
          return {
            getTableName: jest.fn((_: string, type: string) => type),
            getItem: jest.fn((tableName: string, key: DetailKey) => {
              console.log('DynamoDbService.getItem', tableName, key)

              const item = dataSet[tableName].find(
                ({ pk, sk }) => pk === key.pk && sk === key.sk,
              )
              return item
            }),
            putItem: jest.fn((tableName: string, item: any) => {
              console.log('DynamoDbService.putItem', tableName, item)
              const table = dataSet[tableName] as any[]
              const index = table.findIndex(
                ({ pk, sk }) => pk === item.pk && sk === item.sk,
              )
              if (index === -1) {
                table.push(item)
              } else {
                table[index] = item
              }
              return { ...item }
            }),
          }
        }

        if (typeof token === 'function') {
          const mockMetadata = moduleMocker.getMetadata(
            token,
          ) as MockFunctionMetadata<any, any>
          const Mock = moduleMocker.generateFromMetadata(mockMetadata)
          return new Mock()
        }
      })
      .compile()

    commandService = moduleRef.get<CommandService>(CommandService)
  })

  describe('getLatestItem', () => {
    it('should return latest item', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value',
      }
      const item = await commandService.getLatestItem(key)
      expect(item).toBeDefined()
      expect(item?.sk).toBe(addSortKeyVersion(key.sk, 11))
    })

    it('should return null when data not have key', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value_',
      }
      const item = await commandService.getLatestItem(key)
      expect(item).toBeNull()
    })
  })

  describe('publishPartialUpdateAsync', () => {
    it('should update with the latest item', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value',
      }
      const inputItem = {
        ...key,
        version: -1,
        name: '-1',
      }
      const latestItem = await commandService.getLatestItem(key)
      const item = await commandService.publishPartialUpdateAsync(inputItem, {
        invokeContext: {},
      })
      expect(item).toBeDefined()
      expect(item?.version).toBe(latestItem.version + 1)
    })

    it('should raise error with the non-existent item', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value_',
      }
      const inputItem = {
        ...key,
        version: -1,
        name: '-1',
      }
      const call = commandService.publishPartialUpdateAsync(inputItem, {
        invokeContext: {},
      })
      expect(call).rejects.toThrow(
        new BadRequestException('The input key is not a valid, item not found'),
      )
    })
  })

  describe('isNotCommandDirty', () => {
    class MasterAttributes {
      constructor(public name: string) {
        this.name = name
      }
    }

    it('should return true if command is not dirty', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5)
      expect(commandService.isNotCommandDirty(item, item)).toBe(true)
    })

    it('should return false if command is dirty', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5)
      expect(
        commandService.isNotCommandDirty(item, { ...item, name: 'test' }),
      ).toBe(false)
    })

    it('should return true if input attributes is class instance', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5, {
        name: 'test',
      })
      const input = { ...item, attributes: new MasterAttributes('test') }
      expect(commandService.isNotCommandDirty(item, input)).toBe(true)
    })

    it('should return false if input attributes is class instance and not dirty', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5, {
        name: 'test',
      })

      const input = { ...item, attributes: new MasterAttributes('abcdd') }
      expect(commandService.isNotCommandDirty(item, input)).toBe(false)
    })
  })

  describe('publishPartialUpdateSync', () => {
    it('should update with the latest version item', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value',
      }
      const inputItem = {
        ...key,
        version: 5,
        name: '-1',
      }
      const item = await commandService.publishPartialUpdateSync(inputItem, {
        invokeContext: {},
      })
      expect(item).toBeDefined()
      expect(item).toMatchObject({
        ...inputItem,
        version: 6,
      })
    })

    it('should raise error with invalid version', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value',
      }
      const inputItem = {
        ...key,
        version: 4,
        name: '4',
      }
      const res = commandService.publishPartialUpdateSync(inputItem, {
        invokeContext: {},
      })
      expect(res).rejects.toThrow(
        new BadRequestException(
          'The input is not a valid, item not found or version not match',
        ),
      )
    })

    it('should raise error with item not found', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value_',
      }
      const inputItem = {
        ...key,
        version: 4,
        name: '4',
      }
      const res = commandService.publishPartialUpdateSync(inputItem, {
        invokeContext: {},
      })
      expect(res).rejects.toThrow(
        new BadRequestException(
          'The input is not a valid, item not found or version not match',
        ),
      )
    })
  })

  describe('publishSync', () => {
    it('should update with the latest version item', async () => {
      const inputItem = buildItem({ pk: 'master', sk: 'max_value' }, -1)

      const item = await commandService.publishSync(inputItem, {
        invokeContext: {},
      })
      expect(item).toBeDefined()
      expect(item).toMatchObject({
        ...inputItem,
        version: 6,
      })
    })

    it('should raise error with invalid input version', async () => {
      const inputItem = buildItem({ pk: 'master', sk: 'max_value' }, 4)
      const res = commandService.publishSync(inputItem, {
        invokeContext: {},
      })
      expect(res).rejects.toThrow(
        new BadRequestException(
          'Invalid input version. The input version must be equal to the latest version',
        ),
      )
    })
  })
})

describe('CommandService', () => {
  let commandService: CommandService
  let dynamoDbService: DynamoDbService
  let ttlService: TtlService
  const dynamoDBMock = mockClient(DynamoDBClient)

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommandService,
        DynamoDbService,
        TtlService,
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: {
            tableName: 'master',
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key) => config[key],
          },
        },
      ],
    })
      .useMocker(createMock)
      .compile()

    commandService = moduleRef.get<CommandService>(CommandService)
    ttlService = moduleRef.get<TtlService>(TtlService)
  })

  describe('updateTtl', () => {
    it('should update with default TTL (null)', async () => {
      dynamoDBMock.on(GetItemCommand).resolves({
        Item: {},
      })
      dynamoDBMock.on(PutItemCommand).resolves({} as any)
      jest.spyOn(ttlService, 'calculateTtl').mockResolvedValue(-1)
      await commandService.updateTtl({
        pk: 'master',
        sk: 'test_ttl@2',
      })

      expect(dynamoDBMock).toHaveReceivedCommandTimes(PutItemCommand, 1)
    })

    it('should not update ttl when version is less than 1', async () => {
      dynamoDBMock.on(GetItemCommand).resolves({
        Item: {},
      })
      dynamoDBMock.on(UpdateItemCommand).resolves({} as any)
      jest.spyOn(ttlService, 'calculateTtl').mockResolvedValue(null)
      await commandService.updateTtl({
        pk: 'master',
        sk: 'test_ttl@0',
      })

      expect(dynamoDBMock).toHaveReceivedCommandTimes(UpdateItemCommand, 0)
    })

    afterEach(() => {
      jest.clearAllMocks()
      dynamoDBMock.reset()
    })
  })
})
