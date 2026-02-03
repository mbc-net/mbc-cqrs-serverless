import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { DirectoryService } from './directory.service'
import {
  CommandService,
  DataService,
  DetailDto,
  IInvoke,
  S3Service,
  getUserContext,
} from '@mbc-cqrs-serverless/core'
import { DynamoService } from './dynamodb.service'
import { PRISMA_SERVICE } from './directory.module-definition'
import {
  DirectoryAttributes,
  FilePermission,
  FileRole,
  PermissionDto,
} from './dto/directory-attributes.dto'
import { DirectoryDataEntity } from './entity/directory-data.entity'
import { DirectoryCreateDto } from './dto/directory-create.dto'
import { DirectoryCopyDto } from './dto/directory-copy.dto'
import { DirectoryMoveDto } from './dto/directory-move.dto'
import { DirectoryUpdateDto } from './dto/directory-update.dto'
import { DirectoryRenameDto } from './dto/directory-rename.dto'
import { DirectoryDetailDto } from './dto/directory-detail.dto'

// Mock getUserContext
jest.mock('@mbc-cqrs-serverless/core', () => {
  const original = jest.requireActual('@mbc-cqrs-serverless/core')
  return {
    ...original,
    getUserContext: jest.fn(),
  }
})

const mockGetUserContext = getUserContext as jest.MockedFunction<
  typeof getUserContext
>

