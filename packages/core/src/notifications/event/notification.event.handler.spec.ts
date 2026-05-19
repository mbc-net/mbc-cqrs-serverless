import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'

import { INotification } from '../../interfaces'
import { ExplorerService } from '../../services'
import { INotificationTransport } from '../interfaces/notification-transport.interface'
import { NotificationEventHandler } from './notification.event.handler'
import { NotificationEvent } from './notification.event'
import { NotificationTransport } from '../../decorators'

// --- Mock Transports ---

@NotificationTransport('mock-transport')
class MockTransport implements INotificationTransport {
  sendMessage = jest.fn().mockResolvedValue(undefined)
}

@NotificationTransport('other-transport')
class OtherTransport implements INotificationTransport {
  sendMessage = jest.fn().mockResolvedValue(undefined)
}

@NotificationTransport('unconfigured-transport')
class UnconfiguredTransport implements INotificationTransport {
  sendMessage = jest.fn().mockResolvedValue(undefined)
}

// --- Test Data ---

const mockNotification: INotification = {
  id: 'test-id',
  table: 'test-table',
  pk: 'TEST#MBC',
  sk: 'publish-sync@5',
  tenantCode: 'MBC',
  action: 'command-status',
  content: { status: 'finish:FINISHED' },
}

function makeSqsEvent(notification: INotification): NotificationEvent {
  const event = new NotificationEvent()
  event.body = JSON.stringify(notification)
  return event
}

// --- Helper ---

async function buildModule(
  activeTransports: string | undefined,
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      NotificationEventHandler,
      {
        provide: ConfigService,
        useValue: { get: () => activeTransports },
      },
      {
        provide: ExplorerService,
        useValue: {
          exploreNotificationTransports: () => ({
            // Explorer pretends to find all three decorated classes in the app
            notificationTransports: [
              MockTransport,
              OtherTransport,
              UnconfiguredTransport,
            ],
          }),
        },
      },
      MockTransport,
      OtherTransport,
      UnconfiguredTransport,
    ],
  }).compile()
}

describe('NotificationEventHandler', () => {
  afterEach(() => jest.clearAllMocks())

  describe('onModuleInit (Discovery & Registration)', () => {
    it('should initialize default transport if NOTIFICATION_TRANSPORTS is not set', async () => {
      const module = await buildModule(undefined)
      const handler = module.get(NotificationEventHandler)

      handler.onModuleInit()

      // The fallback is 'appsync-graphql'. Since our mock Explorer doesn't return
      // 'appsync-graphql', the internal map should be empty.
      expect((handler as any).transports.size).toBe(0)
      expect((handler as any).activeTransportNames).toEqual(['appsync-graphql'])
    })

    it('should only initialize transports explicitly requested in config', async () => {
      // We only want 'mock-transport'. 'unconfigured-transport' should be ignored.
      const module = await buildModule('mock-transport')
      const handler = module.get(NotificationEventHandler)

      handler.onModuleInit()

      const transportsMap = (handler as any).transports
      expect(transportsMap.size).toBe(1)
      expect(transportsMap.has('mock-transport')).toBe(true)
      expect(transportsMap.has('unconfigured-transport')).toBe(false)
    })

    it('should auto-assign the "name" property to the instance if missing', async () => {
      const module = await buildModule('mock-transport')
      const handler = module.get(NotificationEventHandler)
      const transportInstance = module.get(MockTransport)

      // Before init, it has no name property defined manually
      expect((transportInstance as any).name).toBeUndefined()

      handler.onModuleInit()

      // After init, the handler should have patched the decorator name onto the instance
      expect((transportInstance as any).name).toBe('mock-transport')
    })

    it('should support multiple active transports', async () => {
      const module = await buildModule('mock-transport, other-transport')
      const handler = module.get(NotificationEventHandler)

      handler.onModuleInit()

      const transportsMap = (handler as any).transports
      expect(transportsMap.size).toBe(2)
      expect(transportsMap.has('mock-transport')).toBe(true)
      expect(transportsMap.has('other-transport')).toBe(true)
    })
  })

  describe('execute (Broadcasting)', () => {
    it('should broadcast notification to all active transports', async () => {
      const module = await buildModule('mock-transport, other-transport')
      const handler = module.get(NotificationEventHandler)

      const mockTransport = module.get(MockTransport)
      const otherTransport = module.get(OtherTransport)
      const unconfiguredTransport = module.get(UnconfiguredTransport)

      handler.onModuleInit() // Wire them up
      await handler.execute(makeSqsEvent(mockNotification))

      // Active ones should receive the message
      expect(mockTransport.sendMessage).toHaveBeenCalledTimes(1)
      expect(mockTransport.sendMessage).toHaveBeenCalledWith(mockNotification)

      expect(otherTransport.sendMessage).toHaveBeenCalledTimes(1)
      expect(otherTransport.sendMessage).toHaveBeenCalledWith(mockNotification)

      // Unconfigured one should NOT receive the message
      expect(unconfiguredTransport.sendMessage).not.toHaveBeenCalled()
    })

    it('should reject if any active transport throws an error', async () => {
      const module = await buildModule('mock-transport, other-transport')
      const handler = module.get(NotificationEventHandler)

      const mockTransport = module.get(MockTransport)
      mockTransport.sendMessage.mockRejectedValue(new Error('Pusher is down!'))

      handler.onModuleInit()

      await expect(
        handler.execute(makeSqsEvent(mockNotification)),
      ).rejects.toThrow('Pusher is down!')
    })

    it('should throw on malformed JSON body', async () => {
      const module = await buildModule('mock-transport')
      const handler = module.get(NotificationEventHandler)

      handler.onModuleInit()

      const badEvent = new NotificationEvent()
      badEvent.body = 'not-json'

      await expect(handler.execute(badEvent)).rejects.toThrow(SyntaxError)
    })
  })
})
