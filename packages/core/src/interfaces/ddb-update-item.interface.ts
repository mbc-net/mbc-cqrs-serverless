// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.Modifying.html
export type DdbValueType = boolean | number | string | Record<string, any>
export type DdbValueAllType = DdbValueType | DdbValueType[]

export type DdbUpdateSetPathValue = {
  path: string
  value: DdbValueAllType
}

export type DdbUpdateSetValue = {
  incrementBy?: number
  decrementBy?: number
  ifNotExists?: string | DdbUpdateSetPathValue
  listAppend?: string[] | DdbUpdateSetPathValue
}

export interface DdbUpdateItem {
  set?: Record<string, DdbValueAllType | DdbUpdateSetValue>
  remove?: Record<string, boolean | { index: number }>
  delete?: Record<string, DdbValueType>
}
