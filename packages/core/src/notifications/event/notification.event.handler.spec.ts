import { Test, TestingModule } from '@nestjs/testing'

import { INotification } from '../../interfaces'
import {
  INotificationTransport,
  NOTIFICATION_TRANSPORT,
  NotificationTransportMap,
} from '../interfaces/notification-transport.interface'
import { NotificationTransport } from '../enums'
import { NotificationEventHandler } from './notification.event.handler'
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

function makeMockTransport(): jest.Mocked<INotificationTransport> {
  return { sendMessage: jest.fn().mockResolvedValue(undefined) }
}

async function buildModule(
  map: NotificationTransportMap,
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      NotificationEventHandler,
      { provide: NOTIFICATION_TRANSPORT, useValue: map },
    ],
  }).compile()
}

describe('NotificationEventHandler', () => {
  afterEach(() => jest.clearAllMocks())

  it('should be defined', async () => {
    const module = await buildModule(new Map())
    expect(module.get(NotificationEventHandler)).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Empty map
  // ---------------------------------------------------------------------------
  describe('with empty transport map', () => {
    it('should resolve without error', async () => {
      const module = await buildModule(new Map())
      const handler = module.get(NotificationEventHandler)

      await expect(
        handler.execute(makeSqsEvent(mockNotification)),
      ).resolves.toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Single transport
  // ---------------------------------------------------------------------------
  describe('with one transport', () => {
    it('should call sendMessage on the single transport', async () => {
      const transport = makeMockTransport()
      const map: NotificationTransportMap = new Map([
        [NotificationTransport.APPSYNC_GRAPHQL, transport],
      ])
      const module = await buildModule(map)
      const handler = module.get(NotificationEventHandler)

      await handler.execute(makeSqsEvent(mockNotification))

      expect(transport.sendMessage).toHaveBeenCalledTimes(1)
      expect(transport.sendMessage).toHaveBeenCalledWith(mockNotification)
    })
  })

  // ---------------------------------------------------------------------------
  // Multiple transports (broadcast)
  // ---------------------------------------------------------------------------
  describe('with multiple transports', () => {
    it('should broadcast to all transports in the map', async () => {
      const t1 = makeMockTransport()
      const t2 = makeMockTransport()
      const map: NotificationTransportMap = new Map([
        [NotificationTransport.APPSYNC_GRAPHQL, t1],
        [NotificationTransport.APPSYNC_EVENT, t2],
      ])
      const module = await buildModule(map)
      const handler = module.get(NotificationEventHandler)

      await handler.execute(makeSqsEvent(mockNotification))

      expect(t1.sendMessage).toHaveBeenCalledTimes(1)
      expect(t1.sendMessage).toHaveBeenCalledWith(mockNotification)
      expect(t2.sendMessage).toHaveBeenCalledTimes(1)
      expect(t2.sendMessage).toHaveBeenCalledWith(mockNotification)
    })

    it('should run all transports in parallel via Promise.all', async () => {
      const order: string[] = []
      const t1: INotificationTransport = {
        sendMessage: jest.fn().mockImplementation(async () => {
          order.push('t1')
        }),
      }
      const t2: INotificationTransport = {
        sendMessage: jest.fn().mockImplementation(async () => {
          order.push('t2')
        }),
      }
      const map: NotificationTransportMap = new Map([
        [NotificationTransport.APPSYNC_GRAPHQL, t1],
        [NotificationTransport.APPSYNC_EVENT, t2],
      ])
      const module = await buildModule(map)
      const handler = module.get(NotificationEventHandler)

      await handler.execute(makeSqsEvent(mockNotification))

      expect(order).toHaveLength(2)
      expect(order).toContain('t1')
      expect(order).toContain('t2')
    })

    it('should reject if any transport throws', async () => {
      const t1 = makeMockTransport()
      const t2: INotificationTransport = {
        sendMessage: jest.fn().mockRejectedValue(new Error('transport error')),
      }
      const map: NotificationTransportMap = new Map([
        [NotificationTransport.APPSYNC_GRAPHQL, t1],
        [NotificationTransport.APPSYNC_EVENT, t2],
      ])
      const module = await buildModule(map)
      const handler = module.get(NotificationEventHandler)

      await expect(
        handler.execute(makeSqsEvent(mockNotification)),
      ).rejects.toThrow('transport error')
    })
  })

  // ---------------------------------------------------------------------------
  // Body parsing
  // ---------------------------------------------------------------------------
  describe('body parsing', () => {
    it('should pass parsed notification object to transports', async () => {
      const transport = makeMockTransport()
      const map: NotificationTransportMap = new Map([
        [NotificationTransport.APPSYNC_GRAPHQL, transport],
      ])
      const module = await buildModule(map)
      const handler = module.get(NotificationEventHandler)

      await handler.execute(makeSqsEvent(mockNotification))

      const received = transport.sendMessage.mock.calls[0][0]
      expect(typeof received).toBe('object')
      expect(received).toEqual(mockNotification)
    })

    it('should throw on malformed JSON body', async () => {
      const module = await buildModule(new Map())
      const handler = module.get(NotificationEventHandler)

      const badEvent = new NotificationEvent()
      badEvent.body = 'not-json'

      await expect(handler.execute(badEvent)).rejects.toThrow()
    })
  })
})
