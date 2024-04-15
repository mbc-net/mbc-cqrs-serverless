import {
  Auth,
  DetailDto,
  getUserContext,
  ROLE_SYSTEM_ADMIN,
} from '@mbc-cqrs-severless/core'
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

import { DataSettingService } from './data-setting.service'
import { CreateDataSettingDto } from './dto/data-setting-create.dto'
import { DataSettingSearchDto } from './dto/data-setting-search.dto'
import { UpdateDataSettingDto } from './dto/data-setting-update.dto'
import { parsePk } from './helpers/id'

@Controller('api/data-setting')
@ApiTags('data-setting')
export class DataSettingController {
  private readonly logger = new Logger(DataSettingController.name)

  constructor(private readonly dataSettingService: DataSettingService) {}

  @Get('/')
  async getDataByPK(@Query() searchDto: DataSettingSearchDto) {
    const userContext = getUserContext()
    return await this.dataSettingService.get(userContext.tenantCode, searchDto)
  }

  @Post('/')
  @Auth(ROLE_SYSTEM_ADMIN)
  async createDataSetting(@Body() createDto: CreateDataSettingDto) {
    const userContext = getUserContext()
    return await this.dataSettingService.create(
      userContext.tenantCode,
      createDto,
    )
  }

  @Put('/:pk/:sk')
  @Auth(ROLE_SYSTEM_ADMIN)
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
  @Auth(ROLE_SYSTEM_ADMIN)
  async deleteDataSetting(@Param() key: DetailDto) {
    const userContext = getUserContext()
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return this.dataSettingService.delete(key)
  }

  @Post('/check-exist/:settingCode/:code')
  @Auth(ROLE_SYSTEM_ADMIN)
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
