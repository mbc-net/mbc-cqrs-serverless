import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common'

import { NOTIFICATION_TRANSPORT_METADATA } from './constants'

/**
 * Decorator to register a class as a Notification Transport.
 * Automatically marks the class as an @Injectable() provider.
 * @param name The unique identifier for this transport (e.g., 'pusher', 'appsync-event')
 */
export function NotificationTransport(name: string) {
  return applyDecorators(
    SetMetadata(NOTIFICATION_TRANSPORT_METADATA, name),
    Injectable(),
  ) as ClassDecorator
}
