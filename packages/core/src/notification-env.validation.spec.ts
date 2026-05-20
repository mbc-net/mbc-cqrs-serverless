import 'reflect-metadata'

import {
  parseNotificationTransports,
  validateBuiltinNotificationTransportEnv,
} from './notification-env.validation'
import { NotificationTransports } from './notifications/enums'

describe('notification-env.validation', () => {
  describe('parseNotificationTransports', () => {
    it('should default to appsync-graphql when unset', () => {
      expect(parseNotificationTransports(undefined)).toEqual([
        NotificationTransports.APPSYNC_GRAPHQL,
      ])
    })

    it('should parse comma-separated names', () => {
      expect(
        parseNotificationTransports('appsync-event, appsync-graphql '),
      ).toEqual([
        NotificationTransports.APPSYNC_EVENT,
        NotificationTransports.APPSYNC_GRAPHQL,
      ])
    })
  })

  describe('validateBuiltinNotificationTransportEnv', () => {
    it('should require APPSYNC_ENDPOINT for default transport', () => {
      expect(() => validateBuiltinNotificationTransportEnv({})).toThrow(
        /APPSYNC_ENDPOINT/,
      )
    })

    it('should pass for custom transport without AppSync endpoints', () => {
      expect(() =>
        validateBuiltinNotificationTransportEnv({
          NOTIFICATION_TRANSPORTS: 'pusher',
        }),
      ).not.toThrow()
    })

    it('should require APPSYNC_EVENTS_ENDPOINT when appsync-event is enabled', () => {
      expect(() =>
        validateBuiltinNotificationTransportEnv({
          NOTIFICATION_TRANSPORTS: 'appsync-event',
        }),
      ).toThrow(/APPSYNC_EVENTS_ENDPOINT/)
    })
  })
})
