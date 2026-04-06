import { Global, Module } from '@nestjs/common'

import { SnsService } from './sns.service'
import { SnsClientFactory } from './sns-client-factory'

@Global()
@Module({
  providers: [SnsService, SnsClientFactory],
  exports: [SnsService],
})
export class QueueModule {}
