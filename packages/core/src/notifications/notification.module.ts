import { Global, Module } from '@nestjs/common'

import { AppSyncService } from './appsync.service'
import { EmailService } from './email.service'
import { NotificationEventHandler } from './event/notification.event.handler'

@Global()
@Module({
  providers: [AppSyncService, EmailService, NotificationEventHandler],
  exports: [AppSyncService, EmailService],
})
export class NotificationModule {}
