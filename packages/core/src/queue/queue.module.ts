import { Global, Module } from '@nestjs/common'

import { SnsService } from './sns.service'
import { SnsClientFactory } from './sns-client-factory'
import { SqsService } from './sqs.service'
import { SqsClientFactory } from './sqs-client-factory'

@Global()
@Module({
  providers: [SnsService, SnsClientFactory, SqsService, SqsClientFactory],
  exports: [SnsService, SqsService],
})
export class QueueModule {}
