import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { createMock } from '@golevelup/ts-jest'

import {
  NOTIFICATION_TRANSPORT,
  NotificationTransportMap,
} from './interfaces/notification-transport.interface'
import { NotificationTransport } from './enums'
import { NotificationModule } from './notification.module'
import { AppSyncService } from './appsync.service'
import { AppSyncEventsService } from './appsync-events.service'

function makeConfigService(notificationTransports: string | undefined) {
  const mock = createMock<ConfigService>()
  mock.get.mockImplementation((key: string) => {
    if (key === 'NOTIFICATION_TRANSPORTS') return notificationTransports
    if (key === 'APPSYNC_ENDPOINT') return 'http://localhost:20002'
    if (key === 'APPSYNC_EVENTS_ENDPOINT')
      return 'https://test.appsync-api.ap-northeast-1.amazonaws.com/event'
    if (key === 'APPSYNC_EVENTS_NAMESPACE') return 'default'
    return undefined
  })
  return mock
}

async function buildModule(
  notificationTransports: string | undefined,
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [NotificationModule.register()],
  })
    .overrideProvider(ConfigService)
    .useValue(makeConfigService(notificationTransports))
    .compile()
}

describe('NotificationModule — NOTIFICATION_TRANSPORT factory', () => {
  it('should default to appsync-graphql map entry when NOTIFICATION_TRANSPORTS is not set', async () => {
    const module = await buildModule(undefined)
    const map = module.get<NotificationTransportMap>(NOTIFICATION_TRANSPORT)

    expect(map).toBeInstanceOf(Map)
    expect(map.size).toBe(1)
    expect(map.has(NotificationTransport.APPSYNC_GRAPHQL)).toBe(true)
    expect(map.get(NotificationTransport.APPSYNC_GRAPHQL)).toBeInstanceOf(
      AppSyncService,
    )
  })

  it(`should register only AppSyncService for '${NotificationTransport.APPSYNC_GRAPHQL}'`, async () => {
    const module = await buildModule(NotificationTransport.APPSYNC_GRAPHQL)
    const map = module.get<NotificationTransportMap>(NOTIFICATION_TRANSPORT)

    expect(map.size).toBe(1)
    expect(map.has(NotificationTransport.APPSYNC_GRAPHQL)).toBe(true)
    expect(map.get(NotificationTransport.APPSYNC_GRAPHQL)).toBeInstanceOf(
      AppSyncService,
    )
    expect(map.has(NotificationTransport.APPSYNC_EVENT)).toBe(false)
  })

  it(`should register only AppSyncEventsService for '${NotificationTransport.APPSYNC_EVENT}'`, async () => {
    const module = await buildModule(NotificationTransport.APPSYNC_EVENT)
    const map = module.get<NotificationTransportMap>(NOTIFICATION_TRANSPORT)

    expect(map.size).toBe(1)
    expect(map.has(NotificationTransport.APPSYNC_EVENT)).toBe(true)
    expect(map.get(NotificationTransport.APPSYNC_EVENT)).toBeInstanceOf(
      AppSyncEventsService,
    )
    expect(map.has(NotificationTransport.APPSYNC_GRAPHQL)).toBe(false)
  })

  it('should register both services for dual-publish', async () => {
    const module = await buildModule(
      `${NotificationTransport.APPSYNC_GRAPHQL},${NotificationTransport.APPSYNC_EVENT}`,
    )
    const map = module.get<NotificationTransportMap>(NOTIFICATION_TRANSPORT)

    expect(map.size).toBe(2)
    expect(map.get(NotificationTransport.APPSYNC_GRAPHQL)).toBeInstanceOf(
      AppSyncService,
    )
    expect(map.get(NotificationTransport.APPSYNC_EVENT)).toBeInstanceOf(
      AppSyncEventsService,
    )
  })

  it('should produce empty map for unknown transport names', async () => {
    const module = await buildModule('unknown-transport')
    const map = module.get<NotificationTransportMap>(NOTIFICATION_TRANSPORT)

    expect(map.size).toBe(0)
  })

  it('should trim whitespace from transport names', async () => {
    const module = await buildModule(
      ` ${NotificationTransport.APPSYNC_GRAPHQL} , ${NotificationTransport.APPSYNC_EVENT} `,
    )
    const map = module.get<NotificationTransportMap>(NOTIFICATION_TRANSPORT)

    expect(map.size).toBe(2)
  })

  it('should allow caller to look up a specific transport by name', async () => {
    const module = await buildModule(
      `${NotificationTransport.APPSYNC_GRAPHQL},${NotificationTransport.APPSYNC_EVENT}`,
    )
    const map = module.get<NotificationTransportMap>(NOTIFICATION_TRANSPORT)

    // Caller can target a specific transport
    const eventsTransport = map.get(NotificationTransport.APPSYNC_EVENT)
    expect(eventsTransport).toBeDefined()
    expect(eventsTransport).toBeInstanceOf(AppSyncEventsService)

    // Caller can check if a transport is active before using it
    expect(map.has(NotificationTransport.APPSYNC_GRAPHQL)).toBe(true)
    expect(map.has('unknown')).toBe(false)
  })
})
