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

import { AddTenantGroupDto } from '../dto/tenant/add-group-tenant.dto'
import { CreateTenantDto } from '../dto/tenant/create.tenant.dto'
import { CreateCommonTenantDto } from '../dto/tenant/create-common-tenant.dto'
import { UpdateTenantDto } from '../dto/tenant/update.tenant.dto'
import { UpdateTenantGroupDto } from '../dto/tenant/update-tenant-group.dto'
import { TenantService } from '../services'

@ApiTags('tenant')
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('/:pk/:sk')
  async getTenant(@Param() dto: DetailDto) {
    return await this.tenantService.getTenant(dto)
  }

  @Post('common')
  async createTenantCommon(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CreateCommonTenantDto,
  ) {
    return await this.tenantService.createCommonTenant(dto, { invokeContext })
  }

  @Post()
  async createTenant(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CreateTenantDto,
  ) {
    return await this.tenantService.createTenant(dto, {
      invokeContext,
    })
  }
  @Patch('/:pk/:sk')
  async updateTenant(
    @Param() key: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: UpdateTenantDto,
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
    @Body() dto: AddTenantGroupDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.tenantService.addTenantGroup(dto, { invokeContext })
  }

  @Patch('group/:pk/:sk')
  async customizeSettingGroups(
    @Param() key: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: UpdateTenantGroupDto,
  ) {
    return await this.tenantService.customizeSettingGroups(key, dto, {
      invokeContext,
    })
  }
}
