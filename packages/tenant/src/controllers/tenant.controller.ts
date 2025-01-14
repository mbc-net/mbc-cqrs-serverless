import { DetailDto, IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  CommonTenantCreateDto,
  TenantCreateDto,
  TenantGroupAddDto,
  TenantGroupUpdateDto,
  TenantUpdateDto,
} from '../dto'
import { TenantService } from '../services'

@ApiTags('tenant')
@Controller('api/tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('/:pk/:sk')
  async getTenant(@Param() dto: DetailDto) {
    return await this.tenantService.getTenant(dto)
  }

  @Post('common')
  async createTenantCommon(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CommonTenantCreateDto,
  ) {
    return await this.tenantService.createCommonTenant(dto, { invokeContext })
  }

  @Post()
  async createTenant(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: TenantCreateDto,
  ) {
    return await this.tenantService.createTenant(dto, {
      invokeContext,
    })
  }
  @Patch('/:pk/:sk')
  async updateTenant(
    @Param() key: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: TenantUpdateDto,
  ) {
    return await this.tenantService.updateTenant(key, dto, { invokeContext })
  }

  @Delete('/:pk/:sk')
  async deleteTenant(
    @Param() dto: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.tenantService.deleteTenant(dto, { invokeContext })
  }

  @Post('group')
  async addGroup(
    @Body() dto: TenantGroupAddDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.tenantService.addTenantGroup(dto, { invokeContext })
  }

  @Patch('group')
  async customizeSettingGroups(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: TenantGroupUpdateDto,
  ) {
    return await this.tenantService.customizeSettingGroups(dto, {
      invokeContext,
    })
  }
}
