import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'

import { KEY_SEPARATOR } from '../constants'
import { SessionService } from './session.service'
import { DynamoDbService } from './dynamodb.service'

describe('SessionService', () => {
  let service: SessionService
  let putItem: jest.Mock
  let getItem: jest.Mock
  let listItemsByPk: jest.Mock

  beforeEach(async () => {
    putItem = jest.fn().mockResolvedValue(undefined)
    getItem = jest.fn()
    listItemsByPk = jest.fn()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: DynamoDbService,
          useValue: {
            putItem,
            getItem,
            listItemsByPk,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const env: Record<string, string | undefined> = {
                NODE_ENV: 'local',
                APP_NAME: 'test-app',
                RYW_SESSION_TTL_MINUTES: '5',
              }
              return env[key]
            },
          },
        },
      ],
    }).compile()

    service = module.get(SessionService)
  })

  it('should put item with ttl field', async () => {
    await service.put('u1', 't1', 'user-tenant', 'item-a', 2)
    expect(putItem).toHaveBeenCalledWith(
      'local-test-app-session',
      expect.objectContaining({
        pk: `u1${KEY_SEPARATOR}t1`,
        sk: `user-tenant${KEY_SEPARATOR}item-a`,
        version: 2,
        ttl: expect.any(Number),
      }),
    )
  })

  it('should get session item', async () => {
    const row = {
      pk: 'u1#t1',
      sk: 'tbl#id1',
      version: 1,
      ttl: 1,
    }
    getItem.mockResolvedValue(row)
    const result = await service.get('u1', 't1', 'tbl', 'id1')
    expect(result).toEqual(row)
    expect(getItem).toHaveBeenCalledWith('local-test-app-session', {
      pk: 'u1#t1',
      sk: 'tbl#id1',
    })
  })

  it('should return null when get misses', async () => {
    getItem.mockResolvedValue(undefined)
    const result = await service.get('u1', 't1', 'tbl', 'id1')
    expect(result).toBeNull()
  })

  it('should list by user with begins_with sk', async () => {
    listItemsByPk.mockResolvedValue({ items: [] })
    await service.listByUser('u1', 't1', 'my-data-table')
    expect(listItemsByPk).toHaveBeenCalledWith(
      'local-test-app-session',
      'u1#t1',
      {
        skExpression: 'begins_with(sk, :skPrefix)',
        skAttributeValues: { ':skPrefix': 'my-data-table#' },
      },
      undefined, // startFromSk
      1000, // MAX_SESSION_ENTRIES
    )
  })

  it('should no-op put and skip Dynamo for get/listByUser when RYW_SESSION_TTL_MINUTES is unset', async () => {
    const localPut = jest.fn().mockResolvedValue(undefined)
    const localGet = jest.fn()
    const localList = jest.fn()
    const mod = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: DynamoDbService,
          useValue: {
            putItem: localPut,
            getItem: localGet,
            listItemsByPk: localList,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const env: Record<string, string | undefined> = {
                NODE_ENV: 'local',
                APP_NAME: 'test-app',
              }
              return env[key]
            },
          },
        },
      ],
    }).compile()
    const s = mod.get(SessionService)
    await s.put('u1', 't1', 'user-tenant', 'item-a', 1)
    expect(localPut).not.toHaveBeenCalled()
    await expect(s.get('u1', 't1', 'tbl', 'id1')).resolves.toBeNull()
    expect(localGet).not.toHaveBeenCalled()
    await expect(s.listByUser('u1', 't1', 'mod')).resolves.toEqual([])
    expect(localList).not.toHaveBeenCalled()
  })

  it('should no-op put and skip Dynamo for get/listByUser when RYW_SESSION_TTL_MINUTES is not positive', async () => {
    const localPut = jest.fn().mockResolvedValue(undefined)
    const localGet = jest.fn()
    const localList = jest.fn()
    const mod = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: DynamoDbService,
          useValue: {
            putItem: localPut,
            getItem: localGet,
            listItemsByPk: localList,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const env: Record<string, string | undefined> = {
                NODE_ENV: 'local',
                APP_NAME: 'test-app',
                RYW_SESSION_TTL_MINUTES: '0',
              }
              return env[key]
            },
          },
        },
      ],
    }).compile()
    const s = mod.get(SessionService)
    await s.put('u1', 't1', 'user-tenant', 'item-a', 1)
    expect(localPut).not.toHaveBeenCalled()
    await expect(s.get('u1', 't1', 'tbl', 'id1')).resolves.toBeNull()
    expect(localGet).not.toHaveBeenCalled()
    await expect(s.listByUser('u1', 't1', 'mod')).resolves.toEqual([])
    expect(localList).not.toHaveBeenCalled()
  })
})