describe('DirectoryService', () => {
  let service: DirectoryService
  let commandService: jest.Mocked<CommandService>
  let dataService: jest.Mocked<DataService>
  let s3Service: jest.Mocked<S3Service>
  let dynamoService: jest.Mocked<DynamoService>
  let prismaService: any

  const mockInvokeContext: IInvoke = {
    context: { awsRequestId: 'test-request-id' },
    event: { requestContext: { http: { sourceIp: '127.0.0.1' } } },
  }

  const mockUserContext = {
    tenantCode: 'TEST_TENANT',
    userId: 'user-123',
  }

  const createMockDirectoryData = (
    overrides?: Partial<DirectoryDataEntity>,
  ): DirectoryDataEntity => {
    return {
      pk: 'DIRECTORY#TEST_TENANT',
      sk: 'test-ulid-123',
      id: 'DIRECTORY#TEST_TENANT#test-ulid-123',
      code: 'test-ulid-123',
      name: 'Test Directory',
      version: 1,
      type: 'folder',
      tenantCode: 'TEST_TENANT',
      isDeleted: false,
      attributes: {
        parentId: null,
        ancestors: [],
        owner: { email: 'owner@example.com', ownerId: 'user-123' },
        permission: {
          type: FilePermission.GENERAL,
          role: FileRole.WRITE,
        },
        inheritance: true,
        expirationTime: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as DirectoryDataEntity
  }

  beforeEach(async () => {
    mockGetUserContext.mockReturnValue(mockUserContext as any)

    const mockS3Client = {
      send: jest.fn().mockResolvedValue({}),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectoryService,
        {
          provide: CommandService,
          useValue: createMock<CommandService>(),
        },
        {
          provide: DataService,
          useValue: createMock<DataService>(),
        },
        {
          provide: S3Service,
          useValue: {
            client: mockS3Client,
            privateBucket: 'test-bucket',
          },
        },
        {
          provide: DynamoService,
          useValue: createMock<DynamoService>(),
        },
        {
          provide: PRISMA_SERVICE,
          useValue: {
            directory: {
              groupBy: jest.fn(),
            },
          },
        },
      ],
    }).compile()

    service = module.get<DirectoryService>(DirectoryService)
    commandService = module.get(CommandService)
    dataService = module.get(DataService)
    s3Service = module.get(S3Service)
    dynamoService = module.get(DynamoService)
    prismaService = module.get(PRISMA_SERVICE)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  // ============================================
  // CREATE TESTS
  // ============================================
  describe('create', () => {
    it('should create a root directory successfully', async () => {
      const createDto: DirectoryCreateDto = {
        name: 'Root Folder',
        type: 'folder',
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
        },
      }

      const mockResult = createMockDirectoryData({ name: 'Root Folder' })
      commandService.publishAsync.mockResolvedValue(mockResult as any)

      const result = await service.create(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(DirectoryDataEntity)
      expect(result.name).toBe('Root Folder')
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Root Folder',
          type: 'folder',
        }),
        expect.any(Object),
      )
    })

    it('should create a child directory with correct ancestors', async () => {
      const parentData = createMockDirectoryData({
        sk: 'parent-ulid',
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      const createDto: DirectoryCreateDto = {
        name: 'Child Folder',
        type: 'folder',
        attributes: {
          parentId: 'parent-ulid',
          ancestors: ['parent-ulid'],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
        },
      }

      dataService.getItem.mockResolvedValue(parentData)
      const mockResult = createMockDirectoryData({
        name: 'Child Folder',
        attributes: {
          ...createDto.attributes,
          ancestors: ['parent-ulid'],
        },
      })
      commandService.publishAsync.mockResolvedValue(mockResult as any)

      const result = await service.create(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(result.name).toBe('Child Folder')
    })

    it('should throw ForbiddenException when user lacks write permission on parent', async () => {
      const parentData = createMockDirectoryData({
        sk: 'parent-ulid',
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'other@example.com', ownerId: 'other-user' },
          permission: { type: FilePermission.GENERAL, role: FileRole.READ },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      const createDto: DirectoryCreateDto = {
        name: 'Child Folder',
        type: 'folder',
        attributes: {
          parentId: 'parent-ulid',
          ancestors: ['parent-ulid'],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
        },
      }

      dataService.getItem.mockResolvedValue(parentData)

      await expect(
        service.create(createDto, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  // ============================================
  // PERMISSION TESTS
  // ============================================
  describe('hasPermission', () => {
    it('should return true when user has required permission (GENERAL)', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.hasPermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        [FileRole.WRITE],
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(true)
    })

    it('should return false when permission is expired', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() - 86400000).toISOString(), // Expired
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.hasPermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        [FileRole.WRITE],
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(false)
    })

    it('should return true for DOMAIN permission with matching domain', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: {
            type: FilePermission.DOMAIN,
            role: FileRole.WRITE,
            domain: { email: 'example.com' },
          },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.hasPermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        [FileRole.WRITE],
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(true)
    })

    it('should return false for DOMAIN permission with non-matching domain', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: {
            type: FilePermission.DOMAIN,
            role: FileRole.WRITE,
            domain: { email: 'other.com' },
          },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.hasPermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        [FileRole.WRITE],
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(false)
    })

    it('should return true for RESTRICTED permission with matching user', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: {
            type: FilePermission.RESTRICTED,
            role: FileRole.READ,
            users: [
              {
                email: 'allowed@example.com',
                role: FileRole.WRITE,
                id: 'user-1',
                type: 'EMAIL' as any,
              },
            ],
          },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.hasPermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        [FileRole.WRITE],
        { email: 'allowed@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(true)
    })

    it('should return false for RESTRICTED permission with non-matching user', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: {
            type: FilePermission.RESTRICTED,
            role: FileRole.READ,
            users: [
              {
                email: 'allowed@example.com',
                role: FileRole.WRITE,
                id: 'user-1',
                type: 'EMAIL' as any,
              },
            ],
          },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.hasPermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        [FileRole.WRITE],
        { email: 'notallowed@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(false)
    })

    it('should return true for TENANT permission with matching tenant', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.TENANT, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.hasPermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        [FileRole.WRITE],
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(true)
    })

    it('should return false for TENANT permission with non-matching tenant', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.TENANT, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.hasPermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        [FileRole.WRITE],
        { email: 'user@example.com', tenant: 'OTHER_TENANT' },
      )

      expect(result).toBe(false)
    })
  })

  describe('getEffectiveRole', () => {
    it('should return null when item not found', async () => {
      dataService.getItem.mockResolvedValue(null)

      const result = await service.getEffectiveRole(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'non-existent' },
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBeNull()
    })

    it('should inherit permission from parent when inheritance is true', async () => {
      const childData = createMockDirectoryData({
        sk: 'child-ulid',
        attributes: {
          parentId: 'parent-ulid',
          ancestors: ['parent-ulid'],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: null,
          inheritance: true,
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      const parentData = createMockDirectoryData({
        sk: 'parent-ulid',
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem
        .mockResolvedValueOnce(childData)
        .mockResolvedValueOnce(parentData)

      const result = await service.getEffectiveRole(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'child-ulid' },
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(FileRole.WRITE)
    })

    it('should not inherit permission when inheritance is false', async () => {
      const childData = createMockDirectoryData({
        sk: 'child-ulid',
        attributes: {
          parentId: 'parent-ulid',
          ancestors: ['parent-ulid'],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: null,
          inheritance: false,
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(childData)

      const result = await service.getEffectiveRole(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'child-ulid' },
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBeNull()
    })
  })

  describe('checkPermissionObject', () => {
    it('should return role for GENERAL permission type', () => {
      const permission: PermissionDto = {
        type: FilePermission.GENERAL,
        role: FileRole.WRITE,
      }

      const result = service.checkPermissionObject(
        permission,
        'TEST_TENANT',
        { email: 'anyone@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBe(FileRole.WRITE)
    })

    it('should return null for unmatched permission type', () => {
      const permission: PermissionDto = {
        type: FilePermission.RESTRICTED,
        role: FileRole.WRITE,
        users: [],
      }

      const result = service.checkPermissionObject(
        permission,
        'TEST_TENANT',
        { email: 'user@example.com', tenant: 'TEST_TENANT' },
      )

      expect(result).toBeNull()
    })
  })

  // ============================================
  // FIND TESTS
  // ============================================
  describe('findOne', () => {
    it('should return directory when user has read permission', async () => {
      const mockData = createMockDirectoryData()
      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.findOne(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        { invokeContext: mockInvokeContext },
        { email: 'user@example.com' },
      )

      expect(result).toBeInstanceOf(DirectoryDataEntity)
      expect(result.name).toBe('Test Directory')
    })

    it('should throw ForbiddenException when user lacks read permission', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: {
            type: FilePermission.RESTRICTED,
            role: FileRole.READ,
            users: [
              {
                email: 'other@example.com',
                role: FileRole.READ,
                id: 'other-user',
                type: 'EMAIL' as any,
              },
            ],
          },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      await expect(
        service.findOne(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          { invokeContext: mockInvokeContext },
          { email: 'unauthorized@example.com' },
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should throw NotFoundException when directory not found', async () => {
      // First call for permission check returns data, second for getItem returns null
      const mockData = createMockDirectoryData()
      dataService.getItem
        .mockResolvedValueOnce(mockData) // For hasPermission
        .mockResolvedValueOnce(null) // For findOne getItem

      await expect(
        service.findOne(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'non-existent' },
          { invokeContext: mockInvokeContext },
          { email: 'user@example.com' },
        ),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('findHistory', () => {
    it('should return version history with permission check', async () => {
      const mockData = createMockDirectoryData()
      const mockHistoryItems = [
        { ...mockData, version: 2 },
        { ...mockData, version: 1 },
      ]

      dataService.getItem.mockResolvedValue(mockData)
      dynamoService.listItemsByPk.mockResolvedValue({ items: mockHistoryItems })

      const result = await service.findHistory(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        { invokeContext: mockInvokeContext },
        { email: 'user@example.com' },
      )

      expect(result.total).toBe(3) // current + 2 history items
      expect(result.items).toHaveLength(3)
    })

    it('should throw ForbiddenException when lacking read permission', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.DELETE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      await expect(
        service.findHistory(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          { invokeContext: mockInvokeContext },
          { email: 'user@example.com' },
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  // ============================================
  // UPDATE TESTS
  // ============================================
  describe('update', () => {
    it('should update directory successfully', async () => {
      const mockData = createMockDirectoryData()
      const updateDto: DirectoryUpdateDto = {
        name: 'Updated Name',
        email: 'user@example.com',
      }

      dataService.getItem.mockResolvedValue(mockData)
      const updatedData = { ...mockData, name: 'Updated Name' }
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        updatedData as any,
      )

      const result = await service.update(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        updateDto,
        { invokeContext: mockInvokeContext },
      )

      expect(result.name).toBe('Updated Name')
    })

    it('should throw BadRequestException for mismatched tenant', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'OTHER_TENANT',
        userId: 'user-123',
      } as any)

      const updateDto: DirectoryUpdateDto = {
        name: 'Updated Name',
        email: 'user@example.com',
      }

      await expect(
        service.update(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          updateDto,
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException when directory not found', async () => {
      dataService.getItem.mockResolvedValue(null)

      const updateDto: DirectoryUpdateDto = {
        name: 'Updated Name',
        email: 'user@example.com',
      }

      await expect(
        service.update(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'non-existent' },
          updateDto,
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException when trying to change parentId via update', async () => {
      const mockData = createMockDirectoryData()
      dataService.getItem.mockResolvedValue(mockData)

      const updateDto: DirectoryUpdateDto = {
        email: 'user@example.com',
        attributes: {
          parentId: 'new-parent-id',
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
        },
      }

      await expect(
        service.update(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          updateDto,
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw ForbiddenException when user lacks modify permission', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.READ },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const updateDto: DirectoryUpdateDto = {
        name: 'Updated Name',
        email: 'user@example.com',
      }

      await expect(
        service.update(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          updateDto,
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('updatePermission', () => {
    it('should update permission successfully', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: {
            type: FilePermission.GENERAL,
            role: FileRole.CHANGE_PERMISSION,
          },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        mockData as any,
      )

      const result = await service.updatePermission(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        {
          email: 'user@example.com',
          attributes: {
            inheritance: false,
            permission: { type: FilePermission.TENANT, role: FileRole.WRITE },
          },
        },
        { invokeContext: mockInvokeContext },
      )

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalled()
    })
  })

  describe('rename', () => {
    it('should rename directory successfully', async () => {
      const mockData = createMockDirectoryData()
      dataService.getItem.mockResolvedValue(mockData)

      const renamedData = { ...mockData, name: 'New Name' }
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        renamedData as any,
      )

      const renameDto: DirectoryRenameDto = {
        name: 'New Name',
        email: 'user@example.com',
      }

      const result = await service.rename(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        renameDto,
        { invokeContext: mockInvokeContext },
      )

      expect(result.name).toBe('New Name')
    })

    it('should throw NotFoundException when directory not found', async () => {
      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.rename(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'non-existent' },
          { name: 'New Name', email: 'user@example.com' },
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ============================================
  // COPY/MOVE TESTS
  // ============================================
  describe('copy', () => {
    it('should copy directory successfully', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          s3Key: 'test-tenant/test/file.txt',
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)
      commandService.publishAsync.mockResolvedValue(mockData as any)

      const copyDto: DirectoryCopyDto = {
        path: 'new/path',
        email: 'user@example.com',
        parentId: null,
      }

      const result = await service.copy(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        copyDto,
        { invokeContext: mockInvokeContext },
      )

      expect(s3Service.client.send).toHaveBeenCalled()
      expect(commandService.publishAsync).toHaveBeenCalled()
    })

    it('should throw NotFoundException when source not found', async () => {
      dataService.getItem.mockResolvedValue(null)

      const copyDto: DirectoryCopyDto = {
        path: 'new/path',
        email: 'user@example.com',
        parentId: null,
      }

      await expect(
        service.copy(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'non-existent' },
          copyDto,
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('move', () => {
    it('should move directory successfully', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      // Mock the parent lookup
      const parentData = createMockDirectoryData({
        sk: 'new-parent-id',
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      // Setup mock calls in correct order:
      // 1. getItem for the directory being moved
      // 2. getItem for hasPermission check on the directory
      // 3. getItem for parent lookup
      dataService.getItem
        .mockResolvedValueOnce(mockData) // For the initial getItem call
        .mockResolvedValueOnce(mockData) // For hasPermission -> getItem
        .mockResolvedValueOnce(parentData) // For getItemAttributes on parent

      commandService.publishAsync.mockResolvedValue(mockData as any)

      const moveDto: DirectoryMoveDto = {
        email: 'user@example.com',
        parentId: 'new-parent-id',
      }

      const result = await service.move(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        moveDto,
        { invokeContext: mockInvokeContext },
      )

      expect(commandService.publishAsync).toHaveBeenCalled()
    })

    it('should throw BadRequestException when moving folder into its own subfolder', async () => {
      const mockData = createMockDirectoryData({
        sk: 'folder-ulid',
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      const childData = createMockDirectoryData({
        sk: 'child-ulid',
        attributes: {
          parentId: 'folder-ulid',
          ancestors: ['folder-ulid'],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.WRITE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      // Setup mock calls in correct order:
      // 1. getItem for the directory being moved
      // 2. getItem for hasPermission check on the directory
      // 3. getItem for parent lookup (which is the child that contains this folder in ancestors)
      dataService.getItem
        .mockResolvedValueOnce(mockData) // For the initial getItem call
        .mockResolvedValueOnce(mockData) // For hasPermission -> getItem
        .mockResolvedValueOnce(childData) // For getItemAttributes on parent (child-ulid)

      const moveDto: DirectoryMoveDto = {
        email: 'user@example.com',
        parentId: 'child-ulid',
      }

      await expect(
        service.move(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'folder-ulid' },
          moveDto,
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw ForbiddenException when user lacks modify permission', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.READ },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)

      const moveDto: DirectoryMoveDto = {
        email: 'user@example.com',
        parentId: 'new-parent',
      }

      await expect(
        service.move(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          moveDto,
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  // ============================================
  // REMOVE TESTS
  // ============================================
  describe('remove', () => {
    it('should soft delete directory successfully', async () => {
      const mockData = createMockDirectoryData({
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.DELETE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)
      const deletedData = { ...mockData, isDeleted: true }
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        deletedData as any,
      )

      const result = await service.remove(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        { invokeContext: mockInvokeContext },
        { email: 'user@example.com' },
      )

      expect(result.isDeleted).toBe(true)
    })

    it('should throw BadRequestException for mismatched tenant', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'OTHER_TENANT',
        userId: 'user-123',
      } as any)

      await expect(
        service.remove(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          { invokeContext: mockInvokeContext },
          { email: 'user@example.com' },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException when directory not found', async () => {
      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.remove(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'non-existent' },
          { invokeContext: mockInvokeContext },
          { email: 'user@example.com' },
        ),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('removeFile', () => {
    it('should delete file and remove from S3', async () => {
      const mockData = createMockDirectoryData({
        type: 'file',
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          s3Key: 'test-tenant/test/file.txt',
          permission: { type: FilePermission.GENERAL, role: FileRole.DELETE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)
      const deletedData = {
        ...mockData,
        isDeleted: true,
        attributes: { ...mockData.attributes, s3Key: null },
      }
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        deletedData as any,
      )

      const result = await service.removeFile(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        { invokeContext: mockInvokeContext },
        { email: 'user@example.com' },
      )

      expect(s3Service.client.send).toHaveBeenCalled()
      expect(result.isDeleted).toBe(true)
    })

    it('should handle file without S3 key', async () => {
      const mockData = createMockDirectoryData({
        type: 'file',
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          s3Key: undefined,
          permission: { type: FilePermission.GENERAL, role: FileRole.DELETE },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      dataService.getItem.mockResolvedValue(mockData)
      commandService.publishPartialUpdateAsync.mockResolvedValue({
        ...mockData,
        isDeleted: true,
      } as any)

      await service.removeFile(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        { invokeContext: mockInvokeContext },
        { email: 'user@example.com' },
      )

      expect(s3Service.client.send).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // VERSION MANAGEMENT TESTS
  // ============================================
  describe('restoreHistoryItem', () => {
    it('should restore a specific version', async () => {
      const historyItem = createMockDirectoryData({ version: 2 })
      const latestItem = createMockDirectoryData({ version: 5 })

      commandService.getItem.mockResolvedValue(historyItem as any)
      dataService.getItem.mockResolvedValue(latestItem)
      commandService.publishAsync.mockResolvedValue(historyItem as any)

      const result = await service.restoreHistoryItem(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        '2',
        { email: 'user@example.com' },
        { invokeContext: mockInvokeContext },
      )

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 5, // Should use latest version
        }),
        expect.any(Object),
      )
    })

    it('should throw NotFoundException when version not found', async () => {
      commandService.getItem.mockResolvedValue(null)

      await expect(
        service.restoreHistoryItem(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          '999',
          { email: 'user@example.com' },
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException when lacking write permission', async () => {
      const historyItem = createMockDirectoryData({ version: 2 })
      const latestItem = createMockDirectoryData({
        version: 5,
        attributes: {
          parentId: null,
          ancestors: [],
          owner: { email: 'owner@example.com', ownerId: 'user-123' },
          permission: { type: FilePermission.GENERAL, role: FileRole.READ },
          expirationTime: new Date(Date.now() + 86400000).toISOString(),
        },
      })

      commandService.getItem.mockResolvedValue(historyItem as any)
      dataService.getItem.mockResolvedValue(latestItem)

      await expect(
        service.restoreHistoryItem(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          '2',
          { email: 'user@example.com' },
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('restoreTemporary', () => {
    it('should restore deleted item', async () => {
      const deletedData = createMockDirectoryData({
        isDeleted: true,
      })

      dataService.getItem.mockResolvedValue(deletedData)
      const restoredData = { ...deletedData, isDeleted: false }
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        restoredData as any,
      )

      const result = await service.restoreTemporary(
        { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
        { email: 'user@example.com' },
        { invokeContext: mockInvokeContext },
      )

      expect(result.isDeleted).toBe(false)
    })

    it('should throw NotFoundException when directory not found', async () => {
      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.restoreTemporary(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'non-existent' },
          { email: 'user@example.com' },
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException when directory is not deleted', async () => {
      const mockData = createMockDirectoryData({ isDeleted: false })
      dataService.getItem.mockResolvedValue(mockData)

      await expect(
        service.restoreTemporary(
          { pk: 'DIRECTORY#TEST_TENANT', sk: 'test-ulid' },
          { email: 'user@example.com' },
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getItemAttributes', () => {
    it('should return attributes of existing item', async () => {
      const mockData = createMockDirectoryData()
      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.getItemAttributes({
        pk: 'DIRECTORY#TEST_TENANT',
        sk: 'test-ulid',
      })

      expect(result.owner.email).toBe('owner@example.com')
    })

    it('should throw NotFoundException when item not found', async () => {
      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.getItemAttributes({
          pk: 'DIRECTORY#TEST_TENANT',
          sk: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('getItem', () => {
    it('should return item when found', async () => {
      const mockData = createMockDirectoryData()
      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.getItem({
        pk: 'DIRECTORY#TEST_TENANT',
        sk: 'test-ulid',
      })

      expect(result.name).toBe('Test Directory')
    })

    it('should throw NotFoundException when item not found', async () => {
      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.getItem({
          pk: 'DIRECTORY#TEST_TENANT',
          sk: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('getTenantFileSizeSummary', () => {
    it('should return file size summary by tenant', async () => {
      const mockSummary = [
        {
          tenantCode: 'TENANT_A',
          _sum: { fileSize: 1024000 },
          _count: { _all: 10 },
        },
        {
          tenantCode: 'TENANT_B',
          _sum: { fileSize: 512000 },
          _count: { _all: 5 },
        },
      ]

      prismaService.directory.groupBy.mockResolvedValue(mockSummary)

      const result = await service.getTenantFileSizeSummary()

      expect(result).toHaveLength(2)
      expect(prismaService.directory.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['tenantCode'],
          _sum: { fileSize: true },
          _count: { _all: true },
        }),
      )
    })
  })
})
