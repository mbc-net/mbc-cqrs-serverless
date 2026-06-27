import { Injectable, Logger, Type } from '@nestjs/common'
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import { Module } from '@nestjs/core/injector/module'
import { ModulesContainer } from '@nestjs/core/injector/modules-container'

import { IGroupRoleResolver } from '../auth/group-role-resolver.interface'
import {
  DATA_SYNC_HANDLER_METADATA,
  EVENT_FACTORY_METADATA,
  EVENT_HANDLER_METADATA,
  GROUP_ROLE_RESOLVER_METADATA,
  NOTIFICATION_TRANSPORT_METADATA,
} from '../decorators'
import { IDataSyncHandler, IEventFactory, IEventHandler } from '../interfaces'

@Injectable()
export class ExplorerService {
  private readonly logger = new Logger(ExplorerService.name)

  constructor(private readonly modulesContainer: ModulesContainer) {}

  explore() {
    const modules = [...this.modulesContainer.values()]

    const events = this.flatMap<IEventHandler>(modules, (instance) =>
      this.filterProvider(instance, EVENT_HANDLER_METADATA),
    )
    const eventFactorys = this.flatMap<IEventFactory>(modules, (instance) =>
      this.filterProvider(instance, EVENT_FACTORY_METADATA),
    )
    return { events, eventFactorys }
  }

  exploreDataSyncHandlers(commandTableName: string) {
    const modules = [...this.modulesContainer.values()]
    const dataSyncHandlers = [
      ...new Set(
        this.flatMap<IDataSyncHandler>(modules, (instance) =>
          this.filterProvider(
            instance,
            DATA_SYNC_HANDLER_METADATA,
            commandTableName,
          ),
        ),
      ),
    ]
    return { dataSyncHandlers }
  }

  exploreNotificationTransports() {
    const modules = [...this.modulesContainer.values()]
    const notificationTransports = this.flatMap<any>(modules, (instance) =>
      this.filterProvider(instance, NOTIFICATION_TRANSPORT_METADATA),
    )
    return { notificationTransports }
  }

  exploreGroupRoleResolvers(): Type<IGroupRoleResolver>[] {
    const modules = [...this.modulesContainer.values()]
    return this.flatMap<IGroupRoleResolver>(modules, (instance) =>
      this.filterProvider(instance, GROUP_ROLE_RESOLVER_METADATA),
    )
  }

  flatMap<T>(
    modules: Module[],
    callback: (instance: InstanceWrapper) => Type<any> | undefined,
  ): Type<T>[] {
    const items = modules
      .map((module) => [...module.providers.values()].map(callback))
      .reduce((a, b) => a.concat(b), [])
    return items.filter((element) => !!element) as Type<T>[]
  }

  filterProvider(
    wrapper: InstanceWrapper,
    metadataKey: string,
    metadataValue?: string,
  ): Type<any> | undefined {
    const { instance } = wrapper
    if (!instance) {
      return undefined
    }
    return this.extractMetadata(instance, metadataKey, metadataValue)
  }

  extractMetadata(
    instance: Record<string, any>,
    metadataKey: string,
    metadataValue?: string,
  ): Type<any> {
    if (!instance.constructor) {
      return
    }
    const metadata = Reflect.getMetadata(metadataKey, instance.constructor)
    if (!metadata || (metadataValue && metadata !== metadataValue)) {
      return undefined
    }
    return instance.constructor as Type<any>
  }
}
