import { DetailDto, IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-sererless/core'
import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { CreateTaskDto } from './dto/create-task.dto'
import { TaskService } from './task.service'
@ApiTags('task')
@Controller('tasks')
export class TaskController {
  private readonly logger = new Logger(TaskController.name)

  constructor(private readonly tasksService: TaskService) {}

  @Post('/')
  async createTask(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CreateTaskDto,
  ) {
    return await this.tasksService.createTask(dto, { invokeContext })
  }

  @Get('/:pk/:sk')
  async getTask(@Param() detailDto: DetailDto) {
    const item = await this.tasksService.getTask(detailDto)
    if (!item) {
      throw new NotFoundException()
    }
    this.logger.debug('item:', item)
    return item
  }

  @Get('/:pk')
  async listTaskByPk(@Param('pk') pk: string) {
    return await this.tasksService.listItemsByPk(pk)
  }
}
