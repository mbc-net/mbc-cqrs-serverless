import { Global, Module } from '@nestjs/common'

import { SnsService } from './sns.service'

@Global()
@Module({
  providers: [SnsService],
  exports: [SnsService],
})
export class QueueModule {}
