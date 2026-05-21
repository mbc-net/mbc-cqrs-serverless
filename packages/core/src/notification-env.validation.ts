import { NotificationTransports } from './notifications/enums'

/** Built-in transports and their required endpoint environment variables. */
export const BUILTIN_NOTIFICATION_TRANSPORT_ENV: Record<string, string> = {
  [NotificationTransports.APPSYNC_GRAPHQL]: 'APPSYNC_ENDPOINT',
  [NotificationTransports.APPSYNC_EVENT]: 'APPSYNC_EVENTS_ENDPOINT',
}

/**
 * Parses NOTIFICATION_TRANSPORTS the same way as NotificationEventHandler.
 * Defaults to appsync-graphql when unset or empty.
 */
export function parseNotificationTransports(raw: string | undefined): string[] {
  const names = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return names.length > 0 ? names : [NotificationTransports.APPSYNC_GRAPHQL]
}

export function validateBuiltinNotificationTransportEnv(
  config: Record<string, unknown>,
): void {
  const active = parseNotificationTransports(
    config.NOTIFICATION_TRANSPORTS as string | undefined,
  )

  for (const name of active) {
    const envKey = BUILTIN_NOTIFICATION_TRANSPORT_ENV[name]
    if (!envKey) {
      continue
    }

    const value = config[envKey]
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `Notification transport "${name}" is enabled (NOTIFICATION_TRANSPORTS) but ${envKey} is not set.`,
      )
    }
  }
}
