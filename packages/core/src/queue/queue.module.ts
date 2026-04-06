import { Module } from '@nestjs/common'

import { SnsService } from './sns.service'
import { SnsClientFactory } from './sns-client-factory'
import { SqsService } from './sqs.service'
import { SqsClientFactory } from './sqs-client-factory'

@Module({
  providers: [SnsClientFactory, SnsService, SqsClientFactory, SqsService],
  exports: [SnsService, SqsService],
})
export class QueueModule {}
