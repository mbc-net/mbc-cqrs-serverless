import 'reflect-metadata'

import { ulid } from 'ulid'

import { IEvent } from '../interfaces/event.interface'
import { EVENT_HANDLER_METADATA, EVENT_METADATA } from './constants'

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
