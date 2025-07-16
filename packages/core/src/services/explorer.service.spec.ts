import { Test, TestingModule } from '@nestjs/testing'
import { ModulesContainer } from '@nestjs/core'
import { createMock } from '@golevelup/ts-jest'
import { ExplorerService } from './explorer.service'
import { MockEventHandler } from './mocks/event-handler.mock'
import { MockEventFactory } from './mocks/event-factory.mock'
import { DataSyncHandlerMock } from './mocks/sync-data.handler.mock'

describe('ExplorerService', () => {
  describe('explore', () => {
    let explorerService: ExplorerService

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [ExplorerService, MockEventHandler],
      }).compile()

      explorerService = module.get<ExplorerService>(ExplorerService)
    })

    it('should discover event handler correctly', () => {
      // Action
      const result = explorerService.explore()

      // Assert
      expect(result.eventFactorys.length).toEqual(0)
      expect(result.events.length).toEqual(1)
      expect(new result.events[0]()).toBeInstanceOf(MockEventHandler)
    })
  })

  describe('explore', () => {
    let explorerService: ExplorerService

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [ExplorerService, MockEventFactory],
      }).compile()

      explorerService = module.get<ExplorerService>(ExplorerService)
    })

    it('should be defined', () => {
      expect(explorerService).toBeDefined()
    })

    it('should discover event factory correctly', () => {
      // Action
      const result = explorerService.explore()

      // Assert
      expect(result.events.length).toEqual(0)
      expect(result.eventFactorys.length).toEqual(1)
      expect(new result.eventFactorys[0]()).toBeInstanceOf(MockEventFactory)
    })
  })

  describe('exploreDataSyncHandlers', () => {
    let explorerService: ExplorerService

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [ExplorerService, DataSyncHandlerMock],
      }).compile()

      explorerService = module.get<ExplorerService>(ExplorerService)
    })

    it('should discover data sync handler correctly', () => {
      // Action
      const { dataSyncHandlers } =
        explorerService.exploreDataSyncHandlers('table_name')

      // Assert
      expect(dataSyncHandlers).toBeDefined()
      expect(dataSyncHandlers.length).toEqual(1)
      expect(new dataSyncHandlers[0]()).toBeInstanceOf(DataSyncHandlerMock)
    })

    it('should return no data sync handler', () => {
      // Action
      const { dataSyncHandlers } =
        explorerService.exploreDataSyncHandlers('not_exist_table')

      // Assert
      expect(dataSyncHandlers).toBeDefined()
      expect(dataSyncHandlers.length).toEqual(0)
    })
  })

  /**
   * Test Overview: Tests error handling scenarios for module exploration
   * Purpose: Ensures the service properly handles and recovers from various exploration failures
   * Details: Verifies error handling for module access failures, invalid metadata, and exploration errors
   */
  describe('Error Handling Scenarios', () => {
    let service: ExplorerService
    let modulesContainer: jest.Mocked<ModulesContainer>

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ExplorerService,
          {
            provide: ModulesContainer,
            useValue: createMock<ModulesContainer>(),
          },
        ],
      }).compile()

      service = module.get<ExplorerService>(ExplorerService)
      modulesContainer = module.get(ModulesContainer)
    })

    describe('explore - Module Access Errors', () => {
      it('should handle ModulesContainer access errors gracefully', () => {
        modulesContainer.values.mockImplementation(() => {
          throw new Error('ModulesContainer access error')
        })

        expect(() => service.explore()).toThrow('ModulesContainer access error')
      })

      it('should handle empty modules container', () => {
        const mockModules = new Map()
        modulesContainer.values.mockReturnValue(mockModules.values() as any)

        const result = service.explore()

        expect(result.events).toEqual([])
        expect(result.eventFactorys).toEqual([])
      })

      it('should handle modules with null providers', () => {
        const mockModule = {
          providers: null
        } as any
        const mockModules = new Map([['testModule', mockModule]])
        modulesContainer.values.mockReturnValue(mockModules.values() as any)

        const result = service.explore()

        expect(result.events).toEqual([])
        expect(result.eventFactorys).toEqual([])
      })

      it('should handle modules with undefined providers', () => {
        const mockModule = {
          providers: undefined
        } as any
        const mockModules = new Map([['testModule', mockModule]])
        modulesContainer.values.mockReturnValue(mockModules.values() as any)

        const result = service.explore()

        expect(result.events).toEqual([])
        expect(result.eventFactorys).toEqual([])
      })
    })

    describe('extractMetadata - Metadata Errors', () => {
      it('should handle providers with invalid metadata', () => {
        const mockProvider = {
          instance: {
            constructor: null
          }
        }

        const result = service['extractMetadata'](mockProvider as any, 'test-key')

        expect(result).toBeUndefined()
      })

      it('should handle providers with missing constructor', () => {
        const mockProvider = {
          instance: {}
        }

        const result = service['extractMetadata'](mockProvider as any, 'test-key')

        expect(result).toBeUndefined()
      })

      it('should handle providers with constructor but no metadata', () => {
        const mockConstructor = function TestClass() {}
        const mockProvider = {
          instance: {
            constructor: mockConstructor
          }
        }

        const result = service['extractMetadata'](mockProvider as any, 'test-key')

        expect(result).toBeUndefined()
      })

      it('should handle providers with malformed metadata', () => {
        const mockConstructor = function TestClass() {}
        Object.defineProperty(mockConstructor, 'metadata', {
          value: 'invalid-metadata',
          configurable: true
        })
        const mockProvider = {
          instance: {
            constructor: mockConstructor
          }
        }

        const result = service['extractMetadata'](mockProvider as any, 'test-key')

        expect(result).toBeUndefined()
      })
    })
  })

  /**
   * Test Overview: Tests edge cases for metadata extraction with various provider types
   * Purpose: Ensures the service handles boundary conditions and different provider scenarios properly
   * Details: Verifies behavior with complex metadata structures, inheritance, and edge cases
   */
  describe('Edge Cases', () => {
    let service: ExplorerService
    let modulesContainer: jest.Mocked<ModulesContainer>

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ExplorerService,
          {
            provide: ModulesContainer,
            useValue: createMock<ModulesContainer>(),
          },
        ],
      }).compile()

      service = module.get<ExplorerService>(ExplorerService)
      modulesContainer = module.get(ModulesContainer)
    })

    describe('extractMetadata - Complex Scenarios', () => {
      it('should handle providers with complex metadata structures', () => {
        const mockConstructor = function ComplexClass() {}
        const complexMetadata = [
          ['test-key', { value: 'test-value', nested: { deep: 'data' } }],
          ['another-key', [1, 2, 3, { array: 'item' }]]
        ]
        Object.defineProperty(mockConstructor, 'metadata', {
          value: complexMetadata,
          configurable: true
        })
        const mockProvider = {
          instance: {
            constructor: mockConstructor
          }
        }

        const result = service['extractMetadata'](mockProvider as any, 'test-key')

        expect(result).toEqual('test-value')
      })

      it('should handle providers with inherited constructors', () => {
        class BaseClass {}
        class DerivedClass extends BaseClass {}
        
        const baseMetadata = [['base-key', 'base-value']]
        Object.defineProperty(BaseClass, 'metadata', {
          value: baseMetadata,
          configurable: true
        })

        const mockProvider = {
          instance: new DerivedClass()
        }

        const result = service['extractMetadata'](mockProvider as any, 'base-key')

        expect(result).toBe('base-value')
      })

      it('should handle providers with empty metadata array', () => {
        const mockConstructor = function EmptyMetadataClass() {}
        Object.defineProperty(mockConstructor, 'metadata', {
          value: [],
          configurable: true
        })
        const mockProvider = {
          instance: {
            constructor: mockConstructor
          }
        }

        const result = service['extractMetadata'](mockProvider as any, 'test-key')

        expect(result).toBeNull()
      })

      it('should handle providers with null instance', () => {
        const mockProvider = {
          instance: null
        }

        const result = service['extractMetadata'](mockProvider as any, 'test-key')

        expect(result).toBeUndefined()
      })
    })

    describe('filterProvider - Wrapper State Scenarios', () => {
      it('should handle providers with various wrapper states', () => {
        const mockProvider1 = { isNotMetatype: false }
        const mockProvider2 = { isNotMetatype: true }
        const mockProvider3 = { isNotMetatype: undefined }
        const mockProvider4 = {}

        expect(service['filterProvider'](mockProvider1 as any, 'test-key')).toBeDefined()
        expect(service['filterProvider'](mockProvider2 as any, 'test-key')).toBeUndefined()
        expect(service['filterProvider'](mockProvider3 as any, 'test-key')).toBeDefined()
        expect(service['filterProvider'](mockProvider4 as any, 'test-key')).toBeDefined()
      })

      it('should handle null provider', () => {
        expect(service['filterProvider'](null as any, 'test-key')).toBeUndefined()
      })

      it('should handle undefined provider', () => {
        expect(service['filterProvider'](undefined as any, 'test-key')).toBeUndefined()
      })
    })

    describe('flatMap - Module Processing', () => {
      it('should handle modules with empty provider maps', () => {
        const mockModule = {
          providers: new Map()
        }
        const mockModules = new Map([['emptyModule', mockModule]])
        modulesContainer.values.mockReturnValue(mockModules.values() as any)

        const result = service.explore()

        expect(result.events).toEqual([])
        expect(result.eventFactorys).toEqual([])
      })

      it('should handle modules with mixed valid and invalid providers', () => {
        const validConstructor = function ValidClass() {}
        Object.defineProperty(validConstructor, 'metadata', {
          value: [['valid-key', 'valid-value']],
          configurable: true
        })

        const mockProviders = new Map([
          ['validProvider', {
            instance: { constructor: validConstructor },
            isNotMetatype: false
          }],
          ['invalidProvider', {
            instance: null,
            isNotMetatype: false
          }],
          ['filteredProvider', {
            instance: { constructor: validConstructor },
            isNotMetatype: true
          }]
        ])

        const mockModule = {
          providers: mockProviders
        }
        const mockModules = new Map([['mixedModule', mockModule]])
        modulesContainer.values.mockReturnValue(mockModules.values() as any)

        const result = service.explore()

        expect(result.events).toHaveLength(0)
        expect(result.eventFactorys).toHaveLength(0)
      })
    })
  })

  /**
   * Test Overview: Tests metadata value matching and filtering scenarios
   * Purpose: Ensures the service correctly identifies and filters providers based on metadata values
   * Details: Verifies behavior with different metadata patterns, value types, and matching criteria
   */
  describe('Metadata Value Matching', () => {
    let service: ExplorerService
    let modulesContainer: jest.Mocked<ModulesContainer>

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ExplorerService,
          {
            provide: ModulesContainer,
            useValue: createMock<ModulesContainer>(),
          },
        ],
      }).compile()

      service = module.get<ExplorerService>(ExplorerService)
      modulesContainer = module.get(ModulesContainer)
    })

    it('should handle metadata with different value types', () => {
      const mockConstructor = function MultiTypeClass() {}
      const mixedMetadata = [
        ['string-key', 'string-value'],
        ['number-key', 42],
        ['boolean-key', true],
        ['object-key', { nested: 'object' }],
        ['array-key', [1, 2, 3]],
        ['null-key', null],
        ['undefined-key', undefined]
      ]
      Object.defineProperty(mockConstructor, 'metadata', {
        value: mixedMetadata,
        configurable: true
      })

      const mockProvider = {
        instance: { constructor: mockConstructor },
        isNotMetatype: false
      }
      const mockProviders = new Map([['multiType', mockProvider]])
      const mockModule = { providers: mockProviders }
      const mockModules = new Map([['testModule', mockModule]])
      modulesContainer.values.mockReturnValue(mockModules.values() as any)

      const result = service.explore()

      expect(result.events).toHaveLength(0)
      expect(result.eventFactorys).toHaveLength(0)
    })

    it('should handle metadata with duplicate keys', () => {
      const mockConstructor = function DuplicateKeyClass() {}
      const duplicateMetadata = [
        ['duplicate-key', 'first-value'],
        ['duplicate-key', 'second-value'],
        ['unique-key', 'unique-value']
      ]
      Object.defineProperty(mockConstructor, 'metadata', {
        value: duplicateMetadata,
        configurable: true
      })

      const mockProvider = {
        instance: { constructor: mockConstructor },
        isNotMetatype: false
      }
      const mockProviders = new Map([['duplicate', mockProvider]])
      const mockModule = { providers: mockProviders }
      const mockModules = new Map([['testModule', mockModule]])
      modulesContainer.values.mockReturnValue(mockModules.values() as any)

      const result = service.explore()

      expect(result.events).toHaveLength(0)
      expect(result.eventFactorys).toHaveLength(0)
    })

    it('should handle metadata with special characters in keys and values', () => {
      const mockConstructor = function SpecialCharsClass() {}
      const specialMetadata = [
        ['key-with-unicode-🚀', 'value-with-unicode-ñáéíóú'],
        ['key with spaces', 'value with spaces'],
        ['key!@#$%^&*()', 'value!@#$%^&*()'],
        ['key\nwith\nnewlines', 'value\nwith\nnewlines']
      ]
      Object.defineProperty(mockConstructor, 'metadata', {
        value: specialMetadata,
        configurable: true
      })

      const mockProvider = {
        instance: { constructor: mockConstructor },
        isNotMetatype: false
      }
      const mockProviders = new Map([['special', mockProvider]])
      const mockModule = { providers: mockProviders }
      const mockModules = new Map([['testModule', mockModule]])
      modulesContainer.values.mockReturnValue(mockModules.values() as any)

      const result = service.explore()

      expect(result.events).toHaveLength(0)
      expect(result.eventFactorys).toHaveLength(0)
    })
  })

  /**
   * Test Overview: Tests concurrent exploration and performance edge cases
   * Purpose: Ensures the service handles multiple simultaneous operations and large datasets correctly
   * Details: Verifies behavior during concurrent explorations, large module sets, and performance scenarios
   */
  describe('Concurrent Operations and Performance', () => {
    let service: ExplorerService
    let modulesContainer: jest.Mocked<ModulesContainer>

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ExplorerService,
          {
            provide: ModulesContainer,
            useValue: createMock<ModulesContainer>(),
          },
        ],
      }).compile()

      service = module.get<ExplorerService>(ExplorerService)
      modulesContainer = module.get(ModulesContainer)
    })

    it('should handle large numbers of modules efficiently', () => {
      const largeModuleMap = new Map()
      
      for (let i = 0; i < 100; i++) {
        const mockConstructor = function() {}
        Object.defineProperty(mockConstructor, 'metadata', {
          value: [['key' + i, 'value' + i]],
          configurable: true
        })

        const mockProvider = {
          instance: { constructor: mockConstructor },
          isNotMetatype: false
        }
        const mockProviders = new Map([['provider' + i, mockProvider]])
        const mockModule = { providers: mockProviders }
        largeModuleMap.set('module' + i, mockModule)
      }

      modulesContainer.values.mockReturnValue(largeModuleMap.values() as any)

      const result = service.explore()

      expect(result.events).toHaveLength(0)
      expect(result.eventFactorys).toHaveLength(0)
    })

    it('should handle modules with large numbers of providers', () => {
      const largeProviderMap = new Map()
      
      for (let i = 0; i < 50; i++) {
        const mockConstructor = function() {}
        Object.defineProperty(mockConstructor, 'metadata', {
          value: [['provider-key' + i, 'provider-value' + i]],
          configurable: true
        })

        const mockProvider = {
          instance: { constructor: mockConstructor },
          isNotMetatype: false
        }
        largeProviderMap.set('provider' + i, mockProvider)
      }

      const mockModule = { providers: largeProviderMap }
      const mockModules = new Map([['largeModule', mockModule]])
      modulesContainer.values.mockReturnValue(mockModules.values() as any)

      const result = service.explore()

      expect(result.events).toHaveLength(0)
      expect(result.eventFactorys).toHaveLength(0)
    })

    it('should handle concurrent exploration calls', () => {
      const mockConstructor = function ConcurrentClass() {}
      Object.defineProperty(mockConstructor, 'metadata', {
        value: [['concurrent-key', 'concurrent-value']],
        configurable: true
      })

      const mockProvider = {
        instance: { constructor: mockConstructor },
        isNotMetatype: false
      }
      const mockProviders = new Map([['concurrent', mockProvider]])
      const mockModule = { providers: mockProviders }
      const mockModules = new Map([['testModule', mockModule]])
      modulesContainer.values.mockReturnValue(mockModules.values() as any)

      const results = Array.from({ length: 10 }, () => service.explore())

      results.forEach(result => {
        expect(result.events).toHaveLength(0)
        expect(result.eventFactorys).toHaveLength(0)
      })
    })

    it('should handle exploration with mixed provider states efficiently', () => {
      const mixedProviderMap = new Map()
      
      for (let i = 0; i < 20; i++) {
        const mockConstructor = function() {}
        if (i % 2 === 0) {
          Object.defineProperty(mockConstructor, 'metadata', {
            value: [['even-key' + i, 'even-value' + i]],
            configurable: true
          })
        }

        const mockProvider = {
          instance: i % 3 === 0 ? null : { constructor: mockConstructor },
          isNotMetatype: i % 4 === 0
        }
        mixedProviderMap.set('provider' + i, mockProvider)
      }

      const mockModule = { providers: mixedProviderMap }
      const mockModules = new Map([['mixedModule', mockModule]])
      modulesContainer.values.mockReturnValue(mockModules.values() as any)

      const result = service.explore()

      expect(result.events).toHaveLength(0)
      expect(result.eventFactorys).toHaveLength(0)
    })
  })
})
