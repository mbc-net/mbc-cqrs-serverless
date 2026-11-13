import {
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { MasterBulkDto } from '../dto/master-bulk'
import { MasterDataCreateDto } from '../dto/master-copy/master-data-create.dto'
import { MasterDataCreateBulkDto } from '../dto/master-copy/master-data-create-bulk.dto'
import { CommonSettingDto } from '../dto/master-setting/common-setting-create.dto'
import { CommonSettingBulkDto } from '../dto/master-setting/common-setting-create-bulk.dto'
import { MasterControllerGuard } from '../guards'
import { MasterDataService } from '../services/master-data.service'
import { MasterSettingService } from '../services/master-setting.service'

@Controller('api/master-bulk')
@ApiTags('master-bulk')
@UseGuards(MasterControllerGuard)
export class MasterBulkController {
  constructor(
    private readonly masterSettingService: MasterSettingService,
    private readonly masterDataService: MasterDataService,
  ) {}

  @Post('/')
  async upsertBulk(
    @Body() bulkDto: MasterBulkDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    const userContext = getUserContext(invokeContext)
    const settingItems: { index: number; item: CommonSettingDto }[] = []
    const dataItems: { index: number; item: MasterDataCreateDto }[] = []

    for (let i = 0; i < bulkDto.items.length; i++) {
      const item = bulkDto.items[i]

      // Validate tenantCode: if specified, must match the user's tenant
      if (item.tenantCode && item.tenantCode !== userContext.tenantCode) {
        throw new BadRequestException(`Invalid tenant code: ${item.tenantCode}`)
      }

      if (item.settingCode) {
        // Has settingCode → master data
        dataItems.push({
          index: i,
          item: {
            settingCode: item.settingCode,
            name: item.name,
            code: item.code,
            tenantCode: item.tenantCode,
            seq: item.seq,
            attributes: item.attributes,
          },
        })
      } else {
        // No settingCode → master setting
        settingItems.push({
          index: i,
          item: {
            name: item.name,
            code: item.code,
            tenantCode: item.tenantCode,
            systemId: item.systemId,
            settingValue: item.attributes,
          },
        })
      }
    }

    const settingBulkDto = new CommonSettingBulkDto()
    settingBulkDto.items = settingItems.map((s) => s.item)

    const dataBulkDto = new MasterDataCreateBulkDto()
    dataBulkDto.items = dataItems.map((d) => d.item)

    // Settings first, so data rows can find a setting created in the same request.
    const settingResults = settingItems.length
      ? await this.masterSettingService.upsertBulk(
          settingBulkDto,
          invokeContext,
        )
      : []
    const dataResults = dataItems.length
      ? await this.masterDataService.upsertBulk(dataBulkDto, invokeContext)
      : []

    // Restore original input order
    const results = new Array(bulkDto.items.length)
    settingItems.forEach((s, idx) => {
      results[s.index] = settingResults[idx]
    })
    dataItems.forEach((d, idx) => {
      results[d.index] = dataResults[idx]
    })

    return results
  }
}
