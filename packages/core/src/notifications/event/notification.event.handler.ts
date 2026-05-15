import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EventHandler } from '../../decorators'
import { IEventHandler, INotification } from '../../interfaces'
import { AppSyncService } from '../appsync.service'
import { AppSyncEventsService } from '../appsync-events.service'
import { NotificationEvent } from './notification.event'

export const TRANSPORT_APPSYNC_GRAPHQL = 'appsync-graphql'
export const TRANSPORT_APPSYNC_EVENT = 'appsync-event'

@EventHandler(NotificationEvent)
export class NotificationEventHandler
  implements IEventHandler<NotificationEvent>
{
  private readonly logger = new Logger(NotificationEventHandler.name)
  private readonly transports: string[]

  constructor(
    private readonly appSyncService: AppSyncService,
    private readonly appSyncEventsService: AppSyncEventsService,
    private readonly config: ConfigService,
  ) {
    const raw = config.get<string>('NOTIFICATION_TRANSPORTS') ?? ''
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    this.transports = list.length ? list : [TRANSPORT_APPSYNC_GRAPHQL]
  }

  async execute(event: NotificationEvent): Promise<void> {
    const body: INotification = JSON.parse(event.body)

    this.logger.debug(`execute:: transports=[${this.transports.join(', ')}]`)

    await Promise.all(
      this.transports.map((name) => {
        switch (name) {
          case TRANSPORT_APPSYNC_GRAPHQL:
            return this.appSyncService.sendMessage(body)
          case TRANSPORT_APPSYNC_EVENT:
            return this.appSyncEventsService.sendMessage(body)
          default:
            this.logger.warn(`Unknown transport "${name}", skipping`)
            return Promise.resolve()
        }
      }),
    )
  }
}
