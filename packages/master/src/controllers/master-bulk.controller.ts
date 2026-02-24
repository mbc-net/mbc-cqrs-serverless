import {
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
} from '@mbc-cqrs-serverless/core'
import { BadRequestException, Body, Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { MasterBulkDto } from '../dto/master-bulk'
import { MasterDataCreateDto } from '../dto/master-copy/master-data-create.dto'
import { MasterDataCreateBulkDto } from '../dto/master-copy/master-data-create-bulk.dto'
import { CommonSettingDto } from '../dto/master-setting/common-setting-create.dto'
import { CommonSettingBulkDto } from '../dto/master-setting/common-setting-create-bulk.dto'
import { MasterDataService } from '../services/master-data.service'
import { MasterSettingService } from '../services/master-setting.service'

@Controller('api/master-bulk')
@ApiTags('master-bulk')
export class MasterBulkController {
  constructor(
    private readonly masterSettingService: MasterSettingService,
    private readonly masterDataService: MasterDataService,
  ) {}

  @Post('/bulk')
  async createBulk(
    @Body() bulkDto: MasterBulkDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    const userContext = getUserContext(invokeContext)
    const settingItems: CommonSettingDto[] = []
    const dataItems: MasterDataCreateDto[] = []

    for (const item of bulkDto.items) {
      // Validate tenantCode: if specified, must match the user's tenant
      if (item.tenantCode && item.tenantCode !== userContext.tenantCode) {
        throw new BadRequestException(`Invalid tenant code: ${item.tenantCode}`)
      }

      if (item.settingCode) {
        // Has settingCode → master data
        dataItems.push({
          settingCode: item.settingCode,
          name: item.name,
          code: item.code,
          tenantCode: item.tenantCode,
          seq: item.seq,
          attributes: item.attributes,
        })
      } else {
        // No settingCode → master setting
        settingItems.push({
          name: item.name,
          code: item.code,
          tenantCode: item.tenantCode,
          settingValue: item.attributes,
        })
      }
    }

    const promises: Promise<any[]>[] = []

    if (settingItems.length > 0) {
      const settingBulkDto = new CommonSettingBulkDto()
      settingBulkDto.items = settingItems
      promises.push(
        this.masterSettingService.upsertBulk(settingBulkDto, invokeContext),
      )
    } else {
      promises.push(Promise.resolve([]))
    }

    if (dataItems.length > 0) {
      const dataBulkDto = new MasterDataCreateBulkDto()
      dataBulkDto.items = dataItems
      promises.push(
        this.masterDataService.upsertBulk(dataBulkDto, invokeContext),
      )
    } else {
      promises.push(Promise.resolve([]))
    }

    const [settingResults, dataResults] = await Promise.all(promises)

    return [...settingResults, ...dataResults]
  }
}
