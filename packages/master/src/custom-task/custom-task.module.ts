import { Module } from '@nestjs/common'

import { MyTaskController } from './my-task.controller'
import { MyTaskService } from './my-task.service'

@Module({
  providers: [MyTaskService],
  controllers: [MyTaskController],
})
export class CustomTaskModule {}
