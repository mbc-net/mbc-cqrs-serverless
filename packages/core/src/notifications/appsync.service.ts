import { Sha256 } from '@aws-crypto/sha256-js'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import fetch, { Response } from 'node-fetch'

import { INotification } from '../interfaces'

const query = /* GraphQL */ `
  mutation SEND_MESSAGE($message: AWSJSON!) {
    sendMessage(message: $message) {
      id
      table
      pk
      sk
      tenantCode
      action
      content
    }
  }
`

@Injectable()
export class AppSyncService {
  private readonly logger = new Logger(AppSyncService.name)

  private readonly endpoint: string
  private readonly hostname: string
  private readonly apiKey: string
  private readonly region: string
  private readonly signer: SignatureV4

  constructor(private readonly config: ConfigService) {
    this.endpoint = config.get<string>('APPSYNC_ENDPOINT')
    this.apiKey = config.get<string>('APPSYNC_API_KEY')
    this.region = 'ap-northeast-1'
    this.hostname = new URL(this.endpoint).hostname
    this.signer = new SignatureV4({
      credentials: defaultProvider(),
      region: this.region,
      service: 'appsync',
      sha256: Sha256,
    })
  }

  async sendMessage(msg: INotification) {
    const headers = {
      'Content-Type': 'application/json',
      host: this.hostname,
    }
    const body = JSON.stringify({
      query,
      variables: {
        message: JSON.stringify(msg),
      },
    })
    const method = 'POST'
    let res: Response
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
      res = await fetch(this.endpoint, {
        method,
        headers,
        body,
      })
    } else {
      const request = {
        method,
        headers,
        protocol: 'https:',
        hostname: this.hostname,
        path: '/graphql',
        body,
        region: this.region,
        service: 'appsync',
      }
      const signedRequest = await this.signer.sign(request, {
        signingDate: new Date(),
      })
      res = await fetch(this.endpoint, {
        method: signedRequest.method,
        headers: signedRequest.headers,
        body: signedRequest.body,
      })
    }
    const data = await res.json()
    this.logger.debug('appsync send message successfully:: ', data)

    return data
  }
}
