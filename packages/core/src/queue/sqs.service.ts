import {
  DeleteMessageBatchCommand,
  DeleteMessageBatchCommandOutput,
  DeleteMessageBatchRequestEntry,
  DeleteMessageCommand,
  DeleteMessageCommandOutput,
  ReceiveMessageCommand,
  ReceiveMessageCommandInput,
  ReceiveMessageCommandOutput,
  SendMessageBatchCommand,
  SendMessageBatchCommandOutput,
  SendMessageBatchRequestEntry,
  SendMessageCommand,
  SendMessageCommandInput,
  SendMessageCommandOutput,
} from '@aws-sdk/client-sqs'
import { Injectable, Logger } from '@nestjs/common'

import { SqsClientFactory } from './sqs-client-factory'

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name)

  constructor(private readonly sqsClientFactory: SqsClientFactory) {}

  /**
   * Send a single message to an SQS queue.
   */
  async sendMessage(
    queueUrl: string,
    body: string,
    opts?: Pick<
      SendMessageCommandInput,
      | 'DelaySeconds'
      | 'MessageGroupId'
      | 'MessageDeduplicationId'
      | 'MessageAttributes'
    >,
  ): Promise<SendMessageCommandOutput> {
    const client = this.sqsClientFactory.getClient(queueUrl)
    const result = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: body,
        ...opts,
      }),
    )
    this.logger.debug(`sendMessage MessageId=${result.MessageId}`)
    return result
  }

  /**
   * Send up to 10 messages to an SQS queue in a single API call.
   * Caller is responsible for ensuring entries.length <= 10.
   */
  async sendMessageBatch(
    queueUrl: string,
    entries: SendMessageBatchRequestEntry[],
  ): Promise<SendMessageBatchCommandOutput> {
    const client = this.sqsClientFactory.getClient(queueUrl)
    const result = await client.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      }),
    )

    return result
  }

  /**
   * Receive messages from an SQS queue.
   */
  async receiveMessages(
    queueUrl: string,
    opts?: Partial<
      Pick<
        ReceiveMessageCommandInput,
        | 'MaxNumberOfMessages'
        | 'WaitTimeSeconds'
        | 'VisibilityTimeout'
        | 'AttributeNames'
        | 'MessageAttributeNames'
      >
    >,
  ): Promise<ReceiveMessageCommandOutput> {
    const client = this.sqsClientFactory.getClient(queueUrl)
    const result = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: opts?.MaxNumberOfMessages ?? 10,
        WaitTimeSeconds: opts?.WaitTimeSeconds ?? 0,
        ...opts,
      }),
    )
    return result
  }

  /**
   * Delete a single message from an SQS queue (acknowledge processing).
   */
  async deleteMessage(
    queueUrl: string,
    receiptHandle: string,
  ): Promise<DeleteMessageCommandOutput> {
    const client = this.sqsClientFactory.getClient(queueUrl)
    const result = await client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    )
    this.logger.debug(
      `deleteMessage receiptHandle=${receiptHandle.slice(0, 20)}...`,
    )
    return result
  }

  /**
   * Delete up to 10 messages from an SQS queue in a single API call.
   */
  async deleteMessageBatch(
    queueUrl: string,
    entries: DeleteMessageBatchRequestEntry[],
  ): Promise<DeleteMessageBatchCommandOutput> {
    const client = this.sqsClientFactory.getClient(queueUrl)
    const result = await client.send(
      new DeleteMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      }),
    )

    return result
  }
}
