import {
  DetailDto,
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
} from '@mbc-cqrs-serverless/core'
import {
  //   BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { CreateMasterDataDto } from '../dto/master-data/data-create.dto'
import { DataSettingSearchDto } from '../dto/master-data/data-search.dto'
import { UpdateDataSettingDto } from '../dto/master-data/data-update.dto'
import { MasterDataService } from '../services/master-data.service'

@Controller('api/master-data')
@ApiTags('master-data')
export class MasterDataController {
  private readonly logger = new Logger(MasterDataController.name)

  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('/')
  async listData(
    @INVOKE_CONTEXT() ctx: IInvoke,
    @Query() searchDto: DataSettingSearchDto,
  ) {
    const userContext = getUserContext(ctx)
    return await this.masterDataService.list(userContext.tenantCode, searchDto)
  }

  @Get('/:pk/:sk')
  async getDetail(@INVOKE_CONTEXT() ctx: IInvoke, @Param() key: DetailDto) {
    return await this.masterDataService.get(key)
  }

  @Post('/')
  async createDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createDto: CreateMasterDataDto,
  ) {
    return await this.masterDataService.create(createDto, { invokeContext })
  }

  @Put('/:pk/:sk')
  async updateDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() key: DetailDto,
    @Body() updateDto: UpdateDataSettingDto,
  ) {
    return await this.masterDataService.update(key, updateDto, {
      invokeContext,
    })
  }

  @Delete('/:pk/:sk')
  async deleteDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() key: DetailDto,
  ) {
    return this.masterDataService.delete(key, { invokeContext })
  }

  @Post('/check-exist/:settingCode/:code')
  async checkExistCode(
    @INVOKE_CONTEXT() ctx: IInvoke,
    @Param('settingCode') settingCode: string,
    @Param('code') code: string,
  ) {
    const userContext = getUserContext(ctx)
    return this.masterDataService.checkExistCode(
      userContext.tenantCode,
      settingCode,
      code,
    )
  }
}
