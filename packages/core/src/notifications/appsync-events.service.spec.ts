import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { ConfigService } from '@nestjs/config'

import { INotification } from '../interfaces'
import { AppSyncEventsService } from './appsync-events.service'

jest.mock('node-fetch', () => jest.fn())

// Standard AppSync Events endpoint — region (ap-northeast-1) is parsed from hostname
const MOCK_ENDPOINT =
  'https://test.appsync-api.ap-northeast-1.amazonaws.com/event'
const MOCK_HOSTNAME = 'test.appsync-api.ap-northeast-1.amazonaws.com'
const MOCK_NAMESPACE = 'default'

const mockNotification: INotification = {
  id: 'user-tenant#TEST#MBC#publish-sync#data@5',
  table: 'user-tenant',
  pk: 'TEST#MBC',
  sk: 'publish-sync#data@5',
  tenantCode: 'MBC',
  action: 'command-status',
  content: { status: 'finish:FINISHED' },
}

function makeConfigService(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string | undefined> = {
    APPSYNC_EVENTS_ENDPOINT: MOCK_ENDPOINT,
    APPSYNC_EVENTS_NAMESPACE: MOCK_NAMESPACE,
    ...overrides,
  }
  const mock = createMock<ConfigService>()
  mock.get.mockImplementation((key: string) => defaults[key])
  return mock
}

