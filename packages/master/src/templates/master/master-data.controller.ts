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
  Injectable,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { MasterDataCreateDto } from './dto/master-data-create.dto'
import { MasterDataSearchDto } from './dto/master-data-search.dto'
import { MasterDataUpdateDto } from './dto/master-data-update.dto'
import { parsePk } from './helpers'
import { CustomMasterDataService } from './master-data.service'

@ApiTags('master-data')
@Controller('api/master-data')
@Injectable()
export class MasterDataController {
  constructor(private readonly masterDataService: CustomMasterDataService) {}

  @Get('/')
  async list(
    @Query() searchDto: MasterDataSearchDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterDataService.list(searchDto, invokeContext)
  }

  @Get('/:pk/:sk')
  async getDetail(@Param() key: DetailDto) {
    return this.masterDataService.getDetail(key)
  }

  @Post('/')
  async create(
    @Body() createDto: MasterDataCreateDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterDataService.create(createDto, invokeContext)
  }

  @Put('/:pk/:sk')
  async update(
    @Param() key: DetailDto,
    @Body() updateDto: MasterDataUpdateDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    const userContext = getUserContext(invokeContext)

    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    return this.masterDataService.update(key, updateDto, invokeContext)
  }

  @Delete('/:pk/:sk')
  async delete(
    @Param() key: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    const userContext = getUserContext(invokeContext)

    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    return this.masterDataService.delete(key, invokeContext)
  }

  @Post('/check-exist/:settingCode/:code')
  async checkExistCode(
    @Param('settingCode') settingCode: string,
    @Param('code') code: string,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterDataService.checkExistCode(
      settingCode,
      code,
      invokeContext,
    )
  }
}
