/** Mirrors OnMessageSubscriptionVariables from the GraphQL schema */
export type SubscribeVariables = {
  tenantCode: string
  action?: string | null
  id?: string | null
}

export type SubscribeHandler<T = unknown> = (message: T) => void | Promise<void>

export type Subscription = {
  unsubscribe: () => void
}

/** Common interface both transport clients must implement */
export interface SubscribeClient {
  subscribe<T = unknown>(
    variables: SubscribeVariables,
    handler: SubscribeHandler<T>,
    onError?: (err: unknown) => void,
  ): Subscription
}

// ---------------------------------------------------------------------------
// Unified subscribe — transport-agnostic call site
// ---------------------------------------------------------------------------

/**
 * Subscribe to notifications using whichever transport client is provided.
 * Switching transport = swap the client, nothing else changes.
 */
export function subscribe<T = unknown>(
  client: SubscribeClient,
  variables: SubscribeVariables,
  handler: SubscribeHandler<T>,
  onError?: (err: unknown) => void,
): Subscription {
  return client.subscribe(variables, handler, onError)
}

// ---------------------------------------------------------------------------
// AppSync Events client (appsync-event transport)
// ---------------------------------------------------------------------------

/**
 * Wraps the AppSync Events API WebSocket subscription.
 * Builds the channel path from SubscribeVariables to mirror the
 * GraphQL subscription filter shape:
 *
 *   tenantCode only          → /{namespace}/{tenantCode}/*
 *   tenantCode + action      → /{namespace}/{tenantCode}/{action}/*
 *   tenantCode + action + id → /{namespace}/{tenantCode}/{action}/{sanitizedId}
 *
 * The sanitizedId matches what AppSyncEventsService.resolveChannel() produces
 * server-side — same sanitization (non-alphanumeric → dash, trim, truncate 50).
 */
export class EventsSubscriptionClientImpl implements SubscribeClient {
  /**
   * @param eventsClient — Amplify events client: import { events } from 'aws-amplify/data'
   * @param namespace    — must match APPSYNC_EVENTS_NAMESPACE env var (default: 'default')
   */
  constructor(
    private readonly eventsClient: any,
    private readonly namespace: string = 'default',
  ) {}

  subscribe<T = unknown>(
    variables: SubscribeVariables,
    handler: SubscribeHandler<T>,
    onError?: (err: unknown) => void,
  ): Subscription {
    const channelPath = this.resolveChannel(variables)

    let sub: { unsubscribe: () => void } | null = null
    let isUnsubscribed = false

    // 1. connect() returns a Promise. We handle it with .then()
    this.eventsClient
      .connect(channelPath)
      .then((channel: any) => {
        // Prevent race condition: if the user navigated away / unsubscribed
        // before the WebSocket connection even finished initializing.
        if (isUnsubscribed) return

        // 2. Now that we have the resolved channel, we can subscribe
        sub = channel.subscribe({
          next: ({ event }: { event: unknown }) => {
            const msg = this.decode<T>(event)
            if (msg !== null) handler(msg)
          },
          error:
            onError ??
            ((err: unknown) => console.error('AppSync Events error:', err)),
        })
      })
      .catch((err: unknown) => {
        if (onError) onError(err)
        else console.error('AppSync Events connection error:', err)
      })

    // 3. Return a synchronous cleanup function immediately
    return {
      unsubscribe: () => {
        isUnsubscribed = true
        if (sub) {
          sub.unsubscribe()
        }
      },
    }
  }
  /**
   * Mirrors AppSyncEventsService.resolveChannel() on the server:
   *   /{namespace}/{tenantCode}/{action}/{sanitizedId}
   *
   * Uses wildcard when action or id is not provided.
   */
  resolveChannel(variables: SubscribeVariables): string {
    const tenantCode = this.sanitize(variables.tenantCode)

    if (!variables.action) {
      return `/${this.namespace}/${tenantCode}/*`
    }

    const action = this.sanitize(variables.action)

    if (!variables.id) {
      return `/${this.namespace}/${tenantCode}/${action}/*`
    }

    const id = this.sanitize(variables.id)
    return `/${this.namespace}/${tenantCode}/${action}/${id}`
  }

  /** Must exactly match AppSyncEventsService.sanitizeSegment() */
  private sanitize(value: string): string {
    if (!value) return 'none'
    return value
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
  }

  private decode<T>(event: unknown): T | null {
    try {
      const raw = typeof event === 'string' ? JSON.parse(event) : event
      return raw as T
    } catch {
      console.error('Failed to decode AppSync Events message', event)
      return null
    }
  }
}
