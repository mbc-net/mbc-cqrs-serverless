import { PublishCommand } from '@aws-sdk/client-sns'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SnsEvent } from './sns.event'
import { SnsClientFactory } from './sns-client-factory'

@Injectable()
export class SnsService {
  private readonly defaultTopicArn: string

  constructor(
    private readonly snsClientFactory: SnsClientFactory,
    private readonly config: ConfigService,
  ) {
    this.defaultTopicArn = this.config.get<string>('SNS_TOPIC_ARN')
  }

  publish<T extends SnsEvent>(msg: T, topicArn?: string) {
    const resolvedTopicArn = topicArn || this.defaultTopicArn

    if (!resolvedTopicArn) {
      throw new Error('No topic ARN provided or configured as default.')
    }

    const client = this.snsClientFactory.getClient(resolvedTopicArn)

    return client.send(
      new PublishCommand({
        TopicArn: resolvedTopicArn,
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
