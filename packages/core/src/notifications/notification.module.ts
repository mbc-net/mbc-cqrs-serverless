import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { AppSyncService } from './appsync.service'
import { AppSyncEventsService } from './appsync-events.service'
import { EmailService } from './email.service'
import { NotificationTransport } from './enums'
import { NotificationEventHandler } from './event/notification.event.handler'
import {
  INotificationTransport,
  NOTIFICATION_TRANSPORT,
  NotificationTransportMap,
} from './interfaces/notification-transport.interface'

@Module({})
export class NotificationModule {
  static register(): DynamicModule {
    return {
      global: true,
      module: NotificationModule,
      imports: [ConfigModule],
      providers: [
        EmailService,
        NotificationEventHandler,
        {
          provide: NOTIFICATION_TRANSPORT,
          inject: [ConfigService],
          useFactory: (config: ConfigService): NotificationTransportMap => {
            const raw = config.get<string>('NOTIFICATION_TRANSPORTS') ?? ''
            const names = raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            const active = names.length
              ? names
              : [NotificationTransport.APPSYNC_GRAPHQL]

            const map: NotificationTransportMap = new Map<
              string,
              INotificationTransport
            >()

            if (active.includes(NotificationTransport.APPSYNC_GRAPHQL)) {
              map.set(
                NotificationTransport.APPSYNC_GRAPHQL,
                new AppSyncService(config),
              )
            }

            if (active.includes(NotificationTransport.APPSYNC_EVENT)) {
              map.set(
                NotificationTransport.APPSYNC_EVENT,
                new AppSyncEventsService(config),
              )
            }

            return map
          },
        },
      ],
      exports: [NOTIFICATION_TRANSPORT, EmailService],
    }
  }
}
