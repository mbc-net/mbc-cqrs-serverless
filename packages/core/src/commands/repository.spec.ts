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
import { KEY_SEPARATOR } from '../constants' // Import the actual separator
import * as userContextHelper from '../context/user'

describe('Repository', () => {
  let repository: Repository
  let dataService: jest.Mocked<DataService>
  let commandService: jest.Mocked<CommandService>
  let sessionService: jest.Mocked<SessionService>

  const mockModuleOptions = { tableName: 'test-module' }
  const mockTenant = 'tenant-123'
  const mockUserId = 'user-456'

  // IDs must follow the pattern: {TYPE}#{TENANT}#{BASE_SK}
  const mockItemId = `TEST#${mockTenant}#ITEM-abc`
  const mockPk = `TEST#${mockTenant}`
  const mockSk = 'ITEM-abc'

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

    jest.spyOn(userContextHelper, 'getUserContext').mockReturnValue({
      userId: mockUserId,
      tenantCode: mockTenant,
    } as any)

    sessionService.delete.mockResolvedValue(undefined)
  })

  describe('getItem', () => {
    const detailKey = { pk: mockPk, sk: mockSk }
    const options = { invokeContext: {} as any }

    it('should fetch from CommandService and merge if data table is lagging (v1 < v2)', async () => {
      sessionService.get.mockResolvedValue({ version: 2 } as any)

      const laggingData = {
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 1,
        name: 'old',
      } as DataModel

      const latestCommand = {
        id: mockItemId,
        pk: mockPk,
        sk: `${mockSk}@2`, // Must have a version-suffixed SK
        version: 2,
        name: 'new',
      } as CommandModel

      dataService.getItem.mockResolvedValue(laggingData)
      commandService.getItem.mockResolvedValue(latestCommand)

      const result = await repository.getItem(detailKey, options)

      expect(result.name).toBe('new')
      expect(result.version).toBe(2)
    })
  })

  describe('listItemsByPk', () => {
    it('should prepend a new item if it exists in session but not in base results', async () => {
      dataService.listItemsByPk.mockResolvedValue(
        new DataListEntity({ items: [], lastSk: undefined }),
      )

      // SK in Session table is: {module}#{itemId}
      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 1,
        } as any,
      ])

      const newCmd = {
        id: mockItemId,
        pk: mockPk,
        sk: `${mockSk}@1`,
        version: 1,
        updatedAt: new Date(),
      } as any
      commandService.getItem.mockResolvedValue(newCmd)

      const result = await repository.listItemsByPk(
        mockPk,
        {},
        { latestFlg: true },
        { invokeContext: {} } as any,
      )

      expect(result.items.length).toBe(1)
      expect(result.items[0].id).toBe(mockItemId)
    })
  })

  describe('listItems (External Source/RDS)', () => {
    it('should call dataService.getItem for each session to check sync status', async () => {
      const mockRdsQuery = jest.fn().mockResolvedValue({
        total: 1,
        items: [{ id: mockItemId }],
      })

      sessionService.listByUser.mockResolvedValue([
        {
          sk: `${mockModuleOptions.tableName}${KEY_SEPARATOR}${mockItemId}`,
          version: 10,
        } as any,
      ])

      // Data item must have matching PK/SK to stop the parser from failing
      dataService.getItem.mockResolvedValue({
        id: mockItemId,
        pk: mockPk,
        sk: mockSk,
        version: 10,
      } as any)

      const mergeOptions: IMergeOptions<any> = {
        latestFlg: true,
        transformCommand: (cmd) => cmd,
      }

      await repository.listItems(mockRdsQuery, mergeOptions, {
        invokeContext: {},
      } as any)

      expect(dataService.getItem).toHaveBeenCalled()
      expect(sessionService.delete).toHaveBeenCalled()
    })
  })
})
