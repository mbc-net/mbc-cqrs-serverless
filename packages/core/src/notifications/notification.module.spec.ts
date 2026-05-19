import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'

import { NotificationModule } from './notification.module'
import { EmailService } from './email.service'
import { AppSyncService } from './appsync.service'
import { AppSyncEventsService } from './appsync-events.service'
import { NotificationEventHandler } from './event/notification.event.handler'
import { ExplorerService } from '../services'

describe('NotificationModule', () => {
  it('should provide notification services statically', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [NotificationModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => {
          if (key === 'APPSYNC_ENDPOINT')
            return 'http://localhost:20002/graphql'
          if (key === 'APPSYNC_EVENTS_ENDPOINT')
            return 'http://localhost:20002/event'
          if (key === 'NOTIFICATION_TRANSPORTS')
            return 'appsync-graphql,appsync-event'
          return undefined
        },
      })
      .compile()

    // Verify all static providers are available in the DI container
    expect(module.get(EmailService)).toBeInstanceOf(EmailService)
    expect(module.get(NotificationEventHandler)).toBeInstanceOf(
      NotificationEventHandler,
    )
    expect(module.get(AppSyncService)).toBeInstanceOf(AppSyncService)
    expect(module.get(AppSyncEventsService)).toBeInstanceOf(
      AppSyncEventsService,
    )
    expect(module.get(ExplorerService)).toBeInstanceOf(ExplorerService)
  })
})
