import { DetailDto, IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { CreateTenantDto } from './dto/tenant/create.tenant.dto'
import { TenantService } from './tenant.service'

@ApiTags('tenant')
@Controller()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('/:pk/:sk')
  async getTenant(@Param() dto: DetailDto) {
    return await this.tenantService.getTenant(dto)
  }

  @Post()
  async createTenant(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: CreateTenantDto,
  ) {
    return await this.createTenant(invokeContext, dto)
  }

  @Delete('/:pk/:sk')
  async deleteTenant(
    @Param() dto: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.deleteTenant(dto, invokeContext)
  }
}
