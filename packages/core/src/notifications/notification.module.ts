import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { ExplorerService } from '../services'
import { AppSyncService } from './appsync.service'
import { AppSyncEventsService } from './appsync-events.service'
import { EmailService } from './email.service'
import { NotificationEventHandler } from './event/notification.event.handler'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ExplorerService,
    EmailService,
    NotificationEventHandler,
    AppSyncService,
    AppSyncEventsService,
  ],
  exports: [EmailService, AppSyncService, AppSyncEventsService],
})
export class NotificationModule {}
