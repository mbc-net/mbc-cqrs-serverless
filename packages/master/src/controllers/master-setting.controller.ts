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
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { DetailKeys } from '../decorators'
import { MasterSettingSearchDto, MasterSettingUpdateDto } from '../dto'
import { CommonSettingDto } from '../dto/master-setting/common-setting-create.dto'
import { GroupSettingDto } from '../dto/master-setting/group-setting-create.dto'
import { GetSettingDto } from '../dto/master-setting/setting-get.dto'
import { TenantSettingDto } from '../dto/master-setting/tenant-setting-create.dto'
import { UpdateSettingDto } from '../dto/master-setting/update.setting.dto'
import { UserSettingDto } from '../dto/master-setting/user-setting-create.dto'
import { parsePk } from '../helpers'
import { MasterSettingService } from '../services/master-setting.service'

@Controller('api/master-setting')
@ApiTags('master-settings')
export class MasterSettingController {
  constructor(private readonly masterSettingService: MasterSettingService) {}

  @Get('/list')
  async list(
    @Query() searchDto: MasterSettingSearchDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterSettingService.list(searchDto, invokeContext)
  }

  @Get('/:code')
  async getSettingDetail(
    @Param() dto: GetSettingDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.masterSettingService.getSetting(dto, { invokeContext })
  }

  @Post('common')
  async createCommonTenantSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CommonSettingDto,
  ) {
    return await this.masterSettingService.createCommonTenantSetting(dto, {
      invokeContext,
    })
  }

  @Post('tenant')
  async createSettingTenant(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: TenantSettingDto,
  ) {
    return await this.masterSettingService.createTenantSetting(dto, {
      invokeContext,
    })
  }
  @Post('group')
  async createGroupSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: GroupSettingDto,
  ) {
    return await this.masterSettingService.createGroupSetting(dto, {
      invokeContext,
    })
  }
  @Post('user')
  async createUserSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: UserSettingDto,
  ) {
    return await this.masterSettingService.createUserSetting(dto, {
      invokeContext,
    })
  }

  @Patch('/:pk/:sk')
  async updateTenant(
    @Param() key: DetailDto,
    @Body() dto: UpdateSettingDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.masterSettingService.updateSetting(key, dto, {
      invokeContext,
    })
  }

  @Delete('/:pk/:sk')
  async deleteTenant(
    @Param() dto: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.masterSettingService.deleteSetting(dto, { invokeContext })
  }

  @Get('/detail/:id')
  async getDetailById(@DetailKeys() key: DetailDto) {
    return this.masterSettingService.getDetail(key)
  }

  @Post('/')
  async create(
    @Body() createDto: CommonSettingDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterSettingService.create(createDto, invokeContext)
  }

  @Put('/:id')
  async update(
    @DetailKeys() key: DetailDto,
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

  @Delete('/:id')
  async delete(
    @DetailKeys() key: DetailDto,
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
}
