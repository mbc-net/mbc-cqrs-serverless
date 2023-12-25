import { DataModel } from './data-model.interface'
import { DetailKey } from './detail-key.interface'

export class DataEntity implements DataModel {
  cpk?: string
  csk?: string
  requestId: string
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  createdIp: string
  updatedIp: string
  pk: string
  sk: string
  id: string
  code: string
  name: string
  version: number
  tenantCode: string
  type: string
  seq?: number
  ttl?: number
  attributes?: Record<string, any>

  constructor(data: Partial<DataEntity>) {
    Object.assign(this, data)
  }

  get key(): DetailKey {
    return {
      pk: this.pk,
      sk: this.sk,
    }
  }
}
