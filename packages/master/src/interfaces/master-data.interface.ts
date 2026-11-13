import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'

import {
  MasterAccessOptions,
  MasterWriteOptions,
} from '../access/master-access.interface'
import {
  CreateMasterDataDto,
  CustomMasterDataSearchDto,
  MasterDataSearchDto,
  UpdateDataSettingDto,
} from '../dto'
import { MasterDataEntity, MasterDataListEntity } from '../entities'

export interface IMasterDataService {
  listByRds(searchDto: CustomMasterDataSearchDto, context: MasterWriteOptions)

  list(
    searchDto: MasterDataSearchDto,
    options?: MasterAccessOptions,
  ): Promise<MasterDataListEntity>

  get(key: DetailDto, options?: MasterAccessOptions): Promise<MasterDataEntity>

  create(createDto: CreateMasterDataDto, context: { invokeContext: IInvoke })

  update(
    key: DetailDto,
    updateDto: UpdateDataSettingDto,
    context: { invokeContext: IInvoke },
  )
  delete(key: DetailDto, opts: { invokeContext: IInvoke })

  checkExistCode(
    tenantCode: string,
    type: string,
    code: string,
    options?: MasterAccessOptions,
  )
}
