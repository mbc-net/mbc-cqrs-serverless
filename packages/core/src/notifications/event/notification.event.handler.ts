import { Logger } from '@nestjs/common'

import { EventHandler } from '../../decorators'
import { IEventHandler, INotification } from '../../interfaces'
import { AppSyncService } from '../appsync.service'
import { NotificationEvent } from './notification.event'

@EventHandler(NotificationEvent)
export class NotificationEventHandler
  implements IEventHandler<NotificationEvent>
{
  private readonly logger = new Logger(NotificationEventHandler.name)

  constructor(private readonly appSyncService: AppSyncService) {}

  async execute(event: NotificationEvent): Promise<any> {
    this.logger.debug('notification event executing:: ', event)
    //send to appsync
    const body: INotification = JSON.parse(event.body)
    return await this.appSyncService.sendMessage(body)
  }
}
