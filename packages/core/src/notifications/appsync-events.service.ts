import { Sha256 } from '@aws-crypto/sha256-js'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import fetch from 'node-fetch'

import { INotification } from '../interfaces'

@Injectable()
export class AppSyncEventsService {
  private readonly logger = new Logger(AppSyncEventsService.name)

  private readonly endpoint?: string
  private readonly hostname?: string
  private readonly apiKey?: string
  private readonly region: string
  private readonly namespace: string
  private readonly signer?: SignatureV4

  constructor(private readonly config: ConfigService) {
    this.endpoint = config.get<string>('APPSYNC_EVENTS_ENDPOINT')
    this.apiKey = config.get<string>('APPSYNC_EVENTS_API_KEY')
    this.region =
      config.get<string>('APPSYNC_EVENTS_REGION') ?? 'ap-northeast-1'
    this.namespace = config.get<string>('APPSYNC_EVENTS_NAMESPACE') ?? 'default'

    // Guard against undefined endpoint if the feature is disabled/missing env var
    if (this.endpoint) {
      this.hostname = new URL(this.endpoint).hostname
      this.signer = new SignatureV4({
        credentials: defaultProvider(),
        region: this.region,
        service: 'appsync',
        sha256: Sha256,
      })
    }
  }

  /**
   * Publish INotification to an AppSync Events channel.
   *
   * Channel structure (max 5 segments, namespace is seg 1):
   *   /{namespace}/{tenantCode}/{table}/{action}/{encodedId}
   *
   * Client subscription options (wildcard catches all sub-channels):
   *   /{namespace}/{tenantCode}/*                           — all events for tenant
   *   /{namespace}/{tenantCode}/{table}/*                   — all events for a table/module
   *   /{namespace}/{tenantCode}/{table}/{action}/*          — all events for an action
   *   /{namespace}/{tenantCode}/{table}/{action}/{id}       — specific command (exact)
   */
  async publishEvent(msg: INotification): Promise<void> {
    // Short-circuit if the endpoint wasn't provided (e.g., feature disabled)
    if (!this.endpoint || !this.hostname) {
      this.logger.debug('AppSync Events endpoint is missing. Skipping publish.')
      return
    }

    const channel = this.resolveChannel(msg)
    this.logger.debug(`publishEvent:: channel=${channel}`)
    await this.postToChannel(channel, msg)
  }

  /**
   * Resolves the most specific channel path for a notification.
   * Clients subscribe at the level of granularity they need using wildcard.
   */
  resolveChannel(msg: INotification): string {
    const tenantCode = this.sanitizeSegment(msg.tenantCode)
    const table = this.sanitizeSegment(msg.table)
    const action = this.sanitizeSegment(msg.action)
    const id = this.sanitizeSegment(msg.id)
    return `/${this.namespace}/${tenantCode}/${table}/${action}/${id}`
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
    msg: INotification,
  ): Promise<void> {
    const endpointUrl = new URL(this.endpoint as string)
    const url = endpointUrl.toString()
    const apiPath = endpointUrl.pathname // Extracted path, e.g. '/event'

    // The AppSync Events API requires the 'channel' inside the JSON body
    const body = JSON.stringify({
      channel: channel,
      events: [JSON.stringify(msg)],
    })

    const method = 'POST'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      host: endpointUrl.hostname,
    }

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
      const res = await fetch(url, { method, headers, body })
      await this.handleResponse(res, channel)
    } else if (this.signer) {
      // The signed request path must be the base '/event' path, not the channel string
      const signedRequest = await this.signer.sign(
        {
          method,
          headers,
          protocol: 'https:',
          hostname: endpointUrl.hostname,
          path: apiPath,
          body,
        },
        {
          signingDate: new Date(),
          signingRegion: this.region,
          signingService: 'appsync',
        },
      )
      const res = await fetch(url, {
        method: signedRequest.method,
        headers: signedRequest.headers as Record<string, string>,
        body: signedRequest.body,
      })
      await this.handleResponse(res, channel)
    }

    this.logger.debug(`AppSync Events published successfully to ${channel}`)
  }

  private async handleResponse(res: any, channel: string): Promise<void> {
    if (!res.ok) {
      const text = await res.text()
      throw new Error(
        `AppSync Events publish failed [${res.status}] on channel ${channel}: ${text}`,
      )
    }
  }
}
