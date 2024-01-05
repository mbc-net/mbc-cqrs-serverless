import { Test } from '@nestjs/testing'
import { ModuleMocker, MockFunctionMetadata } from 'jest-mock'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { CommandModel, DataModel, DetailKey } from '../interfaces'
import { CommandService } from './command.service'
import { DataService } from './data.service'
import { addSortKeyVersion } from '../helpers/key'

const moduleMocker = new ModuleMocker(global)

function buildItem(key: DetailKey, version = 0) {
  return {
    ...key,
    id: key.pk + '#' + key.sk,
    code: '',
    name: '',
    version,
    tenantCode: '',
    type: '',
  }
}

const dataSet: {
  command: CommandModel[]
  data: DataModel[]
} = {
  command: [
    buildItem({ pk: 'master', sk: 'max_value@1' }),
    buildItem({ pk: 'master', sk: 'max_value@2' }),
    buildItem({ pk: 'master', sk: 'max_value@3' }),
    buildItem({ pk: 'master', sk: 'max_value@4' }),
    buildItem({ pk: 'master', sk: 'max_value@5' }),
    buildItem({ pk: 'master', sk: 'max_value@6' }),
    buildItem({ pk: 'master', sk: 'max_value@7' }),
    buildItem({ pk: 'master', sk: 'max_value@8' }),
    buildItem({ pk: 'master', sk: 'max_value@9' }),
    buildItem({ pk: 'master', sk: 'max_value@10' }),
    buildItem({ pk: 'master', sk: 'max_value@11' }),
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
            getItem: jest.fn((tableName: string, key: DetailKey) =>
              dataSet[tableName].find(
                ({ pk, sk }) => pk === key.pk && sk === key.sk,
              ),
            ),
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
