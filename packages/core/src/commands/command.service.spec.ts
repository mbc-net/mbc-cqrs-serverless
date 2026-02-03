/**
 * CommandService Test Suite
 *
 * Tests the core CQRS command handling functionality including:
 * - Retrieving the latest versioned item from command store
 * - Publishing partial updates (async and sync modes)
 * - Dirty checking for command deduplication
 * - TTL (Time-To-Live) management for command records
 *
 * Key concepts tested:
 * - Optimistic locking via version numbers
 * - Sort key versioning (sk@version format)
 * - Command deduplication to prevent redundant writes
 */
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

  /**
   * Tests for getLatestItem method
   * Scenario: Retrieves the most recent versioned item by scanning sort keys
   */
  describe('getLatestItem', () => {
    /** Verifies that the item with highest version number is returned */
    it('should return latest item', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value',
      }
      const item = await commandService.getLatestItem(key)
      expect(item).toBeDefined()
      expect(item?.sk).toBe(addSortKeyVersion(key.sk, 11))
    })

    /** Returns null when no item exists with the given key */
    it('should return null when data not have key', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value_',
      }
      const item = await commandService.getLatestItem(key)
      expect(item).toBeNull()
    })
  })

  /**
   * Tests for publishAsync method
   * Scenario: Async publish that creates or updates a command record
   * Use case: Primary method for publishing commands asynchronously
   */
  describe('publishAsync', () => {
    /** Successfully creates a new item with version 1 */
    it('should create new item with version 1', async () => {
      const key = {
        pk: 'master',
        sk: 'new_item',
      }
      const inputItem = buildItem(key, 0)
      const item = await commandService.publishAsync(inputItem, {
        invokeContext: {},
      })
      expect(item).toBeDefined()
      expect(item?.version).toBe(1)
      expect(item?.sk).toBe('new_item@1')
    })

    /** Successfully updates with version=-1 (auto-fetch latest) */
    it('should update with the latest version when version is -1', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value',
      }
      const inputItem = {
        ...buildItem(key, -1),
        name: 'updated',
      }
      const latestItem = await commandService.getLatestItem(key)
      const item = await commandService.publishAsync(inputItem, {
        invokeContext: {},
      })
      expect(item).toBeDefined()
      expect(item?.version).toBe(latestItem.version + 1)
    })

    /** Throws error when specified version doesn't match existing item */
    it('should raise error with invalid version', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value',
      }
      const inputItem = buildItem(key, 99) // non-existent version
      const call = commandService.publishAsync(inputItem, {
        invokeContext: {},
      })
      expect(call).rejects.toThrow(
        new BadRequestException(
          'Invalid input version. The input version must be equal to the latest version',
        ),
      )
    })

    /** Returns null when command data is not dirty (no changes) */
    it('should return null when command is not dirty', async () => {
      const key = {
        pk: 'master',
        sk: 'max_value',
      }
      const latestItem = await commandService.getLatestItem(key)
      // Use same data as latest item
      const inputItem = {
        ...latestItem,
        version: -1,
      }
      const item = await commandService.publishAsync(inputItem, {
        invokeContext: {},
      })
      expect(item).toBeNull()
    })
  })

  /**
   * Tests for publishPartialUpdateAsync method
   * Scenario: Async partial update that auto-fetches latest version (version=-1)
   * Use case: Client wants to update without knowing current version
   */
  describe('publishPartialUpdateAsync', () => {
    /** Successfully updates when version=-1 triggers auto-fetch of latest */
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

    /** Throws BadRequestException when trying to update non-existent item */
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
        new BadRequestException('Invalid input key: item not found'),
      )
    })
  })

  /**
   * Tests for isNotCommandDirty method
   * Scenario: Checks if command data has changed to prevent redundant writes
   * Purpose: Optimization to skip database writes when data is unchanged
   */
  describe('isNotCommandDirty', () => {
    /** Helper class to test attribute comparison with class instances */
    class MasterAttributes {
      constructor(public name: string) {
        this.name = name
      }
    }

    /** Returns true when comparing identical objects (no changes) */
    it('should return true if command is not dirty', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5)
      expect(commandService.isNotCommandDirty(item, item)).toBe(true)
    })

    /** Returns false when name property differs (data changed) */
    it('should return false if command is dirty', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5)
      expect(
        commandService.isNotCommandDirty(item, { ...item, name: 'test' }),
      ).toBe(false)
    })

    /** Handles class instance attributes - returns true when values match */
    it('should return true if input attributes is class instance', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5, {
        name: 'test',
      })
      const input = { ...item, attributes: new MasterAttributes('test') }
      expect(commandService.isNotCommandDirty(item, input)).toBe(true)
    })

    /** Handles class instance attributes - returns false when values differ */
    it('should return false if input attributes is class instance and not dirty', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5, {
        name: 'test',
      })

      const input = { ...item, attributes: new MasterAttributes('abcdd') }
      expect(commandService.isNotCommandDirty(item, input)).toBe(false)
    })
  })

  /**
   * Tests for publishPartialUpdateSync method
   * Scenario: Synchronous update requiring exact version match (optimistic locking)
   * Use case: Client has read the current version and wants safe concurrent update
   */
  describe('publishPartialUpdateSync', () => {
    /** Successfully updates when provided version matches current version */
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

    /** Throws error when version doesn't match - prevents stale writes */
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
          'Invalid input: item not found or version mismatch',
        ),
      )
    })

    /** Throws error when trying to update non-existent item */
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
          'Invalid input: item not found or version mismatch',
        ),
      )
    })
  })

  /**
   * Tests for publishSync method
   * Scenario: Full synchronous publish with version validation
   * Use case: Creating or updating entire command record synchronously
   */
  describe('publishSync', () => {
    /** Successfully publishes with version=-1 (auto-increment) */
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

    /** Throws error when version doesn't match latest - optimistic lock failure */
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

/**
 * CommandService TTL Tests
 *
 * Tests TTL (Time-To-Live) functionality for command records.
 * TTL allows automatic expiration of old command versions in DynamoDB.
 */
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

  /**
   * Tests for updateTtl method
   * Scenario: Setting TTL values on command records for automatic cleanup
   */
  describe('updateTtl', () => {
    /** Updates TTL when calculateTtl returns -1 (use default) */
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

    /** Skips TTL update for version 0 items (initial creation) */
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
