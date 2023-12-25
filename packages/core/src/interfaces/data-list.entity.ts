import { DataEntity } from './data.entity'

export class DataListEntity {
  total?: number
  lastSk?: string
  items: DataEntity[]

  constructor(data: Partial<DataListEntity>) {
    Object.assign(this, data)
  }
}