describe('AppSyncEventsService', () => {
  let service: AppSyncEventsService
  let mockFetch: jest.MockedFunction<any>

  beforeEach(async () => {
    // Provide AWS credentials for SigV4 signer
    process.env.AWS_ACCESS_KEY_ID = 'test-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
    process.env.AWS_REGION = 'ap-northeast-1'

    mockFetch = require('node-fetch')
    mockFetch.mockResolvedValue({ ok: true })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppSyncEventsService,
        { provide: ConfigService, useValue: makeConfigService() },
      ],
    }).compile()

    service = module.get<AppSyncEventsService>(AppSyncEventsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.AWS_REGION
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // resolveChannel
  // ---------------------------------------------------------------------------
  describe('resolveChannel', () => {
    it('should build correct channel sanitizing # and @ from id', () => {
      const channel = service.resolveChannel(mockNotification)
      expect(channel).toBe(
        '/default/MBC/user-tenant/command-status/user-tenant-TEST-MBC-publish-sync-data-5',
      )
    })

    it('should replace non-alphanumeric characters with dashes', () => {
      const channel = service.resolveChannel({
        ...mockNotification,
        tenantCode: 'tenant_code/extra',
      })
      expect(channel).toContain('tenant-code-extra')
    })

    it('should strip leading and trailing dashes', () => {
      const channel = service.resolveChannel({
        ...mockNotification,
        action: '#command-status#',
      })
      const segments = channel.split('/')
      segments.forEach((seg) => {
        if (seg) {
          expect(seg).not.toMatch(/^-/)
          expect(seg).not.toMatch(/-$/)
        }
      })
    })

    it('should truncate segment to 50 characters', () => {
      const longId = 'a'.repeat(100)
      const channel = service.resolveChannel({
        ...mockNotification,
        id: longId,
      })
      const segments = channel.split('/')
      const idSegment = segments[segments.length - 1]
      expect(idSegment.length).toBeLessThanOrEqual(50)
    })

    it('should fall back to "none" for empty segment', () => {
      const channel = service.resolveChannel({ ...mockNotification, table: '' })
      expect(channel).toContain('/none/')
    })

    it('should use configured namespace as first segment', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AppSyncEventsService,
          {
            provide: ConfigService,
            useValue: makeConfigService({
              APPSYNC_EVENTS_NAMESPACE: 'notifications',
            }),
          },
        ],
      }).compile()
      const svc = module.get<AppSyncEventsService>(AppSyncEventsService)
      expect(svc.resolveChannel(mockNotification)).toMatch(/^\/notifications\//)
    })

    it('should default namespace to "default" when not configured', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AppSyncEventsService,
          {
            provide: ConfigService,
            useValue: makeConfigService({
              APPSYNC_EVENTS_NAMESPACE: undefined,
            }),
          },
        ],
      }).compile()
      const svc = module.get<AppSyncEventsService>(AppSyncEventsService)
      expect(svc.resolveChannel(mockNotification)).toMatch(/^\/default\//)
    })
  })

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------
  describe('sendMessage', () => {
    it('should POST to the endpoint URL', async () => {
      await service.sendMessage(mockNotification)

      expect(mockFetch).toHaveBeenCalledWith(
        MOCK_ENDPOINT,
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('should use IAM SigV4 auth — no x-api-key header', async () => {
      await service.sendMessage(mockNotification)

      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1].headers).not.toHaveProperty('x-api-key')
    })

    it('should include required AppSync Events headers', async () => {
      await service.sendMessage(mockNotification)

      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1].headers).toMatchObject(
        expect.objectContaining({
          host: MOCK_HOSTNAME,
          accept: 'application/json, text/javascript',
          'content-encoding': 'amz-1.0',
        }),
      )
    })

    it('should include channel and events array in request body', async () => {
      await service.sendMessage(mockNotification)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      expect(body).toHaveProperty('id') // crypto.randomUUID()
      expect(body).toHaveProperty('channel')
      expect(body.channel).toBe(service.resolveChannel(mockNotification))
      expect(body).toHaveProperty('events')
      expect(body.events).toHaveLength(1)
      expect(JSON.parse(body.events[0])).toMatchObject(mockNotification)
    })

    it('should include a UUID in the request body', async () => {
      await service.sendMessage(mockNotification)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })

    it('should skip publish and not throw when endpoint is not configured', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AppSyncEventsService,
          {
            provide: ConfigService,
            useValue: makeConfigService({ APPSYNC_EVENTS_ENDPOINT: undefined }),
          },
        ],
      }).compile()
      const svc = module.get<AppSyncEventsService>(AppSyncEventsService)

      await expect(svc.sendMessage(mockNotification)).resolves.toBeUndefined()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should throw when HTTP response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: jest
          .fn()
          .mockResolvedValue(
            '{"errors":[{"message":"Invalid Channel Format"}]}',
          ),
      })

      await expect(service.sendMessage(mockNotification)).rejects.toThrow(
        'AppSync Events publish failed [400]',
      )
    })

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(service.sendMessage(mockNotification)).rejects.toThrow(
        'Network error',
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Region resolution
  // ---------------------------------------------------------------------------
  describe('region resolution', () => {
    it('should parse region from hostname automatically', () => {
      // hostname: test.appsync-api.ap-northeast-1.amazonaws.com → ap-northeast-1
      expect((service as any).signer).toBeDefined()
    })

    it('should fall back to AWS_REGION env var for custom domains', async () => {
      process.env.AWS_REGION = 'us-west-2'
      const module = await Test.createTestingModule({
        providers: [
          AppSyncEventsService,
          {
            provide: ConfigService,
            useValue: makeConfigService({
              // Non-standard hostname — region not parseable from it
              APPSYNC_EVENTS_ENDPOINT:
                'https://custom-domain.example.com/event',
            }),
          },
        ],
      }).compile()
      const svc = module.get<AppSyncEventsService>(AppSyncEventsService)
      // Signer should still be created (falls back to AWS_REGION)
      expect((svc as any).signer).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Client configuration
  // ---------------------------------------------------------------------------
  describe('client configuration', () => {
    it('should parse url from endpoint config', () => {
      expect((service as any).url?.toString()).toBe(MOCK_ENDPOINT)
    })

    it('should not create signer or url when endpoint is missing', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AppSyncEventsService,
          {
            provide: ConfigService,
            useValue: makeConfigService({ APPSYNC_EVENTS_ENDPOINT: undefined }),
          },
        ],
      }).compile()
      const svc = module.get<AppSyncEventsService>(AppSyncEventsService)
      expect((svc as any).url).toBeUndefined()
      expect((svc as any).signer).toBeUndefined()
    })
  })
})
