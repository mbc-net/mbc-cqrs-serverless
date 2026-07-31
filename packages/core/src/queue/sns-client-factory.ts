import { SNSClient } from '@aws-sdk/client-sns'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class SnsClientFactory {
  private client: SNSClient | undefined

  constructor(private readonly config: ConfigService) {}

  getClient(): SNSClient {
    if (!this.client) {
      this.client = new SNSClient({
        endpoint: this.config.get<string>('SNS_ENDPOINT'),
        region: this.config.get<string>('SNS_REGION'),
      })
    }
    return this.client
  }
}
