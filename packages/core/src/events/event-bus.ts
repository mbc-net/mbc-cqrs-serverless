import { Injectable, Logger, Type } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'

import { EVENT_HANDLER_METADATA, EVENT_METADATA } from '../decorators'
import {
  EventHandlerNotFoundException,
  InvalidEventHandlerException,
} from '../exceptions'
import { IEvent, IEventHandler } from '../interfaces'
import { EventMetadata } from './event-metadata.interface'

export type EventHandlerType = Type<IEventHandler<IEvent>>

@Injectable()
export class EventBus<EventBase extends IEvent = IEvent> {
  private readonly logger = new Logger(EventBus.name)
  private readonly handlers = new Map<string, IEventHandler<EventBase>[]>()

  constructor(private readonly moduleRef: ModuleRef) {}

  execute<T extends EventBase, R = any>(event: T): Promise<R[]> {
    const eventId = this.getEventId(event)
    const handlers = this.handlers.get(eventId)
    if (!handlers || !handlers.length) {
      throw new EventHandlerNotFoundException(eventId)
    }
    return Promise.all(handlers.map((handler) => handler.execute(event)))
  }

  bind<T extends EventBase>(handler: IEventHandler<T>, id: string) {
    const handlers = this.handlers.get(id) || []
    handlers.push(handler)
    this.handlers.set(id, handlers)

    // this.logger.debug(
    //   'binded handler for ' +
    //     id +
    //     ' => handlers size: ' +
    //     handlers.length +
    //     ' => total event size: ' +
    //     this.handlers.size,
    // )
  }

  register(handlers: EventHandlerType[] = []) {
    handlers.forEach((handler) => this.registerHandler(handler))
  }

  protected registerHandler(handler: EventHandlerType) {
    const instance = this.moduleRef.get(handler, { strict: false })
    if (!instance) {
      return
    }
    const target = this.reflectEventId(handler)
    if (!target) {
      throw new InvalidEventHandlerException()
    }
    this.bind(instance as IEventHandler<EventBase>, target)
  }

  private getEventId(event: EventBase): string {
    const { constructor: eventType } = Object.getPrototypeOf(event)
    const eventMetadata: EventMetadata = Reflect.getMetadata(
      EVENT_METADATA,
      eventType,
    )
    if (!eventMetadata) {
      throw new EventHandlerNotFoundException(eventType.name)
    }

    return eventMetadata.id
  }

  private reflectEventId(handler: EventHandlerType): string | undefined {
    const event: Type<IEvent> = Reflect.getMetadata(
      EVENT_HANDLER_METADATA,
      handler,
    )
    const eventMetadata: EventMetadata = Reflect.getMetadata(
      EVENT_METADATA,
      event,
    )
    return eventMetadata.id
  }
}
