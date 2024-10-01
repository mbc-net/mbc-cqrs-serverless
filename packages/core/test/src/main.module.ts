import { Module } from '@nestjs/common'

import { TestModule } from './testing/test.module'

@Module({
  imports: [TestModule],
})
export class MainModule {}
