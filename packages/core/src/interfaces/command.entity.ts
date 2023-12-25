import { CommandModel } from './command-model.interface'
import { DetailKey } from './detail-key.interface'

export class CommandEntity implements CommandModel {
  status?: string
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
  attributes?: any

  get key(): DetailKey {
    return {
      pk: this.pk,
      sk: this.sk,
    }
  }
}
