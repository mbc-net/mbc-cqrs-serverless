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

    /**
     * Test Overview: Tests edge cases for calculateUnixTime method with extreme values
     * Purpose: Ensures the service handles boundary conditions and extreme date calculations properly
     * Details: Verifies behavior with negative days, very large day values, and edge date scenarios
     */
    describe('Edge Cases', () => {
      it('should throw error for negative days', () => {
        expect(() => service.calculateUnixTime(-1)).toThrow(
          'Number of days must be greater than 0.',
        )
      })

      it('should handle very large day values', () => {
        const startDate = new Date('2023-01-01T00:00:00Z')
        const result = service.calculateUnixTime(365 * 10, startDate) // 10 years
        const expected = Math.floor(startDate.getTime() / 1000) + (365 * 10 * 86400)
        expect(result).toBe(expected)
      })

      it('should handle leap year calculations correctly', () => {
        const leapYearStart = new Date('2024-02-28T00:00:00Z')
        const result = service.calculateUnixTime(2, leapYearStart) // Should cross leap day
        const expected = Math.floor(leapYearStart.getTime() / 1000) + (2 * 86400)
        expect(result).toBe(expected)
      })

      it('should handle year boundary crossing', () => {
        const yearEnd = new Date('2023-12-30T00:00:00Z')
        const result = service.calculateUnixTime(5, yearEnd) // Cross into new year
        const expected = Math.floor(yearEnd.getTime() / 1000) + (5 * 86400)
        expect(result).toBe(expected)
      })
    })
  })

  /**
   * Test Overview: Tests error handling scenarios for TTL service operations
   * Purpose: Ensures the service properly handles and recovers from various error conditions
   * Details: Verifies error handling for DynamoDB failures, configuration issues, and concurrent operations
   */
  describe('Error Handling Scenarios', () => {
    describe('getTtlConfiguration - Advanced Error Cases', () => {
      it('should handle DynamoDB timeout errors gracefully', async () => {
        const timeoutError = new Error('Request timeout')
        timeoutError.name = 'TimeoutError'
        dynamoDbService.getTableName.mockReturnValue('local-app-name-master-data')
        dynamoDbService.getItem.mockRejectedValue(timeoutError)

        const result = await service.getTtlConfiguration(TableType.DATA, 'tenantCode')
        expect(result).toBeNull()
      })

      it('should handle DynamoDB access denied errors', async () => {
        const accessError = new Error('Access denied')
        accessError.name = 'AccessDeniedException'
        dynamoDbService.getTableName.mockReturnValue('local-app-name-master-data')
        dynamoDbService.getItem.mockRejectedValue(accessError)

        const result = await service.getTtlConfiguration(TableType.DATA, 'tenantCode')
        expect(result).toBeNull()
      })

      it('should handle malformed TTL configuration data', async () => {
        dynamoDbService.getTableName
          .mockReturnValueOnce('local-app-name-master-data')
          .mockReturnValueOnce('local-app-test-table-data')
        dynamoDbService.getItem.mockResolvedValue({
          attributes: { days: 'invalid-number' }
        })

        const result = await service.getTtlConfiguration(TableType.DATA, 'tenantCode')
        expect(result).toBeNaN()
      })

      it('should handle missing attributes in configuration', async () => {
        dynamoDbService.getTableName
          .mockReturnValueOnce('local-app-name-master-data')
          .mockReturnValueOnce('local-app-test-table-data')
        dynamoDbService.getItem.mockResolvedValue({
          attributes: {}
        })

        const result = await service.getTtlConfiguration(TableType.DATA, 'tenantCode')
        expect(result).toBeNull()
      })
    })

    describe('calculateTtl - Concurrent Operations', () => {
      it('should handle concurrent TTL calculations correctly', async () => {
        jest.spyOn(service, 'getTtlConfiguration').mockResolvedValue(7)
        jest.spyOn(service, 'calculateUnixTime').mockReturnValue(1698796800)

        const promises = Array.from({ length: 5 }, () => 
          service.calculateTtl(TableType.DATA, 'tenant1')
        )

        const results = await Promise.all(promises)
        results.forEach(result => {
          expect(result).toBe(1698796800)
        })
        expect(service.getTtlConfiguration).toHaveBeenCalledTimes(5)
      })

      it('should handle mixed success and failure scenarios', async () => {
        jest.spyOn(service, 'getTtlConfiguration')
          .mockResolvedValueOnce(7)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(14)
        jest.spyOn(service, 'calculateUnixTime').mockReturnValue(1698796800)

        const results = await Promise.all([
          service.calculateTtl(TableType.DATA, 'tenant1'),
          service.calculateTtl(TableType.DATA, 'tenant2'),
          service.calculateTtl(TableType.DATA, 'tenant3')
        ])

        expect(results[0]).toBe(1698796800)
        expect(results[1]).toBeNull()
        expect(results[2]).toBe(1698796800)
      })
    })

    describe('Different TableType Scenarios', () => {
      it('should handle HISTORY table type correctly', async () => {
        jest.spyOn(service, 'getTtlConfiguration').mockResolvedValue(30)
        jest.spyOn(service, 'calculateUnixTime').mockReturnValue(1698796800)

        const result = await service.calculateTtl(TableType.HISTORY, 'tenantCode')
        expect(result).toBe(1698796800)
        expect(service.getTtlConfiguration).toHaveBeenCalledWith(
          TableType.HISTORY,
          'tenantCode'
        )
      })

      it('should handle undefined tenant code', async () => {
        jest.spyOn(service, 'getTtlConfiguration').mockResolvedValue(15)
        jest.spyOn(service, 'calculateUnixTime').mockReturnValue(1698796800)

        const result = await service.calculateTtl(TableType.DATA)
        expect(result).toBe(1698796800)
        expect(service.getTtlConfiguration).toHaveBeenCalledWith(
          TableType.DATA,
          undefined
        )
      })

      it('should handle empty string tenant code', async () => {
        jest.spyOn(service, 'getTtlConfiguration').mockResolvedValue(null)

        const result = await service.calculateTtl(TableType.DATA, '')
        expect(result).toBeNull()
        expect(service.getTtlConfiguration).toHaveBeenCalledWith(
          TableType.DATA,
          ''
        )
      })
    })
  })
})
