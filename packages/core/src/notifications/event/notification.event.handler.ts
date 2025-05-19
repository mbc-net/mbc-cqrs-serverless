import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EventHandler } from '../../decorators'
import { IEventHandler, INotification } from '../../interfaces'
import { AppSyncService } from '../appsync.service'
import { NotificationEvent } from './notification.event'

@EventHandler(NotificationEvent)
export class NotificationEventHandler
  implements IEventHandler<NotificationEvent>
{
  private readonly logger = new Logger(NotificationEventHandler.name)

  constructor(
    private readonly appSyncService: AppSyncService,
    private readonly config: ConfigService,
  ) {}

  async execute(event: NotificationEvent): Promise<any> {
    this.logger.debug('notification event executing:: ', event)
    //send to appsync
    const body: INotification = JSON.parse(event.body)

    const secondAppsyncEndpoint = this.config.get<string>(
      'APPSYNC_SECOND_ENDPOINT',
    )
    if (secondAppsyncEndpoint) {
      await this.appSyncService.sendMessage(body, 'second')
    }

    return await this.appSyncService.sendMessage(body)
  }
}
