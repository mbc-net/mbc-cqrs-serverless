import {
  DetailDto,
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
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

import { CreateDataSettingDto } from '../dto/data-setting-create.dto'
import { DataSettingSearchDto } from '../dto/data-setting-search.dto'
import { UpdateDataSettingDto } from '../dto/data-setting-update.dto'
import { parsePk } from '../helpers'
import { DataSettingService } from '../services/data-setting.service'

@Controller('api/master-data')
@ApiTags('master-data')
export class DataSettingController {
  private readonly logger = new Logger(DataSettingController.name)

  constructor(private readonly dataSettingService: DataSettingService) {}

  @Get('/')
  async listData(
    @INVOKE_CONTEXT() ctx: IInvoke,
    @Query() searchDto: DataSettingSearchDto,
  ) {
    const userContext = getUserContext(ctx)
    return await this.dataSettingService.list(userContext.tenantCode, searchDto)
  }

  @Get('/:pk/:sk')
  async getDetail(@INVOKE_CONTEXT() ctx: IInvoke, @Param() key: DetailDto) {
    const userContext = getUserContext(ctx)
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    return await this.dataSettingService.get(key)
  }

  @Post('/')
  async createDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createDto: CreateDataSettingDto,
  ) {
    const userContext = getUserContext(invokeContext)
    return await this.dataSettingService.create(
      userContext.tenantCode,
      createDto,
      { invokeContext },
    )
  }

  @Put('/:pk/:sk')
  async updateDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() key: DetailDto,
    @Body() updateDto: UpdateDataSettingDto,
  ) {
    const userContext = getUserContext(invokeContext)
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return await this.dataSettingService.update(key, updateDto, {
      invokeContext,
    })
  }

  @Delete('/:pk/:sk')
  async deleteDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() key: DetailDto,
  ) {
    const userContext = getUserContext(invokeContext)
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return this.dataSettingService.delete(key, { invokeContext })
  }

  @Post('/check-exist/:settingCode/:code')
  async checkExistCode(
    @INVOKE_CONTEXT() ctx: IInvoke,
    @Param('settingCode') settingCode: string,
    @Param('code') code: string,
  ) {
    const userContext = getUserContext(ctx)
    return this.dataSettingService.checkExistCode(
      userContext.tenantCode,
      settingCode,
      code,
    )
  }
}
