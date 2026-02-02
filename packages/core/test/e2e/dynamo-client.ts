import {
  AttributeValue,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

import { DetailKey, toISOStringWithTimezone } from '../../src'
import { config } from './config'

const tablePrefix = `${config.nodeEnv}-${config.appName}-`

console.log(tablePrefix)

enum TableType {
  COMMAND = 'command',
  DATA = 'data',
  HISTORY = 'history',
}

const dynamoClient = new DynamoDBClient({
  endpoint: config.dynamoEndpoint,
  region: config.dynamoRegion,
})

const getItem = async (tableName: string, key: DetailKey) => {
  const { Item } = await dynamoClient.send(
    new GetItemCommand({
      TableName: tableName,
      Key: toDdbKey(key),
    }),
  )

  return await ddbItemToObj(Item!)
}

const deleteItem = async (tableName: string, key: DetailKey) => {
  await dynamoClient.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: toDdbKey(key),
    }),
  )
}

const listItemsByPk = async (
  tableName: string,
  pk: string,
  sk?: {
    skExpression: string
    skAttributeValues: Record<string, string>
    skAttributeNames?: Record<string, string>
  },
  startFromSk?: string,
): Promise<any> => {
  const res = await dynamoClient.send(
    new QueryCommand({
      TableName: tableName,
      ExclusiveStartKey: startFromSk
        ? toDdbKey({ pk, sk: startFromSk })
        : undefined,
      KeyConditionExpression: 'pk = :pk' + (sk ? ` and ${sk.skExpression}` : ''),
      ExpressionAttributeNames: sk?.skAttributeNames,
      ExpressionAttributeValues: await objToDdbItem(tableName, {
        ...sk?.skAttributeValues,
        ':pk': pk,
      }),
    }),
  )

  const lastSk = res.LastEvaluatedKey
    ? unmarshall(res.LastEvaluatedKey).sk
    : undefined
  const items = await Promise.all(
    (res.Items ?? []).map(() => Promise.resolve(1)),
  )

  return {
    lastSk,
    items,
  }
}

const putItem = async (
  tableName: string,
  item: Record<string, any>,
  conditions?: string,
) => {
  const data = await objToDdbItem(tableName, item)

  await dynamoClient.send(
    new PutItemCommand({
      TableName: tableName,
      Item: data,
      ConditionExpression: conditions,
      ReturnValues: 'NONE',
    }),
  )

  return item
}

export const toDdbKey = (key: DetailKey) => {
  return marshall(key, {
    convertClassInstanceToMap: true,
    removeUndefinedValues: true,
  })
}

const ddbItemToObj = async (
  item: Record<string, AttributeValue>,
): Promise<any> => {
  if (!item) {
    return item
  }
  const obj = unmarshall(item)

  if (obj.createdAt) {
    obj.createdAt = new Date(obj.createdAt)
  }

  if (obj.updatedAt) {
    obj.updatedAt = new Date(obj.updatedAt)
  }

  return obj
}

const objToDdbItem = async (tableName: string, obj: Record<string, any>) => {
  if (!obj) {
    return obj
  }
  const data = { ...obj }
  for (const key in data) {
    const value = data[key]
    if (value instanceof Date) {
      data[key] = toISOStringWithTimezone(value)
    }
  }

  return marshall(data, {
    convertClassInstanceToMap: true,
    removeUndefinedValues: true,
  })
}

const getTableName = (tableName: string, tableType: TableType) => {
  return `${tablePrefix}${tableName}-${tableType}`
}

export {
  deleteItem,
  dynamoClient,
  getItem,
  getTableName,
  listItemsByPk,
  putItem,
  TableType,
}
