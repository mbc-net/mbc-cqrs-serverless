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
          log:
            process.env.NODE_ENV !== 'local'
              ? ['error']
              : ['info', 'error', 'warn', 'query'],
        },
        explicitConnect: false,
      },
    }),
    MasterModule,
  ],
  providers: [CustomEventFactory],
})
export class MainModule {}
