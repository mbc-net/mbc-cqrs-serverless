import { SearchDto } from '@mbc-cqrs-sererless/core'
import { Injectable, Logger } from '@nestjs/common'

import { MasterDataListEntity } from './entity/master-data-list.entity'

@Injectable()
export class MasterService {
  private readonly logger = new Logger(MasterService.name)

  constructor() {}

  async searchData(searchDto: SearchDto): Promise<MasterDataListEntity> {
    this.logger.debug('search', searchDto)
    return new MasterDataListEntity({
      total: 0,
      items: [],
    })
  }
}
