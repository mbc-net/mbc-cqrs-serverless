import { SQSClient } from '@aws-sdk/client-sqs'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class SqsClientFactory {
  private clients = new Map<string, SQSClient>()

  constructor(private readonly config: ConfigService) {}

  getClient(queueUrl: string): SQSClient {
    if (!this.clients.has(queueUrl)) {
      const sqsClient = new SQSClient({
        endpoint: this.config.get<string>('SQS_ENDPOINT'),
        region: this.config.get<string>('SQS_REGION'),
      })
      this.clients.set(queueUrl, sqsClient)
    }
    return this.clients.get(queueUrl)
  }
}
