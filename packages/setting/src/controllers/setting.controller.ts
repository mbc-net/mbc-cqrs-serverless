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
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { CreateSettingDto } from '../dto/setting-create.dto'
import { UpdateSettingDto } from '../dto/setting-update.dto'
import { parsePk } from '../helpers'
import { SettingService } from '../services/setting.service'

@Controller('api/master-setting')
@ApiTags('master-setting')
@Auth(ROLE_SYSTEM_ADMIN)
export class SettingController {
  private readonly logger = new Logger(SettingController.name)

  constructor(private readonly settingService: SettingService) {}

  @Get('/')
  @Auth()
  async getDataByPK() {
    const userContext = getUserContext()
    return await this.settingService.getData(userContext.tenantCode)
  }

  @Post('/')
  async createSetting(@Body() createDto: CreateSettingDto) {
    const userContext = getUserContext()
    return await this.settingService.create(userContext.tenantCode, createDto)
  }

  @Put('/:pk/:sk')
  async updateSetting(
    @Param() key: DetailDto,
    @Body() updateDto: UpdateSettingDto,
  ) {
    const userContext = getUserContext()
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return await this.settingService.update(key, updateDto)
  }

  @Delete('/:pk/:sk')
  async deleteSetting(@Param() key: DetailDto) {
    const userContext = getUserContext()
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return await this.settingService.delete(key)
  }
}
