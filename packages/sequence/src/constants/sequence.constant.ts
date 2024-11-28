type MasterDataType = {
  format: string
  startMonth?: number
  registerDate?: Date
}

export const DEFAULT_MASTER_DATA = Symbol('DEFAULT_MASTER_DATA')

export const DEFAULT_VALUE_MASTER_DATA: MasterDataType = {
  format: '%%no%%',
}
