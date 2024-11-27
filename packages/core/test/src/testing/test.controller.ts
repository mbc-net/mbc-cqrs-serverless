import { Body, Controller, Logger, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  CommandDto,
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
}
