import { SNSClient } from '@aws-sdk/client-sns'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class SnsClientFactory {
  private clients = new Map<string, SNSClient>()

  constructor(private readonly config: ConfigService) {}

  getClient(topicArn: string): SNSClient {
    if (!this.clients.has(topicArn)) {
      const snsClient = new SNSClient({
        endpoint: this.config.get<string>('SNS_ENDPOINT'),
        region: this.config.get<string>('SNS_REGION'),
      })
      this.clients.set(topicArn, snsClient)
    }
    return this.clients.get(topicArn)
  }
}
