import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { ConfigService } from '@nestjs/config'

import { INotification } from '../../interfaces'
import { AppSyncEventsService } from '../appsync-events.service'
import { AppSyncService } from '../appsync.service'
import {
  NotificationEventHandler,
  TRANSPORT_APPSYNC_EVENT,
  TRANSPORT_APPSYNC_GRAPHQL,
} from './notification.event.handler'
import { NotificationEvent } from './notification.event'

const mockNotification: INotification = {
  id: 'user-tenant#TEST#MBC#publish-sync#data@5',
  table: 'user-tenant',
  pk: 'TEST#MBC',
  sk: 'publish-sync#data@5',
  tenantCode: 'MBC',
  action: 'command-status',
  content: { status: 'finish:FINISHED' },
}

function makeSqsEvent(notification: INotification): NotificationEvent {
  const event = new NotificationEvent()
  event.body = JSON.stringify(notification)
  return event
}

function makeConfigService(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string | undefined> = {
    NOTIFICATION_TRANSPORTS: undefined,
    ...overrides,
  }
  const mock = createMock<ConfigService>()
  mock.get.mockImplementation((key: string) => defaults[key])
  return mock
}

describe('NotificationEventHandler', () => {
  let handler: NotificationEventHandler
  let appSyncService: jest.Mocked<AppSyncService>
  let appSyncEventsService: jest.Mocked<AppSyncEventsService>

  async function buildModule(
    notificationTransports: string | undefined,
  ): Promise<TestingModule> {
    appSyncService = createMock<AppSyncService>()
    appSyncEventsService = createMock<AppSyncEventsService>()
    appSyncService.sendMessage.mockResolvedValue(undefined)
    appSyncEventsService.sendMessage.mockResolvedValue(undefined)

    return Test.createTestingModule({
      providers: [
        NotificationEventHandler,
        { provide: AppSyncService, useValue: appSyncService },
        { provide: AppSyncEventsService, useValue: appSyncEventsService },
        {
          provide: ConfigService,
          useValue: makeConfigService({
            NOTIFICATION_TRANSPORTS: notificationTransports,
          }),
        },
      ],
    }).compile()
  }

  afterEach(() => jest.clearAllMocks())

  it('should be defined', async () => {
    const module = await buildModule(undefined)
    handler = module.get(NotificationEventHandler)
    expect(handler).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Default — no env var set
  // ---------------------------------------------------------------------------
  describe('when NOTIFICATION_TRANSPORTS is not set (default)', () => {
    beforeEach(async () => {
      const module = await buildModule(undefined)
      handler = module.get(NotificationEventHandler)
    })

    it('should default to appsync-graphql', async () => {
      await handler.execute(makeSqsEvent(mockNotification))

      expect(appSyncService.sendMessage).toHaveBeenCalledTimes(1)
      expect(appSyncService.sendMessage).toHaveBeenCalledWith(mockNotification)
      expect(appSyncEventsService.sendMessage).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Single transport: appsync-graphql
  // ---------------------------------------------------------------------------
  describe(`when NOTIFICATION_TRANSPORTS=${TRANSPORT_APPSYNC_GRAPHQL}`, () => {
    beforeEach(async () => {
      const module = await buildModule(TRANSPORT_APPSYNC_GRAPHQL)
      handler = module.get(NotificationEventHandler)
    })

    it('should call only appSyncService.sendMessage', async () => {
      await handler.execute(makeSqsEvent(mockNotification))

      expect(appSyncService.sendMessage).toHaveBeenCalledTimes(1)
      expect(appSyncService.sendMessage).toHaveBeenCalledWith(mockNotification)
      expect(appSyncEventsService.sendMessage).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Single transport: appsync-event
  // ---------------------------------------------------------------------------
  describe(`when NOTIFICATION_TRANSPORTS=${TRANSPORT_APPSYNC_EVENT}`, () => {
    beforeEach(async () => {
      const module = await buildModule(TRANSPORT_APPSYNC_EVENT)
      handler = module.get(NotificationEventHandler)
    })

    it('should call only appSyncEventsService.sendMessage', async () => {
      await handler.execute(makeSqsEvent(mockNotification))

      expect(appSyncEventsService.sendMessage).toHaveBeenCalledTimes(1)
      expect(appSyncEventsService.sendMessage).toHaveBeenCalledWith(
        mockNotification,
      )
      expect(appSyncService.sendMessage).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Dual transport (migration mode)
  // ---------------------------------------------------------------------------
  describe(`when NOTIFICATION_TRANSPORTS=${TRANSPORT_APPSYNC_GRAPHQL},${TRANSPORT_APPSYNC_EVENT}`, () => {
    beforeEach(async () => {
      const module = await buildModule(
        `${TRANSPORT_APPSYNC_GRAPHQL},${TRANSPORT_APPSYNC_EVENT}`,
      )
      handler = module.get(NotificationEventHandler)
    })

    it('should call both services', async () => {
      await handler.execute(makeSqsEvent(mockNotification))

      expect(appSyncService.sendMessage).toHaveBeenCalledTimes(1)
      expect(appSyncService.sendMessage).toHaveBeenCalledWith(mockNotification)
      expect(appSyncEventsService.sendMessage).toHaveBeenCalledTimes(1)
      expect(appSyncEventsService.sendMessage).toHaveBeenCalledWith(
        mockNotification,
      )
    })

    it('should run both in parallel (Promise.all)', async () => {
      const order: string[] = []
      appSyncService.sendMessage.mockImplementation(async () => {
        order.push('graphql')
      })
      appSyncEventsService.sendMessage.mockImplementation(async () => {
        order.push('event')
      })

      await handler.execute(makeSqsEvent(mockNotification))

      expect(order).toHaveLength(2)
      expect(order).toContain('graphql')
      expect(order).toContain('event')
    })

    it('should reject if appSyncService.sendMessage throws', async () => {
      appSyncService.sendMessage.mockRejectedValue(new Error('GraphQL error'))

      await expect(
        handler.execute(makeSqsEvent(mockNotification)),
      ).rejects.toThrow('GraphQL error')
    })

    it('should reject if appSyncEventsService.sendMessage throws', async () => {
      appSyncEventsService.sendMessage.mockRejectedValue(
        new Error('Events error'),
      )

      await expect(
        handler.execute(makeSqsEvent(mockNotification)),
      ).rejects.toThrow('Events error')
    })
  })

  // ---------------------------------------------------------------------------
  // Unknown transport
  // ---------------------------------------------------------------------------
  describe('when NOTIFICATION_TRANSPORTS contains an unknown transport', () => {
    beforeEach(async () => {
      const module = await buildModule('unknown-transport')
      handler = module.get(NotificationEventHandler)
    })

    it('should skip unknown transport without throwing', async () => {
      await expect(
        handler.execute(makeSqsEvent(mockNotification)),
      ).resolves.toBeUndefined()

      expect(appSyncService.sendMessage).not.toHaveBeenCalled()
      expect(appSyncEventsService.sendMessage).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Mixed known + unknown
  // ---------------------------------------------------------------------------
  describe('when NOTIFICATION_TRANSPORTS mixes known and unknown transports', () => {
    beforeEach(async () => {
      const module = await buildModule(
        `${TRANSPORT_APPSYNC_GRAPHQL},unknown-transport`,
      )
      handler = module.get(NotificationEventHandler)
    })

    it('should send via known transport and skip unknown', async () => {
      await handler.execute(makeSqsEvent(mockNotification))

      expect(appSyncService.sendMessage).toHaveBeenCalledTimes(1)
      expect(appSyncEventsService.sendMessage).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Whitespace handling
  // ---------------------------------------------------------------------------
  describe('whitespace trimming in NOTIFICATION_TRANSPORTS', () => {
    it('should trim spaces around transport names', async () => {
      const module = await buildModule(
        ` ${TRANSPORT_APPSYNC_GRAPHQL} , ${TRANSPORT_APPSYNC_EVENT} `,
      )
      handler = module.get(NotificationEventHandler)

      await handler.execute(makeSqsEvent(mockNotification))

      expect(appSyncService.sendMessage).toHaveBeenCalledTimes(1)
      expect(appSyncEventsService.sendMessage).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Body parsing
  // ---------------------------------------------------------------------------
  describe('event body parsing', () => {
    beforeEach(async () => {
      const module = await buildModule(TRANSPORT_APPSYNC_GRAPHQL)
      handler = module.get(NotificationEventHandler)
    })

    it('should parse JSON body and pass notification object', async () => {
      await handler.execute(makeSqsEvent(mockNotification))

      const calledWith = appSyncService.sendMessage.mock.calls[0][0]
      expect(typeof calledWith).toBe('object')
      expect(calledWith).toEqual(mockNotification)
    })

    it('should throw on malformed JSON body', async () => {
      const badEvent = new NotificationEvent()
      badEvent.body = 'not-json'

      await expect(handler.execute(badEvent)).rejects.toThrow()
    })
  })
})
