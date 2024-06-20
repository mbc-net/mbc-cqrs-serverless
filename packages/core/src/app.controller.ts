import { Controller, Get, Logger } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { AppService } from './app.service'
import { CONTEXT } from './decorators'

@Controller()
@ApiTags('main')
export class AppController {
  private readonly logger = new Logger(AppController.name)

  constructor(private readonly appService: AppService) {}

  @Get('/')
  getHello(@CONTEXT() ctx: any): string {
    this.logger.debug('ctx::', JSON.stringify(ctx, null, 2))
    return this.appService.getHello()
  }
}
