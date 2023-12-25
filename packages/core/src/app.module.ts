import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { RouterModule, Routes } from '@nestjs/core'

import { AppController } from './app.controller'
import { ConfigurableModuleClass, OPTIONS_TYPE } from './app.module-definition'
import { AppService } from './app.service'
import { DataSyncModule } from './command-events/data-sync.module'
import { DataStoreModule } from './data-store/data-store.module'
import { validate } from './env.validation'
import { EventModule } from './events'
import { NotificationModule } from './notifications/notification.module'
import { QueueModule } from './queue/queue.module'
import { ExplorerService } from './services/explorer.service'
import { StepFunctionModule } from './step-func/step-function.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validationOptions: {
        allowUnknow: false,
        abortEarly: true,
      },
      validate,
    }),
    NotificationModule,
    DataStoreModule,
    DataSyncModule,
    StepFunctionModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService, ExplorerService],
})
export class AppModule extends ConfigurableModuleClass {
  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    const enableEventSourceModule = process.env.EVENT_SOURCE_DISABLED !== 'true'
    const routers: Routes = [
      {
        path: 'api',
        module: options.rootModule,
      },
    ]
    // disable event route for API GW
    if (enableEventSourceModule) {
      routers.push({
        path: 'event',
        module: EventModule,
      })
    }

    const module = super.forRoot(options)
    const imports = [...(module.imports ?? [])]
    imports.push(options.rootModule)
    if (enableEventSourceModule) {
      imports.push(EventModule)
    }
    imports.push(RouterModule.register(routers))

    return {
      ...module,
      imports,
    }
  }
}
