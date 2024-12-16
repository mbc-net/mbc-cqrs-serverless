import { Body, Controller, Logger, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  CommandDto,
  CommandPartialInputModel,
  CommandService,
  IInvoke,
  INVOKE_CONTEXT,
} from '../../../src'

@Controller('api/testing')
@ApiTags('testing')
export class TestController {
  private readonly logger = new Logger(TestController.name)

  constructor(private readonly commandService: CommandService) {}

  @Post('/')
  async publishCommand(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() commandDto: CommandDto,
  ) {
    this.logger.debug('cmd:', commandDto)
    this.logger.debug('commandService:' + this.commandService.tableName)
    const item = await this.commandService.publishAsync(commandDto, {
      invokeContext,
    })
    return item
  }

  @Post('/sync')
  async publishCommandSync(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() commandDto: CommandDto,
  ) {
    this.logger.debug('cmd:', commandDto)
    this.logger.debug('commandService:' + this.commandService.tableName)
    const item = await this.commandService.publishSync(commandDto, {
      invokeContext,
    })
    return item
  }

  @Put('/sync')
  async publishPartialUpdateSync(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() commandDto: CommandPartialInputModel,
  ) {
    this.logger.debug('cmd:', commandDto)
    this.logger.debug('commandService:' + this.commandService.tableName)
    const item = await this.commandService.publishPartialUpdateSync(
      commandDto,
      {
        invokeContext,
      },
    )
    return item
  }
}
