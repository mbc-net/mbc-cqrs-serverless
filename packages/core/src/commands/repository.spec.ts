import { Test, TestingModule } from '@nestjs/testing'

import { SessionService } from '../data-store/session.service'
import { CommandModel, DataEntity, DataModel } from '../interfaces'
import { ICommandOptions } from '../interfaces/command.options.interface'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { CommandService } from './command.service'
import { DataService } from './data.service'
import { IMergeOptions, Repository } from './repository'

/** Physical DynamoDB data table name (DataService); session SK uses module name only. */
const PHYSICAL_DATA_TABLE = 'local-app-user-tenant-data'
const MODULE_TABLE = 'user-tenant'

const makeInvokeContext = (
  userId = 'user-1',
): ICommandOptions['invokeContext'] =>
  ({
    event: {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: userId,
              'custom:roles': '[]',
            },
          },
        },
      },
      headers: { 'x-tenant-code': 'tenant-a' },
    },
    context: {},
  }) as unknown as ICommandOptions['invokeContext']

const makeCmd = (
  id: string,
  version: number,
  isDeleted = false,
): CommandModel => ({
  pk: 'USER_TENANT#tenant-A',
  sk: `USER_TENANT#${id}@${version}`,
  id: `USER_TENANT#tenant-A#USER_TENANT#${id}`,
  code: id,
  name: id,
  version,
  tenantCode: 'tenant-A',
  type: 'USER_TENANT',
  isDeleted,
  attributes: { role: 'admin' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  createdBy: 'user-1',
  updatedBy: 'user-1',
})

const makeDataModel = (id: string, version = 1): DataModel => ({
  pk: 'USER_TENANT#tenant-A',
  sk: `USER_TENANT#${id}`,
  id: `USER_TENANT#tenant-A#USER_TENANT#${id}`,
  code: id,
  name: id,
  version,
  tenantCode: 'tenant-A',
  type: 'USER_TENANT',
  attributes: { role: 'viewer' },
  cpk: 'USER_TENANT#tenant-A',
  csk: `USER_TENANT#${id}@${version}`,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  createdBy: 'user-1',
  updatedBy: 'user-1',
})

const mockDataService = {
  tableName: PHYSICAL_DATA_TABLE,
  getItem: jest.fn(),
  listItemsByPk: jest.fn(),
}

const mockCommandService = {
  getItem: jest.fn(),
}

const mockSessionService = {
  get: jest.fn(),
  listByUser: jest.fn(),
}

const mockOptions = { tableName: MODULE_TABLE }

describe('Repository', () => {
  let repo: Repository

  beforeEach(async () => {
    jest.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Repository,
        { provide: DataService, useValue: mockDataService },
        { provide: CommandService, useValue: mockCommandService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: MODULE_OPTIONS_TOKEN, useValue: mockOptions },
      ],
    }).compile()

    repo = module.get(Repository)
  })

  describe('getItem', () => {
    const key = { pk: 'USER_TENANT#tenant-A', sk: 'USER_TENANT#item-1' }
    const opts = { invokeContext: makeInvokeContext() }

    it('should return DataService result when no session exists', async () => {
      mockSessionService.get.mockResolvedValue(null)
      const dataItem = makeDataModel('item-1')
      mockDataService.getItem.mockResolvedValue(dataItem)

      const result = await repo.getItem(key, opts)

      expect(mockSessionService.get).toHaveBeenCalled()
      expect(mockCommandService.getItem).not.toHaveBeenCalled()
      expect(result).toEqual(dataItem)
    })

    it('should return transformed command when session exists', async () => {
      mockSessionService.get.mockResolvedValue({
        version: 3,
        sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-1`,
      })
      const cmd = makeCmd('item-1', 3)
      mockCommandService.getItem.mockResolvedValue(cmd)
      mockDataService.getItem.mockResolvedValue(makeDataModel('item-1', 2))

      const result = await repo.getItem(key, opts)

      expect(mockCommandService.getItem).toHaveBeenCalled()
      expect(result.version).toBe(3)
      expect(result.attributes).toEqual({ role: 'admin' })
    })

    it('should fallback to DataService when command not found', async () => {
      mockSessionService.get.mockResolvedValue({ version: 3 })
      mockCommandService.getItem.mockResolvedValue(null)
      const dataItem = makeDataModel('item-1')
      mockDataService.getItem.mockResolvedValue(dataItem)

      const result = await repo.getItem(key, opts)

      expect(result).toEqual(dataItem)
    })

    it('should fallback to DataService when userId is absent', async () => {
      const noUserCtx = { invokeContext: makeInvokeContext('') }
      const dataItem = makeDataModel('item-1')
      mockDataService.getItem.mockResolvedValue(dataItem)

      const result = await repo.getItem(key, noUserCtx)

      expect(mockSessionService.get).not.toHaveBeenCalled()
      expect(result).toEqual(dataItem)
    })
  })

  describe('listItemsByPk', () => {
    const pk = 'USER_TENANT#tenant-A'
    const opts = { invokeContext: makeInvokeContext() }

    it('should return base result when latestFlg is false', async () => {
      const base = {
        items: [new DataEntity(makeDataModel('item-1'))],
        lastSk: undefined,
      }
      mockDataService.listItemsByPk.mockResolvedValue(base)

      const result = await repo.listItemsByPk(
        pk,
        {},
        { latestFlg: false },
        opts,
      )

      expect(mockSessionService.listByUser).not.toHaveBeenCalled()
      expect(result).toEqual(base)
    })

    it('should return base result when no sessions', async () => {
      mockDataService.listItemsByPk.mockResolvedValue({
        items: [],
        lastSk: undefined,
      })
      mockSessionService.listByUser.mockResolvedValue([])

      const result = await repo.listItemsByPk(pk, {}, { latestFlg: true }, opts)

      expect(result.items).toHaveLength(0)
    })

    it('should override existing item (update case)', async () => {
      const existingItem = makeDataModel('item-1', 1)
      mockDataService.listItemsByPk.mockResolvedValue({
        items: [new DataEntity(existingItem)],
        lastSk: undefined,
      })
      mockSessionService.listByUser.mockResolvedValue([
        {
          pk: 'user-1#tenant-A',
          sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-1`,
          version: 2,
        },
      ])
      mockCommandService.getItem.mockResolvedValue(makeCmd('item-1', 2))

      const result = await repo.listItemsByPk(pk, {}, { latestFlg: true }, opts)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].version).toBe(2)
    })

    it('should remove item for delete case', async () => {
      mockDataService.listItemsByPk.mockResolvedValue({
        items: [
          new DataEntity(makeDataModel('item-1')),
          new DataEntity(makeDataModel('item-2')),
        ],
        lastSk: undefined,
      })
      mockSessionService.listByUser.mockResolvedValue([
        {
          pk: 'user-1#tenant-A',
          sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-1`,
          version: 2,
        },
      ])
      mockCommandService.getItem.mockResolvedValue(makeCmd('item-1', 2, true))

      const result = await repo.listItemsByPk(pk, {}, { latestFlg: true }, opts)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('USER_TENANT#tenant-A#USER_TENANT#item-2')
    })

    it('should add create-new item not yet synced', async () => {
      mockDataService.listItemsByPk.mockResolvedValue({
        items: [],
        lastSk: undefined,
      })
      mockSessionService.listByUser.mockResolvedValue([
        {
          pk: 'user-1#tenant-A',
          sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-new`,
          version: 1,
        },
      ])
      mockCommandService.getItem.mockResolvedValue(makeCmd('item-new', 1))

      const result = await repo.listItemsByPk(pk, {}, { latestFlg: true }, opts)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(
        'USER_TENANT#tenant-A#USER_TENANT#item-new',
      )
    })
  })

  describe('listItems', () => {
    const opts = { invokeContext: makeInvokeContext() }

    type RdsItem = {
      id: string
      pk?: string
      sk?: string
      tenantCode: string
      role: string
    }

    const makeRdsItem = (id: string): RdsItem => ({
      id: `USER_TENANT#tenant-A#USER_TENANT#${id}`,
      pk: 'USER_TENANT#tenant-A',
      sk: `USER_TENANT#${id}`,
      tenantCode: 'tenant-A',
      role: 'viewer',
    })

    const mergeOpts: IMergeOptions<RdsItem> = {
      latestFlg: true,
      transformCommand: (cmd) => ({
        id: cmd.id,
        tenantCode: cmd.tenantCode,
        pk: 'USER_TENANT#tenant-A',
        sk: `USER_TENANT#${cmd.code}`,
        role: (cmd.attributes as { role?: string })?.role ?? 'viewer',
      }),
      matchesFilter: (item) => item.role !== 'blocked',
    }

    it('should passthrough when latestFlg is false', async () => {
      const rdsQuery = jest
        .fn()
        .mockResolvedValue({ total: 1, items: [makeRdsItem('item-1')] })

      const result = await repo.listItems(
        rdsQuery,
        { ...mergeOpts, latestFlg: false },
        opts,
      )

      expect(mockSessionService.listByUser).not.toHaveBeenCalled()
      expect(result.total).toBe(1)
    })

    it('should return rds result when no sessions', async () => {
      const rdsQuery = jest
        .fn()
        .mockResolvedValue({ total: 1, items: [makeRdsItem('item-1')] })
      mockSessionService.listByUser.mockResolvedValue([])

      const result = await repo.listItems(rdsQuery, mergeOpts, opts)

      expect(result.total).toBe(1)
    })

    it('should use request tenant for session lookup, not row tenantCode', async () => {
      mockSessionService.listByUser.mockResolvedValue([])
      const rdsQuery = jest.fn().mockResolvedValue({
        total: 1,
        items: [
          {
            ...makeRdsItem('item-1'),
            tenantCode: 'common',
          },
        ],
      })

      await repo.listItems(rdsQuery, mergeOpts, opts)

      expect(mockSessionService.listByUser).toHaveBeenCalledWith(
        'user-1',
        'tenant-a',
        MODULE_TABLE,
      )
    })

    it('should override existing item (update)', async () => {
      const rdsQuery = jest.fn().mockResolvedValue({
        total: 1,
        items: [makeRdsItem('item-1')],
      })
      mockSessionService.listByUser.mockResolvedValue([
        {
          pk: 'user-1#tenant-A',
          sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-1`,
          version: 2,
        },
      ])
      const cmd = makeCmd('item-1', 2)
      cmd.attributes = { role: 'admin' }
      mockCommandService.getItem.mockResolvedValue(cmd)

      const result = await repo.listItems(rdsQuery, mergeOpts, opts)

      expect(result.total).toBe(1)
      expect(result.items[0].role).toBe('admin')
    })

    it('should remove deleted item', async () => {
      const rdsQuery = jest.fn().mockResolvedValue({
        total: 2,
        items: [makeRdsItem('item-1'), makeRdsItem('item-2')],
      })
      mockSessionService.listByUser.mockResolvedValue([
        {
          pk: 'user-1#tenant-A',
          sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-1`,
          version: 2,
        },
      ])
      mockCommandService.getItem.mockResolvedValue(makeCmd('item-1', 2, true))

      const result = await repo.listItems(rdsQuery, mergeOpts, opts)

      expect(result.total).toBe(1)
      expect(result.items.find((i) => i.id.includes('item-1'))).toBeUndefined()
    })

    it('should append create-new item that passes matchesFilter', async () => {
      const rdsQuery = jest
        .fn()
        .mockResolvedValue({ total: 1, items: [makeRdsItem('item-1')] })
      mockSessionService.listByUser.mockResolvedValue([
        {
          pk: 'user-1#tenant-A',
          sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-new`,
          version: 1,
        },
      ])
      const cmd = makeCmd('item-new', 1)
      cmd.attributes = { role: 'admin' }
      mockCommandService.getItem.mockResolvedValue(cmd)

      const result = await repo.listItems(rdsQuery, mergeOpts, opts)

      expect(result.total).toBe(2)
      expect(result.items.find((i) => i.id.includes('item-new'))).toBeDefined()
    })

    it('should NOT append create-new item that fails matchesFilter', async () => {
      const rdsQuery = jest
        .fn()
        .mockResolvedValue({ total: 1, items: [makeRdsItem('item-1')] })
      mockSessionService.listByUser.mockResolvedValue([
        {
          pk: 'user-1#tenant-A',
          sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-blocked`,
          version: 1,
        },
      ])
      const cmd = makeCmd('item-blocked', 1)
      cmd.attributes = { role: 'blocked' }
      mockCommandService.getItem.mockResolvedValue(cmd)

      const result = await repo.listItems(rdsQuery, mergeOpts, opts)

      expect(result.total).toBe(1)
      expect(
        result.items.find((i) => i.id.includes('item-blocked')),
      ).toBeUndefined()
    })

    it('should append create-new item when matchesFilter is not provided', async () => {
      const rdsQuery = jest.fn().mockResolvedValue({ total: 0, items: [] })
      mockSessionService.listByUser.mockResolvedValue([
        {
          pk: 'user-1#tenant-A',
          sk: `${MODULE_TABLE}#USER_TENANT#tenant-A#USER_TENANT#item-new`,
          version: 1,
        },
      ])
      mockCommandService.getItem.mockResolvedValue(makeCmd('item-new', 1))

      const optsNoFilter: IMergeOptions<RdsItem> = {
        latestFlg: true,
        transformCommand: (cmd) => ({
          id: cmd.id,
          tenantCode: cmd.tenantCode,
          role: 'admin',
        }),
      }

      const result = await repo.listItems(rdsQuery, optsNoFilter, opts)

      expect(result.total).toBe(1)
    })
  })
})
