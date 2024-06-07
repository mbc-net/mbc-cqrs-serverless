import { getCurrentInvoke } from '@codegenie/serverless-express'
import { Controller, Get, Logger } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { AppService } from './app.service'

@Controller()
@ApiTags('main')
export class AppController {
  private readonly logger = new Logger(AppController.name)

  constructor(private readonly appService: AppService) {}

  @Get('/')
  getHello(): string {
    const { event, context } = getCurrentInvoke()
    this.logger.log(event, context)

    return this.appService.getHello()
  }
}
