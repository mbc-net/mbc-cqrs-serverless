import { DetailDto, IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { CreateSettingDto } from '../dto/settings/create.setting.dto'
import { CreateCommonTenantSettingDto } from '../dto/settings/create-common.setting.dto'
import { CreateCroupSettingDto } from '../dto/settings/create-group-setting.dto'
import { CreateUserSettingDto } from '../dto/settings/create-user.setting.dto'
import { GetSettingDto } from '../dto/settings/get-setting.dto'
import { UpdateSettingDto } from '../dto/settings/update.setting.dto'
import { SettingTenantService } from '../services'

@ApiTags('setting')
@Controller('setting')
export class TenantSettingController {
  constructor(private readonly settingTenantSerivce: SettingTenantService) {}

  @Get()
  async getTenant(
    @Query() dto: GetSettingDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.settingTenantSerivce.getSetting(dto, { invokeContext })
  }

  @Post('common')
  async createCommonTenantSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CreateCommonTenantSettingDto,
  ) {
    return await this.settingTenantSerivce.createCommonTenantSetting(dto, {
      invokeContext,
    })
  }

  @Post()
  async createSettingTenant(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CreateSettingDto,
  ) {
    return await this.settingTenantSerivce.createTenantSetting(dto, {
      invokeContext,
    })
  }
  @Post('group')
  async createGroupSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CreateCroupSettingDto,
  ) {
    return await this.settingTenantSerivce.createGroupSetting(dto, {
      invokeContext,
    })
  }
  @Post('user')
  async createUserSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CreateUserSettingDto,
  ) {
    return await this.settingTenantSerivce.createUserSetting(dto, {
      invokeContext,
    })
  }

  @Patch('/:pk/:sk')
  async updateTenant(
    @Param() key: DetailDto,
    @Body() dto: UpdateSettingDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.settingTenantSerivce.updateSetting(key, dto, {
      invokeContext,
    })
  }

  @Delete('/:pk/:sk')
  async deleteTenant(
    @Param() dto: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.settingTenantSerivce.deleteSetting(dto, { invokeContext })
  }
}
