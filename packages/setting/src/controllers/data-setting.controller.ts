import { DetailDto, getUserContext } from '@mbc-cqrs-severless/core'
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
  async listData(@Query() searchDto: DataSettingSearchDto) {
    const userContext = getUserContext()
    return await this.dataSettingService.list(userContext.tenantCode, searchDto)
  }

  @Get('/:pk/:sk')
  async getDetail(@Param() key: DetailDto) {
    const userContext = getUserContext()
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    return await this.dataSettingService.get(key)
  }

  @Post('/')
  async createDataSetting(@Body() createDto: CreateDataSettingDto) {
    const userContext = getUserContext()
    return await this.dataSettingService.create(
      userContext.tenantCode,
      createDto,
    )
  }

  @Put('/:pk/:sk')
  async updateDataSetting(
    @Param() key: DetailDto,
    @Body() updateDto: UpdateDataSettingDto,
  ) {
    const userContext = getUserContext()
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return await this.dataSettingService.update(key, updateDto)
  }

  @Delete('/:pk/:sk')
  async deleteDataSetting(@Param() key: DetailDto) {
    const userContext = getUserContext()
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return this.dataSettingService.delete(key)
  }

  @Post('/check-exist/:settingCode/:code')
  async checkExistCode(
    @Param('settingCode') settingCode: string,
    @Param('code') code: string,
  ) {
    const userContext = getUserContext()
    return this.dataSettingService.checkExistCode(
      userContext.tenantCode,
      settingCode,
      code,
    )
  }
}
