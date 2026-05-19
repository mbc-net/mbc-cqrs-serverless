import { Inject, Logger } from '@nestjs/common'

import { EventHandler } from '../../decorators'
import { IEventHandler, INotification } from '../../interfaces'
import {
  NOTIFICATION_TRANSPORT,
  NotificationTransportMap,
} from '../interfaces/notification-transport.interface'
import { NotificationEvent } from './notification.event'

@EventHandler(NotificationEvent)
export class NotificationEventHandler
  implements IEventHandler<NotificationEvent>
{
  private readonly logger = new Logger(NotificationEventHandler.name)

  constructor(
    @Inject(NOTIFICATION_TRANSPORT)
    private readonly transports: NotificationTransportMap,
  ) {}

  async execute(event: NotificationEvent): Promise<void> {
    const body: INotification = JSON.parse(event.body)

    this.logger.debug(
      `execute:: broadcasting via ${this.transports.size} transport(s): [${[...this.transports.keys()].join(', ')}]`,
    )

    await Promise.all(
      [...this.transports.values()].map((t) => t.sendMessage(body)),
    )
  }
}
