import { Module } from '@nestjs/common'

import { CustomEventFactory } from './event-factory'
import { MasterModule } from './master/master.module'
import { prismaLoggingMiddleware, PrismaModule } from './prisma'

@Module({
  imports: [
    PrismaModule.forRoot({
      isGlobal: true,
      prismaServiceOptions: {
        middlewares: [prismaLoggingMiddleware()],
        prismaOptions: {
          log: ['info', 'error', 'warn', 'query'],
          // log: ['error'],
        },
        explicitConnect: false,
      },
    }),
    MasterModule,
  ],
  providers: [CustomEventFactory],
})
export class MainModule {}
