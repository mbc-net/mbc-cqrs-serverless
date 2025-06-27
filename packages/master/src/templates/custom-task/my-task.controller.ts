import { DetailDto, IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import { TaskEntity } from '@mbc-cqrs-serverless/task'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { MyTaskService } from './my-task.service'

@Controller('api/tasks')
@ApiTags('tasks')
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

  @Get('/:pk/:sk')
  async getSfnChildTask(@Param() key: DetailDto): Promise<TaskEntity[]> {
    return this.myTaskService.getSfnChildTask(key)
  }
}
