import { Test } from '@nestjs/testing'
import { ModuleMocker, MockFunctionMetadata } from 'jest-mock'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { CommandModel, DataModel, DetailKey } from '../interfaces'
import { CommandService } from './command.service'
import { DataService } from './data.service'
import { addSortKeyVersion } from '../helpers/key'
import { BadRequestException } from '@nestjs/common'

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

describe('CommandService', () => {
  let commandService: CommandService

  beforeEach(async () => {
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

  describe('publishPartialUpdate', () => {
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
      const item = await commandService.publishPartialUpdate(inputItem)
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
      const call = commandService.publishPartialUpdate(inputItem)
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

    it('should return true if input atributes is class instance', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5, {
        name: 'test',
      })
      const input = { ...item, attributes: new MasterAttributes('test') }
      expect(commandService.isNotCommandDirty(item, input)).toBe(true)
    })

    it('should return false if input atributes is class instance and not dirty', () => {
      const item = buildItem({ pk: 'master', sk: 'max_value@5' }, 5, {
        name: 'test',
      })

      const input = { ...item, attributes: new MasterAttributes('abcdd') }
      expect(commandService.isNotCommandDirty(item, input)).toBe(false)
    })
  })
})
