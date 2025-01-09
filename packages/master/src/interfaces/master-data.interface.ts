import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'

import {
  CreateMasterDataDto,
  DataSettingSearchDto,
  UpdateDataSettingDto,
} from '../dto'
import { MasterDataEntity, MasterDataListEntity } from '../entities'

export interface IMasterDataService {
  list(
    tenantCode: string,
    searchDto: DataSettingSearchDto,
  ): Promise<MasterDataListEntity>

  get(key: DetailDto): Promise<MasterDataEntity>

  create(createDto: CreateMasterDataDto, context: { invokeContext: IInvoke })

  update(
    key: DetailDto,
    updateDto: UpdateDataSettingDto,
    context: { invokeContext: IInvoke },
  )
  delete(key: DetailDto, opts: { invokeContext: IInvoke })

  checkExistCode(tenantCode: string, type: string, code: string)
}
