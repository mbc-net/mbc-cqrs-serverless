import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SnsEvent } from './sns.event'

const CLIENT_INSTANCE = Symbol('sns-client')

@Injectable()
export class SnsService {
  private [CLIENT_INSTANCE]: SNSClient
  private topicArn: string

  constructor(private readonly config: ConfigService) {
    this[CLIENT_INSTANCE] = new SNSClient({
      endpoint: config.get<string>('SNS_ENDPOINT'),
      region: config.get<string>('SNS_REGION'),
    })

    this.topicArn = config.get<string>('SNS_TOPIC_ARN')
  }

  get client(): SNSClient {
    return this[CLIENT_INSTANCE]
  }

  publish<T extends SnsEvent>(msg: T) {
    return this.client.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        MessageAttributes: {
          action: {
            DataType: 'String',
            StringValue: msg.action,
          },
        },
        Message: JSON.stringify(msg),
      }),
    )
  }
}
