import { randomUUID } from 'node:crypto'

import { Sha256 } from '@aws-crypto/sha256-js'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpRequest } from '@smithy/protocol-http'
import { SignatureV4 } from '@smithy/signature-v4'
import fetch from 'node-fetch'

import { NotificationTransport } from '../decorators'
import { INotification } from '../interfaces'
import { NotificationTransports } from './enums'
import { INotificationTransport } from './interfaces'

/** Default headers required for AppSync Events API requests */
const DEFAULT_HEADERS = {
  accept: 'application/json, text/javascript',
  'content-encoding': 'amz-1.0',
  'content-type': 'application/json; charset=UTF-8',
}

@NotificationTransport(NotificationTransports.APPSYNC_EVENT)
export class AppSyncEventsService implements INotificationTransport {
  private readonly logger = new Logger(AppSyncEventsService.name)

  private readonly url: URL | undefined
  private readonly namespace: string
  private readonly signer: SignatureV4 | undefined

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('APPSYNC_EVENTS_ENDPOINT')
    this.namespace = config.get<string>('APPSYNC_EVENTS_NAMESPACE') ?? 'default'

    if (endpoint) {
      this.url = new URL(endpoint)

      // Region is parsed from the hostname automatically:
      //   <id>.appsync-api.<region>.amazonaws.com → region
      // Falls back to AWS_REGION env var (always set in Lambda runtime).
      const match = this.url.hostname.match(
        /\w+\.appsync-api\.([\w-]+)\.amazonaws\.com/,
      )
      const region = match?.[1] ?? process.env.AWS_REGION ?? 'ap-northeast-1'

      this.signer = new SignatureV4({
        credentials: defaultProvider(),
        service: 'appsync',
        region,
        sha256: Sha256,
      })
    }
  }

  /**
   * Publish INotification to an AppSync Events channel via IAM SigV4.
   *
   * Channel structure (max 5 segments, seg 1 = namespace):
   *   /{namespace}/{tenantCode}/{action}/{sanitizedId}
   *
   * Client subscription options (wildcard /* catches all sub-channels):
   *   /{namespace}/{tenantCode}/*                  — all events for tenant
   *   /{namespace}/{tenantCode}/{action}/*          — filtered by action
   *   /{namespace}/{tenantCode}/{action}/{id}       — specific command
   *
   * Requires: Lambda execution role must have appsync:EventPublish permission.
   */
  async sendMessage(notification: INotification): Promise<void> {
    const channel = this.resolveChannel(notification)
    this.logger.debug(`sendMessage:: channel=${channel}`)

    await this.postToChannel(channel, notification)
  }

  /**
   * Resolves the most specific channel path for a notification.
   * Non-alphanumeric characters (e.g. #, @) are sanitized to dashes
   * since AppSync Events channel segments only allow [a-zA-Z0-9-].
   */
  resolveChannel(notification: INotification): string {
    const namespace = this.sanitizeSegment(this.namespace)
    const tenantCode = this.sanitizeSegment(notification.tenantCode)
    const action = this.sanitizeSegment(notification.action)
    const id = this.sanitizeSegment(notification.id)
    return `/${namespace}/${tenantCode}/${action}/${id}`
  }

  /**
   * Formats a string to comply with AppSync Events API channel segment rules:
   * 1. Only alphanumeric characters and dashes.
   * 2. Cannot start or end with a dash.
   * 3. Maximum length of 50 characters.
   */
  private sanitizeSegment(segment: string | undefined): string {
    if (!segment) return 'none'

    // Replace any non-alphanumeric character (like _, %, =) with a dash
    let s = segment.replace(/[^a-zA-Z0-9]/g, '-')

    // Truncate to AWS's strict 50 character limit
    s = s.substring(0, 50)

    // Strip out any dashes from the very beginning or end
    s = s.replace(/^-+|-+$/g, '')

    // Fallback if the string became empty after trimming
    return s || 'none'
  }

  private async postToChannel(
    channel: string,
    notification: INotification,
  ): Promise<void> {
    const signedReq = await this.signRequest(channel, notification)

    const res = await fetch(this.url!.toString(), {
      method: signedReq.method,
      headers: signedReq.headers as Record<string, string>,
      body: signedReq.body,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(
        `AppSync Events publish failed [${res.status}] on channel ${channel}: ${text}`,
      )
    }

    this.logger.debug(`sendMessage:: published successfully to ${channel}`)
  }

  /**
   * Builds and signs an HttpRequest for the given channel and notification.
   * Separating signing from the fetch call makes each step independently testable.
   */
  private async signRequest(
    channel: string,
    notification: INotification,
  ): Promise<HttpRequest> {
    const body = JSON.stringify({
      id: randomUUID(),
      channel,
      events: [JSON.stringify(notification)],
    })

    const httpRequest = new HttpRequest({
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        host: this.url!.hostname,
      },
      body,
      hostname: this.url!.hostname,
      path: this.url!.pathname,
    })

    return this.signer!.sign(httpRequest) as Promise<HttpRequest>
  }
}
