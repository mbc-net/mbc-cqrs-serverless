import 'reflect-metadata'

import { EVENT_FACTORY_METADATA } from './constants'

export const EventFactory = (): ClassDecorator => {
  return (target: object) => {
    Reflect.defineMetadata(
      EVENT_FACTORY_METADATA,
      EVENT_FACTORY_METADATA,
      target,
    )
  }
}
