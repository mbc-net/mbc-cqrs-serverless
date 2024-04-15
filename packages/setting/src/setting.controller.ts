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

import { CreateSettingDto } from './dto/setting-create.dto'
import { UpdateSettingDto } from './dto/setting-update.dto'
import { parsePk } from './helpers/id'
import { SettingService } from './setting.service'

@Controller('api/setting')
@ApiTags('setting')
export class SettingController {
  private readonly logger = new Logger(SettingController.name)

  constructor(private readonly settingService: SettingService) {}

  @Get('/')
  async getDataByPK() {
    const userContext = getUserContext()
    return await this.settingService.getData(userContext.tenantCode)
  }

  @Post('/')
  @Auth(ROLE_SYSTEM_ADMIN)
  async createSetting(@Body() createDto: CreateSettingDto) {
    const userContext = getUserContext()
    return await this.settingService.create(userContext.tenantCode, createDto)
  }

  @Put('/:pk/:sk')
  @Auth(ROLE_SYSTEM_ADMIN)
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
  @Auth(ROLE_SYSTEM_ADMIN)
  async deleteSetting(@Param() key: DetailDto) {
    const userContext = getUserContext()
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return await this.settingService.delete(key)
  }
}
