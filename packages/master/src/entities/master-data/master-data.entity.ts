import { DataEntity } from '@mbc-cqrs-serverless/core'

export class MasterDataEntity extends DataEntity {
  attributes?: object

  constructor(partial: Partial<MasterDataEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
