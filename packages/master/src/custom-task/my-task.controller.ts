import { DetailDto, IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import { TaskEntity } from '@mbc-cqrs-serverless/task'
import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { DetailKeys } from '../decorators'
import { MasterControllerGuard } from '../guards'
import { MyTaskService } from './my-task.service'

@Controller('api/tasks')
@ApiTags('tasks')
@UseGuards(MasterControllerGuard)
export class MyTaskController {
  constructor(private readonly myTaskService: MyTaskService) {}

  @Get('/sfn-task-parent')
  async getSfnTaskParentBySettingCode(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Query('masterSettingCode') masterSettingCode: string,
  ): Promise<TaskEntity[]> {
    return this.myTaskService.getSfnTaskParentBySettingCode(
      masterSettingCode,
      invokeContext,
    )
  }

  @Get('/:id')
  async getSfnChildTask(@DetailKeys() key: DetailDto): Promise<TaskEntity[]> {
    return this.myTaskService.getSfnChildTask(key)
  }
}
