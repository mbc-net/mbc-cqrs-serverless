import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EventHandler } from '../../decorators'
import { IEventHandler, INotification } from '../../interfaces'
import { AppSyncService } from '../appsync.service'
import { AppSyncEventsService } from '../appsync-events.service'
import { NotificationEvent } from './notification.event'

@EventHandler(NotificationEvent)
export class NotificationEventHandler
  implements IEventHandler<NotificationEvent>
{
  private readonly logger = new Logger(NotificationEventHandler.name)
  private readonly useAppsyncEvents: boolean

  constructor(
    private readonly appSyncService: AppSyncService,
    private readonly appSyncEventsService: AppSyncEventsService,
    private readonly config: ConfigService,
  ) {
    // Opt-in via APPSYNC_EVENTS_ENABLED=true
    // When enabled, publishes to AppSync Events API (HTTP pub/sub, no GraphQL schema needed).
    // When APPSYNC_ENDPOINT is also set, dual-publishes to both during migration.
    // Once migration is complete, unset APPSYNC_ENDPOINT to use Events API only.
    this.useAppsyncEvents =
      this.config.get<boolean>('APPSYNC_EVENTS_ENABLED') === true
  }

  async execute(event: NotificationEvent): Promise<any> {
    this.logger.debug('notification event executing:: ', event)
    const body: INotification = JSON.parse(event.body)

    if (this.useAppsyncEvents) {
      const tasks: Promise<any>[] = [
        this.appSyncEventsService.publishEvent(body),
      ]

      // Dual-publish: also send to the old AppSync Subscription if endpoint is still configured.
      // Remove APPSYNC_ENDPOINT once all clients have migrated to the Events API.
      if (this.config.get<string>('APPSYNC_ENDPOINT')) {
        tasks.push(this.appSyncService.sendMessage(body))
      }

      return Promise.allSettled(tasks)
    }

    // Default: existing AppSync Subscription (GraphQL mutation)
    return this.appSyncService.sendMessage(body)
  }
}
