import { Test, TestingModule } from '@nestjs/testing'
import { Repository, IMergeOptions } from './repository'
import { DataService } from './data.service'
import { CommandService } from './command.service'
import { SessionService } from '../data-store/session.service'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import {
  DataEntity,
  DataListEntity,
  DataModel,
  CommandModel,
} from '../interfaces'
import { KEY_SEPARATOR } from '../constants'
import * as userContextHelper from '../context/user'

describe('Repository', () => {
  let repository: Repository
  let dataService: jest.Mocked<DataService>
  let commandService: jest.Mocked<CommandService>
  let sessionService: jest.Mocked<SessionService>

  const mockModuleOptions = { tableName: 'user-tenant' }
  const mockTenant = 'tenant-A'
  const mockUserId = 'user-1'
  const mockPk = `USER_TENANT#${mockTenant}`
  const mockSk = 'USER_TENANT#item-1'
  const mockItemId = `${mockPk}#${mockSk}`

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Repository,
        {
          provide: DataService,
          useValue: { getItem: jest.fn(), listItemsByPk: jest.fn() },
        },
        {
          provide: CommandService,
          useValue: { getItem: jest.fn() },
        },
        {
          provide: SessionService,
          useValue: {
            get: jest.fn(),
            delete: jest.fn(),
            listByUser: jest.fn(),
          },
        },
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: mockModuleOptions,
        },
      ],
    }).compile()

    repository = module.get<Repository>(Repository)
    dataService = module.get(DataService)
    commandService = module.get(CommandService)
    sessionService = module.get(SessionService)

    // Default mock for user context
    jest.spyOn(userContextHelper, 'getUserContext').mockReturnValue({
      userId: mockUserId,
      tenantCode: mockTenant,
    } as any)

    // sessionService.delete is fire-and-forget in repository, always returns promise
    sessionService.delete.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getItem — branch and cleanup logic', () => {
    const detailKey = { pk: mockPk, sk: mockSk }
    const options = { invokeContext: {} as any }

    it('should return data directly when no userId is present in context', async () => {
      jest
        .spyOn(userContextHelper, 'getUserContext')
        .mockReturnValue(null as any)
      const mockData = { id: '1' } as DataModel
      dataService.getItem.mockResolvedValue(mockData)

      const result = await repository.getItem(detailKey, options)

      expect(result).toBe(mockData)
      expect(sessionService.get).not.toHaveBeenCalled()
    })

    it('should return data directly when no session exists', async () => {
      sessionService.get.mockResolvedValue(null)
      const mockData = { id: '1' } as DataModel
      dataService.getItem.mockResolvedValue(mockData)

      const result = await repository.getItem(detailKey, options)

      expect(result).toBe(mockData)
      expect(commandService.getItem).not.toHaveBeenCalled()
    })

    it('should DELETE session and return existing when data table caught up (v2 === v2)', async () => {
      sessionService.get.mockResolvedValue({ version: 2 } as any)
      const caughtUp = {
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 2,
        name: 'caught-up',
      } as DataModel
      dataService.getItem.mockResolvedValue(caughtUp)

      const result = await repository.getItem(detailKey, options)

      expect(result).toEqual(caughtUp)
      expect(commandService.getItem).not.toHaveBeenCalled() // Critical path optimization
      expect(sessionService.delete).toHaveBeenCalledWith(
        mockUserId,
        mockTenant,
        mockModuleOptions.tableName,
        mockItemId,
      )
    })

    it('should DELETE session when data table SURPASSED session (v5 > v2)', async () => {
      sessionService.get.mockResolvedValue({ version: 2 } as any)
      dataService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 5,
      } as DataModel)

      const result = await repository.getItem(detailKey, options)

      expect(result.version).toBe(5)
      expect(commandService.getItem).not.toHaveBeenCalled()
      expect(sessionService.delete).toHaveBeenCalled()
    })

    it('should NOT delete session and merge command when data table is lagging (v1 < v2)', async () => {
      sessionService.get.mockResolvedValue({ version: 2 } as any)
      dataService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 1,
        name: 'old',
      } as DataModel)
      commandService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: `${mockSk}@2`,
        version: 2,
        name: 'new',
        code: 'c',
        type: 'TEST',
        tenantCode: mockTenant,
      } as CommandModel)

      const result = await repository.getItem(detailKey, options)

      expect(result.version).toBe(2)
      expect(result.name).toBe('new')
      expect(sessionService.delete).not.toHaveBeenCalled() //
    })

    it('should not throw when sessionService.delete fails (fire-and-forget contract)', async () => {
      sessionService.get.mockResolvedValue({ version: 2 } as any)
      dataService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 2,
      } as DataModel)
      // Service layer error handling check
      sessionService.delete.mockRejectedValue(new Error('DDB outage'))

      await expect(
        repository.getItem(detailKey, options),
      ).resolves.toBeDefined()
    })

    it('should return data table result if commandService returns null', async () => {
      sessionService.get.mockResolvedValue({ version: 2 } as any)
      const mockData = { id: '1', version: 1 } as DataModel
      dataService.getItem.mockResolvedValue(mockData)
      commandService.getItem.mockResolvedValue(null)

      const result = await repository.getItem(detailKey, options)

      expect(result).toBe(mockData)
    })
  })

  describe('listItemsByPk — branch and cleanup logic', () => {
    const opts = { invokeContext: {} as any }

    it('should return base results when latestFlg is false', async () => {
      const baseResult = new DataListEntity({ items: [], lastSk: undefined })
      dataService.listItemsByPk.mockResolvedValue(baseResult)

      const result = await repository.listItemsByPk(
        mockPk,
        {},
        { latestFlg: false },
        opts,
      )

      expect(result).toBe(baseResult)
      expect(sessionService.listByUser).not.toHaveBeenCalled()
    })

    it('should DELETE session and skip merge when existing item already caught up', async () => {
      const caughtUp = {
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 5,
        name: 'caught-up',
      } as DataModel
      dataService.listItemsByPk.mockResolvedValue(
        new DataListEntity({
          items: [new DataEntity(caughtUp)],
          lastSk: undefined,
        }),
      )
      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 5,
        } as any,
      ])

      const result = await repository.listItemsByPk(
        mockPk,
        {},
        { latestFlg: true },
        opts,
      )

      expect(result.items).toHaveLength(1)
      expect(commandService.getItem).not.toHaveBeenCalled()
      expect(sessionService.delete).toHaveBeenCalled() //
    })

    it('should NOT delete session for create-new (regression guard)', async () => {
      dataService.listItemsByPk.mockResolvedValue(
        new DataListEntity({ items: [], lastSk: undefined }),
      )
      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 1,
        } as any,
      ])
      commandService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: `${mockSk}@1`,
        version: 1,
        name: 'new',
        code: 'c',
        type: 'TEST',
        tenantCode: mockTenant,
      } as CommandModel)

      const result = await repository.listItemsByPk(
        mockPk,
        {},
        { latestFlg: true },
        opts,
      )

      expect(result.items).toHaveLength(1)
      expect(sessionService.delete).not.toHaveBeenCalled()
      expect(commandService.getItem).toHaveBeenCalled()
    })

    it('should remove item from result when command.isDeleted is true', async () => {
      const existing = {
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 1,
      } as DataModel
      dataService.listItemsByPk.mockResolvedValue(
        new DataListEntity({
          items: [new DataEntity(existing)],
          lastSk: undefined,
        }),
      )
      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 2,
        } as any,
      ])
      commandService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: `${mockSk}@2`,
        isDeleted: true,
        version: 2,
      } as CommandModel)

      const result = await repository.listItemsByPk(
        mockPk,
        {},
        { latestFlg: true },
        opts,
      )

      expect(result.items).toHaveLength(0)
    })
  })

  describe('listItems (RDS) — branch and cleanup logic', () => {
    const opts = { invokeContext: {} as any }
    const mergeOptions: IMergeOptions<any> = {
      latestFlg: true,
      transformCommand: (cmd) => ({
        id: cmd.id,
        pk: mockPk,
        sk: mockSk,
        version: cmd.version,
        name: cmd.name,
        role: 'viewer',
      }),
      matchesFilter: (item) => item.role === 'viewer',
    }

    it('should return base results when latestFlg is false', async () => {
      const rdsQuery = jest
        .fn()
        .mockResolvedValue({ total: 1, items: [{ id: '1' }] })

      const result = await repository.listItems(
        rdsQuery,
        { latestFlg: false } as any,
        opts,
      )

      expect(result.total).toBe(1)
      expect(sessionService.listByUser).not.toHaveBeenCalled()
    })

    it('should DELETE session and skip command fetch when data table caught up', async () => {
      const rdsQuery = jest.fn().mockResolvedValue({
        total: 1,
        items: [
          {
            id: mockItemId,
            pk: mockPk,
            sk: mockSk,
            version: 5,
            name: 'rds-row',
          },
        ],
      })
      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 5,
        } as any,
      ])
      dataService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 5,
      } as DataModel)

      const result = await repository.listItems(rdsQuery, mergeOptions, opts)

      expect(commandService.getItem).not.toHaveBeenCalled()
      expect(sessionService.delete).toHaveBeenCalled()
      expect(result.total).toBe(1)
    })

    it('should fetch command when data table is lagging', async () => {
      const rdsQuery = jest.fn().mockResolvedValue({
        total: 1,
        items: [
          { id: mockItemId, pk: mockPk, sk: mockSk, version: 1, name: 'old' },
        ],
      })
      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 3,
        } as any,
      ])
      dataService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 1,
      } as DataModel)
      commandService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: `${mockSk}@3`,
        version: 3,
        name: 'new',
        code: 'c',
        type: 'TEST',
        tenantCode: mockTenant,
      } as CommandModel)

      const result = await repository.listItems(rdsQuery, mergeOptions, opts)

      expect(commandService.getItem).toHaveBeenCalled()
      expect(sessionService.delete).not.toHaveBeenCalled()
      expect(result.items[0].name).toBe('new')
    })

    it('should decrement total when item is deleted via command', async () => {
      const rdsQuery = jest.fn().mockResolvedValue({
        total: 1,
        items: [{ id: mockItemId, pk: mockPk, sk: mockSk, version: 1 }],
      })
      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 2,
        } as any,
      ])
      dataService.getItem.mockResolvedValue({
        id: mockItemId,
        version: 1,
      } as DataModel)
      commandService.getItem.mockResolvedValue({
        id: mockItemId,
        isDeleted: true,
        version: 2,
      } as CommandModel)

      const result = await repository.listItems(rdsQuery, mergeOptions, opts)

      expect(result.total).toBe(0)
      expect(result.items).toHaveLength(0)
    })

    it('should respect matchesFilter for create-new items', async () => {
      const rdsQuery = jest.fn().mockResolvedValue({ total: 0, items: [] })
      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 1,
        } as any,
      ])
      dataService.getItem.mockResolvedValue(null)

      // Command shape that will FAIL filter (role is not 'viewer')
      commandService.getItem.mockResolvedValue({
        id: mockItemId,
        version: 1,
        attributes: { role: 'admin' },
        code: 'c',
        name: 'n',
      } as any)

      const filteredMerge: IMergeOptions<any> = {
        ...mergeOptions,
        transformCommand: (cmd) => ({ id: cmd.id, role: cmd.attributes.role }),
      }

      const result = await repository.listItems(rdsQuery, filteredMerge, opts)

      expect(result.total).toBe(0) // Filtered out
      expect(result.items).toHaveLength(0)
    })
  })
})
