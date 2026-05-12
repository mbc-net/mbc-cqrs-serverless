import { Global, Module } from '@nestjs/common'

import { AppSyncService } from './appsync.service'
import { AppSyncEventsService } from './appsync-events.service'
import { EmailService } from './email.service'
import { NotificationEventHandler } from './event/notification.event.handler'

@Global()
@Module({
  providers: [
    AppSyncService,
    AppSyncEventsService,
    EmailService,
    NotificationEventHandler,
  ],
  exports: [AppSyncService, AppSyncEventsService, EmailService],
})
export class NotificationModule {}
