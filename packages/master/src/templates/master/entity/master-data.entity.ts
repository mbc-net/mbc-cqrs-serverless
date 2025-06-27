import { DataEntity } from '@mbc-cqrs-serverless/core'

export class MasterDataEntity extends DataEntity {
  attributes: Record<string, any>

  constructor(partial: Partial<MasterDataEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
