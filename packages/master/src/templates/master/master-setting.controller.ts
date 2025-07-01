import {
  DetailDto,
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
} from '@mbc-cqrs-serverless/core'
import { CommonSettingDto } from '@mbc-cqrs-serverless/master/dist/dto'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { MasterCopyDto } from './dto/master-copy.dto'
import { MasterSettingSearchDto } from './dto/master-setting-search.dto'
import { MasterSettingUpdateDto } from './dto/master-setting-update.dto'
import { parsePk } from './helpers'
import { CustomMasterSettingService } from './master-setting.service'

@ApiTags('master-setting')
@Controller('api/master-setting')
@Injectable()
export class MasterSettingController {
  constructor(
    private readonly masterSettingService: CustomMasterSettingService,
  ) {}

  @Get('/')
  async list(
    @Query() searchDto: MasterSettingSearchDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterSettingService.list(searchDto, invokeContext)
  }

  @Get('/:pk/:sk')
  async getDetail(@Param() key: DetailDto) {
    return this.masterSettingService.getDetail(key)
  }

  @Post('/')
  async create(
    @Body() createDto: CommonSettingDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterSettingService.create(createDto, invokeContext)
  }

  @Put('/:pk/:sk')
  async update(
    @Param() key: DetailDto,
    @Body() updateDto: MasterSettingUpdateDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    const userContext = getUserContext(invokeContext)

    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    return this.masterSettingService.update(key, updateDto, invokeContext)
  }

  @Delete('/:pk/:sk')
  async delete(
    @Param() key: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    const userContext = getUserContext(invokeContext)

    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    return this.masterSettingService.delete(key, invokeContext)
  }

  @Post('/check-exist/:code')
  async checkExistCode(
    @Param('code') code: string,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterSettingService.checkExistCode(code, invokeContext)
  }

  @Post('/copy')
  async copyMaster(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() masterCopyDto: MasterCopyDto,
  ): Promise<any> {
    return this.masterSettingService.copy(masterCopyDto, { invokeContext })
  }
}
