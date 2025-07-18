import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { AppSyncService } from './appsync.service'
import { ConfigService } from '@nestjs/config'
import { INotification } from '../interfaces'

jest.mock('node-fetch', () => jest.fn())

describe('AppSyncService', () => {
  let service: AppSyncService
  let configService: jest.Mocked<ConfigService>
  let mockFetch: jest.MockedFunction<any>

  const mockNotification: INotification = {
    id: 'test-id',
    table: 'test-table',
    pk: 'test-pk',
    sk: 'test-sk',
    tenantCode: 'test-tenant',
    action: 'CREATE',
    content: { data: 'test-content' },
  }

  beforeEach(async () => {
    mockFetch = require('node-fetch')
    mockFetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ data: { sendMessage: mockNotification } }),
    })

    const mockConfigService = createMock<ConfigService>()
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'APPSYNC_ENDPOINT':
          return 'https://test.appsync-api.ap-northeast-1.amazonaws.com/graphql'
        case 'APPSYNC_API_KEY':
          return 'test-api-key'
        default:
          return undefined
      }
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppSyncService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<AppSyncService>(AppSyncService)
    configService = module.get(ConfigService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendMessage', () => {
    it('should send message with API key authentication', async () => {
      const result = await service.sendMessage(mockNotification)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.appsync-api.ap-northeast-1.amazonaws.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            host: 'test.appsync-api.ap-northeast-1.amazonaws.com',
          }),
          body: expect.stringContaining('mutation SEND_MESSAGE'),
        })
      )
      expect(result).toEqual({ data: { sendMessage: mockNotification } })
    })

    it('should send message with IAM authentication when no API key', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
      process.env.AWS_REGION = 'ap-northeast-1'

      const mockConfigServiceNoKey = createMock<ConfigService>()
      mockConfigServiceNoKey.get.mockImplementation((key: string) => {
        switch (key) {
          case 'APPSYNC_ENDPOINT':
            return 'https://test.appsync-api.ap-northeast-1.amazonaws.com/graphql'
          case 'APPSYNC_API_KEY':
            return undefined
          default:
            return undefined
        }
      })

      const newModule: TestingModule = await Test.createTestingModule({
        providers: [
          AppSyncService,
          {
            provide: ConfigService,
            useValue: mockConfigServiceNoKey,
          },
        ],
      }).compile()

      const newService = newModule.get<AppSyncService>(AppSyncService)

      await newService.sendMessage(mockNotification)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.appsync-api.ap-northeast-1.amazonaws.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.not.objectContaining({
            'x-api-key': expect.any(String),
          }),
        })
      )

      delete process.env.AWS_ACCESS_KEY_ID
      delete process.env.AWS_SECRET_ACCESS_KEY
      delete process.env.AWS_REGION
    })

    it('should handle send message errors', async () => {
      const error = new Error('AppSync error')
      mockFetch.mockRejectedValue(error)

      await expect(service.sendMessage(mockNotification)).rejects.toThrow('AppSync error')
    })

    it('should serialize message data correctly in GraphQL variables', async () => {
      await service.sendMessage(mockNotification)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      
      expect(body.variables.message).toBe(JSON.stringify(mockNotification))
      expect(body.query).toContain('mutation SEND_MESSAGE')
    })

    it('should handle response parsing', async () => {
      const mockResponse = { data: { sendMessage: { id: 'response-id' } } }
      mockFetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockResponse),
      })

      const result = await service.sendMessage(mockNotification)

      expect(result).toEqual(mockResponse)
    })
  })

  describe('client configuration', () => {
    it('should configure with correct endpoint and hostname', () => {
      expect(service).toBeDefined()
      expect((service as any).endpoint).toBe('https://test.appsync-api.ap-northeast-1.amazonaws.com/graphql')
      expect((service as any).hostname).toBe('test.appsync-api.ap-northeast-1.amazonaws.com')
    })

    it('should set region to ap-northeast-1', () => {
      expect((service as any).region).toBe('ap-northeast-1')
    })
  })
})
