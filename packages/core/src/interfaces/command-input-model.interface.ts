export interface CommandInputModel {
  pk: string
  sk: string // include version
  id: string
  code: string
  name: string
  version: number
  tenantCode: string
  type: string
  isDeleted?: boolean
  seq?: number
  ttl?: number
  attributes?: Record<string, any>
}

export interface CommandPartialInputModel extends Partial<CommandInputModel> {
  pk: string
  sk: string
  version: number
}
