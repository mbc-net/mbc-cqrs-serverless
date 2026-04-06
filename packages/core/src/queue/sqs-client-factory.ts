import { SQSClient } from '@aws-sdk/client-sqs'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class SqsClientFactory {
  private client: SQSClient | undefined

  constructor(private readonly config: ConfigService) {}

  getClient(): SQSClient {
    if (!this.client) {
      this.client = new SQSClient({
        endpoint: this.config.get<string>('SQS_ENDPOINT'),
        region: this.config.get<string>('SQS_REGION'),
      })
    }
    return this.client
  }
}
