import { Module } from '@nestjs/common'

import { MasterModule } from './master/master.module'

@Module({
  imports: [MasterModule],
  providers: [],
})
export class MainModule {}
