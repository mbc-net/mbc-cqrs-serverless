import {
  DetailDto,
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  //   BadRequestException,
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

import { DetailKeys } from '../decorators'
import {
  CustomMasterDataSearchDto,
  MasterDataCreateDto,
  MasterDataUpdateDto,
} from '../dto'
import { MasterDataCreateBulkDto } from '../dto/master-copy/master-data-create-bulk.dto'
import { CreateMasterDataDto } from '../dto/master-data/data-create.dto'
import { MasterDataSearchDto } from '../dto/master-data/data-search.dto'
import { UpdateDataSettingDto } from '../dto/master-data/data-update.dto'
import { parsePk } from '../helpers'
import { MasterDataService } from '../services/master-data.service'

@Controller('api/master-data')
@ApiTags('master-data')
export class MasterDataController {
  private readonly logger = new Logger(MasterDataController.name)

  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('/')
  async listData(
    @INVOKE_CONTEXT() ctx: IInvoke,
    @Query() searchDto: MasterDataSearchDto,
  ) {
    return await this.masterDataService.list(searchDto)
  }

  @Get('/detail/:id')
  async getDetailById(@DetailKeys() key: DetailDto) {
    return this.masterDataService.getDetail(key)
  }

  @Get('/:pk/:sk')
  async getDetail(@INVOKE_CONTEXT() ctx: IInvoke, @Param() key: DetailDto) {
    return await this.masterDataService.get(key)
  }

  @Post('/')
  async createDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createDto: CreateMasterDataDto,
  ) {
    return await this.masterDataService.create(createDto, { invokeContext })
  }

  @Put('/:pk/:sk')
  async updateDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() key: DetailDto,
    @Body() updateDto: UpdateDataSettingDto,
  ) {
    return await this.masterDataService.update(key, updateDto, {
      invokeContext,
    })
  }

  @Delete('/:pk/:sk')
  async deleteDataSetting(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() key: DetailDto,
  ) {
    return this.masterDataService.delete(key, { invokeContext })
  }

  @Post('/check-exist/:settingCode/:code')
  async checkExistCode(
    @INVOKE_CONTEXT() ctx: IInvoke,
    @Param('settingCode') settingCode: string,
    @Param('code') code: string,
  ) {
    const userContext = getUserContext(ctx)
    return this.masterDataService.checkExistCode(
      userContext.tenantCode,
      settingCode,
      code,
    )
  }

  @Get('/list')
  async list(
    @Query() searchDto: CustomMasterDataSearchDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterDataService.listByRds(searchDto, { invokeContext })
  }

  @Post('/create')
  async create(
    @Body() createDto: MasterDataCreateDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterDataService.createSetting(createDto, invokeContext)
  }

  @Post('/bulk')
  async createBulk(
    @Body() createDto: MasterDataCreateBulkDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return this.masterDataService.createBulk(createDto, invokeContext)
  }

  @Put('/:id')
  async update(
    @DetailKeys() key: DetailDto,
    @Body() updateDto: MasterDataUpdateDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    const userContext = getUserContext(invokeContext)

    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    return this.masterDataService.updateSetting(key, updateDto, invokeContext)
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

    return this.masterDataService.deleteSetting(key, invokeContext)
  }
}
