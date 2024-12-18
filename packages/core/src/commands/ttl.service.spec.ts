import { Test, TestingModule } from '@nestjs/testing'
import { TtlService } from './ttl.service'
import { DynamoDbService } from '../data-store/dynamodb.service'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { CommandModuleOptions } from '../interfaces'
import { TableType } from './enums'

describe('TtlService', () => {
  let service: TtlService
  let dynamoDbService: jest.Mocked<DynamoDbService>
  const tableName = 'test-table'

  const mockOptions: CommandModuleOptions = {
    tableName,
  }

  const mockDynamoDbService = {
    getTableName: jest.fn(),
    getItem: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TtlService,
        { provide: MODULE_OPTIONS_TOKEN, useValue: mockOptions },
        { provide: DynamoDbService, useValue: mockDynamoDbService },
      ],
    }).compile()

    service = module.get<TtlService>(TtlService)
    dynamoDbService = module.get(DynamoDbService)
  })

  describe('calculateTtl', () => {
    it('should return null if getTtlConfiguration returns null', async () => {
      jest.spyOn(service, 'getTtlConfiguration').mockResolvedValue(null)
      const result = await service.calculateTtl(TableType.DATA)
      expect(result).toBeNull()
    })

    it('should return calculated TTL if days are retrieved', async () => {
      jest.spyOn(service, 'getTtlConfiguration').mockResolvedValue(5)
      jest.spyOn(service, 'calculateUnixTime').mockReturnValue(1698796800)

      const result = await service.calculateTtl(TableType.DATA)
      expect(result).toBe(1698796800)
      expect(service.getTtlConfiguration).toHaveBeenCalledWith(
        TableType.DATA,
        undefined,
      )
      expect(service.calculateUnixTime).toHaveBeenCalledWith(5, undefined)
    })
  })

  describe('getTtlConfiguration', () => {
    it('should return null if no TTL data is found', async () => {
      dynamoDbService.getTableName
        .mockReturnValueOnce('local-app-name-master-data') // For master data table
        .mockReturnValueOnce('local-app-test-table-data') // For TTL key
      dynamoDbService.getItem.mockResolvedValue(null)

      const result = await service.getTtlConfiguration(
        TableType.DATA,
        'tenantCode',
      )

      expect(result).toBeNull()
      expect(dynamoDbService.getItem).toHaveBeenCalledWith(
        'local-app-name-master-data',
        {
          pk: expect.any(String),
          sk: expect.any(String),
        },
      )
    })

    it('should return days if TTL data is found', async () => {
      dynamoDbService.getTableName
        .mockReturnValueOnce('local-app-name-master-data') // For master data table
        .mockReturnValueOnce('local-app-test-table-data') // For TTL key
      dynamoDbService.getItem.mockResolvedValue({
        attributes: { days: 90 },
      })

      const result = await service.getTtlConfiguration(
        TableType.DATA,
        'tenantCode',
      )

      expect(result).toBe(90)
      expect(dynamoDbService.getItem).toHaveBeenCalledWith(
        'local-app-name-master-data',
        {
          pk: expect.any(String),
          sk: expect.any(String),
        },
      )
    })

    it('should return null and log error if an exception occurs', async () => {
      dynamoDbService.getTableName.mockReturnValue('local-app-name-master-data')
      dynamoDbService.getItem.mockRejectedValue(new Error('DB Error'))

      const result = await service.getTtlConfiguration(
        TableType.DATA,
        'tenantCode',
      )

      expect(result).toBeNull()
    })
  })

  describe('calculateUnixTime', () => {
    it('should throw an error if days are less than or equal to 0', () => {
      expect(() => service.calculateUnixTime(0)).toThrow(
        'Number of days must be greater than 0.',
      )
    })

    it('should calculate UNIX time based on current time if no startDate is provided', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1734423525000) // Mock current time
      const result = service.calculateUnixTime(1) // Add 1 day
      expect(result).toBe(1734509925) // Next day in UNIX timestamp
    })

    it('should calculate UNIX time based on provided startDate', () => {
      const startDate = new Date('2023-11-01T00:00:00Z')
      const result = service.calculateUnixTime(2, startDate)
      expect(result).toBe(1698796800 + 2 * 86400) // StartDate + 2 days
    })
  })
})
