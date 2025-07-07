import { IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import { MasterCopyDto } from '@mbc-cqrs-serverless/master'
import { Body, Controller, Injectable, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { CustomMasterSettingService } from './master-setting.service'

@ApiTags('master-setting')
@Controller('api/master-setting')
@Injectable()
export class CustomMasterSettingController {
  constructor(
    private readonly masterSettingService: CustomMasterSettingService,
  ) {}

  @Post('/copy')
  async copyMaster(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() masterCopyDto: MasterCopyDto,
  ): Promise<any> {
    return this.masterSettingService.copy(masterCopyDto, { invokeContext })
  }
}
