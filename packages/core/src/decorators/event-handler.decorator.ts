import 'reflect-metadata'

import { ulid } from 'ulid'

import { IEvent } from '../interfaces/event.interface'
import { EVENT_HANDLER_METADATA, EVENT_METADATA } from './constants'

/**
 * Decorator that marks a class as an event handler.
 * The handler will be invoked when the specified event is published.
 *
 * @param event - The event class or instance to handle
 * @example
 * ```typescript
 * @EventHandler(OrderCreatedEvent)
 * export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
 *   async handle(event: OrderCreatedEvent) {
 *     // Handle the event
 *   }
 * }
 * ```
 */
export const EventHandler = (
  event: IEvent | (new (...args: any[]) => IEvent),
): ClassDecorator => {
  return (target: object) => {
    if (!Reflect.hasOwnMetadata(EVENT_METADATA, event)) {
      Reflect.defineMetadata(EVENT_METADATA, { id: ulid() }, event)
    }
    Reflect.defineMetadata(EVENT_HANDLER_METADATA, event, target)
  }
}
