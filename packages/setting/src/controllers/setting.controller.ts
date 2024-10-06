import {
  Auth,
  DetailDto,
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
  ROLE_SYSTEM_ADMIN,
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
  async listData(@INVOKE_CONTEXT() ctx: IInvoke) {
    const userContext = getUserContext(ctx)
    return await this.settingService.list(userContext.tenantCode)
  }

  @Get('/:pk/:sk')
  @Auth()
  async getDetail(@INVOKE_CONTEXT() ctx: IInvoke, @Param() key: DetailDto) {
    const userContext = getUserContext(ctx)
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    return await this.settingService.get(key)
  }

  @Post('/')
  async createSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createDto: CreateSettingDto,
  ) {
    const userContext = getUserContext(invokeContext)
    return await this.settingService.create(userContext.tenantCode, createDto, {
      invokeContext,
    })
  }

  @Put('/:pk/:sk')
  async updateSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() key: DetailDto,
    @Body() updateDto: UpdateSettingDto,
  ) {
    const userContext = getUserContext(invokeContext)
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return await this.settingService.update(key, updateDto, { invokeContext })
  }

  @Delete('/:pk/:sk')
  async deleteSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() key: DetailDto,
  ) {
    const userContext = getUserContext(invokeContext)
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return await this.settingService.delete(key, { invokeContext })
  }

  @Post('/check-exist/:code')
  async checkExistCode(
    @INVOKE_CONTEXT() ctx: IInvoke,
    @Param('code') code: string,
  ) {
    const userContext = getUserContext(ctx)
    return this.settingService.checkExistSettingCode(
      userContext.tenantCode,
      code,
    )
  }
}
