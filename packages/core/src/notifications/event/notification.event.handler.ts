import { Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'

import { EventHandler, NOTIFICATION_TRANSPORT_METADATA } from '../../decorators'
import { IEventHandler, INotification } from '../../interfaces'
import { ExplorerService } from '../../services'
import { NotificationTransports } from '../enums'
import { INotificationTransport } from '../interfaces/notification-transport.interface'
import { NotificationEvent } from './notification.event'

@EventHandler(NotificationEvent)
export class NotificationEventHandler
  implements IEventHandler<NotificationEvent>, OnModuleInit
{
  private readonly logger = new Logger(NotificationEventHandler.name)
  private readonly transports = new Map<string, INotificationTransport>()
  private readonly activeTransportNames: string[]

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly explorerService: ExplorerService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('NOTIFICATION_TRANSPORTS') ?? ''
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    this.activeTransportNames = names.length
      ? names
      : [NotificationTransports.APPSYNC_GRAPHQL]
  }

  onModuleInit() {
    this.logger.debug('Finding notification transports from decorators')

    const { notificationTransports } =
      this.explorerService.exploreNotificationTransports()

    for (const TransportClass of notificationTransports) {
      const name = Reflect.getMetadata(
        NOTIFICATION_TRANSPORT_METADATA,
        TransportClass,
      )

      if (this.activeTransportNames.includes(name)) {
        const instance = this.moduleRef.get<INotificationTransport>(
          TransportClass,
          { strict: false },
        )

        // Give the instance its decorator name automatically if it isn't set
        if (!instance.name) {
          instance.name = name
        }

        this.transports.set(name, instance)
      }
    }

    this.logger.debug(
      `Initialized active transports: [${[...this.transports.keys()].join(', ')}]`,
    )
  }

  async execute(event: NotificationEvent): Promise<void> {
    const body: INotification = JSON.parse(event.body)

    this.logger.debug(
      `execute:: broadcasting via ${this.transports.size} transport(s)`,
    )

    await Promise.all(
      [...this.transports.values()].map((t) => t.sendMessage(body)),
    )
  }
}
