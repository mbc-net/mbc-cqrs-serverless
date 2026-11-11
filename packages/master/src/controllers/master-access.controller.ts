import { IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { MasterAccessService } from '../access/master-access.service'
import { MasterControllerGuard } from '../guards'

@Controller('api/master-access')
@ApiTags('master-access')
@UseGuards(MasterControllerGuard)
export class MasterAccessController {
  constructor(private readonly masterAccessService: MasterAccessService) {}

  @Get()
  async getAccess(@INVOKE_CONTEXT() invokeContext: IInvoke) {
    return this.masterAccessService.getAccess({ invokeContext })
  }
}
