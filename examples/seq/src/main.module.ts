import { SequencesModule } from '@mbc-cqrs-sererless/sequence'
import { Module } from '@nestjs/common'

import { MasterModule } from './master/master.module'

@Module({
  imports: [SequencesModule, MasterModule],
  providers: [],
})
export class MainModule {}
