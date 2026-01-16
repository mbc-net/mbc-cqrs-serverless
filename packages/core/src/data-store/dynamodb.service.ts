import {
  AttributeValue,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ulid } from 'ulid'

import { TableType } from '../commands'
import {
  isS3AttributeKey,
  parseS3AttributeKey,
  toISOStringWithTimezone,
  toS3AttributeKey,
} from '../helpers'
import { objectBytes } from '../helpers/object'
import {
  DdbUpdateItem,
  DdbUpdateSetPathValue,
  DdbUpdateSetValue,
  DdbValueAllType,
  DdbValueType,
  DetailKey,
} from '../interfaces'
import { S3Service } from './s3.service'

const CLIENT_INSTANCE = Symbol()

@Injectable()
export class DynamoDbService {
  private readonly logger = new Logger(DynamoDbService.name)
  private readonly [CLIENT_INSTANCE]: DynamoDBClient
  private readonly tablePrefix: string

  constructor(
    private readonly config: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    this[CLIENT_INSTANCE] = new DynamoDBClient({
      endpoint: config.get<string>('DYNAMODB_ENDPOINT'),
      region: config.get<string>('DYNAMODB_REGION'),
    })
    this.tablePrefix = `${config.get<string>('NODE_ENV')}-${config.get<string>(
      'APP_NAME',
    )}-`
  }

  get client(): DynamoDBClient {
    return this[CLIENT_INSTANCE]
  }

  async putItem(
    tableName: string,
    item: Record<string, any>,
    conditions?: string,
  ) {
    const data = await this.objToDdbItem(tableName, item)

    await this.client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: data,
        ConditionExpression: conditions,
        ReturnValues: 'NONE',
      }),
    )

    return item
  }

  async updateItem(
    tableName: string,
    key: DetailKey,
    item: DdbUpdateItem,
    conditions?: string,
  ) {
    if (!item.set?.updatedAt) {
      const updatedAt = new Date()
      if (!item.set) {
        item.set = { updatedAt }
      } else {
        item.set.updatedAt = updatedAt
      }
    }

    const {
      updateExpression,
      expressionAttributeNames,
      expressionAttributeValues,
    } = this.buildUpdateExpression(item)
    this.logger.debug(updateExpression)
    this.logger.debug(expressionAttributeNames)
    this.logger.debug(expressionAttributeValues)
    const res = await this.client.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: this.toDdbKey(key),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: await this.objToDdbItem(
          tableName,
          expressionAttributeValues,
        ),
        ConditionExpression: conditions,
        ReturnValues: 'ALL_NEW',
      }),
    )

    return this.ddbItemToObj(res.Attributes)
  }

  async getItem(tableName: string, key: DetailKey) {
    const { Item } = await this.client.send(
      new GetItemCommand({
        TableName: tableName,
        Key: this.toDdbKey(key),
      }),
    )

    return await this.ddbItemToObj(Item)
  }

  async listItemsByPk(
    tableName: string,
    pk: string,
    sk?: {
      skExpression: string
      skAttributeValues: Record<string, string>
      skAttributeNames?: Record<string, string>
    },
    startFromSk?: string,
    limit = 10,
    order: 'asc' | 'desc' = 'asc',
  ): Promise<any> {
    const res = await this.client.send(
      new QueryCommand({
        TableName: tableName,
        Limit: limit,
        ScanIndexForward: order === 'asc',
        ExclusiveStartKey: startFromSk
          ? this.toDdbKey({ pk, sk: startFromSk })
          : undefined,
        KeyConditionExpression:
          'pk = :pk' + (sk ? ` and ${sk.skExpression}` : ''),
        ExpressionAttributeNames: sk?.skAttributeNames,
        ExpressionAttributeValues: await this.objToDdbItem(tableName, {
          ...sk?.skAttributeValues,
          ':pk': pk,
        }),
      }),
    )

    const lastSk = res.LastEvaluatedKey
      ? unmarshall(res.LastEvaluatedKey).sk
      : undefined
    const items = await Promise.all(
      res.Items?.map((item) => this.ddbItemToObj(item)),
    )

    return {
      lastSk,
      items,
    }
  }

  async listAllItems(tableName: string, startKey?: DetailKey, limit = 10) {
    const res = await this.client.send(
      new ScanCommand({
        TableName: tableName,
        Limit: limit,
        ExclusiveStartKey: startKey ? this.toDdbKey(startKey) : undefined,
      }),
    )

    const lastKey = res.LastEvaluatedKey
      ? (unmarshall(res.LastEvaluatedKey) as DetailKey)
      : undefined
    const items = await Promise.all(
      res.Items?.map((item) => this.ddbItemToObj(item)),
    )

    return {
      lastKey,
      items,
    }
  }

  private async ddbItemToObj(
    item: Record<string, AttributeValue>,
  ): Promise<any> {
    if (!item) {
      return item
    }
    const obj = unmarshall(item)

    if (isS3AttributeKey(obj.attributes)) {
      const { key } = parseS3AttributeKey(obj.attributes)
      obj.attributes = await this.s3Service.getItem(key)
    }

    if (obj.createdAt) {
      obj.createdAt = new Date(obj.createdAt)
    }

    if (obj.updatedAt) {
      obj.updatedAt = new Date(obj.updatedAt)
    }

    return obj
  }

  private async objToDdbItem(tableName: string, obj: Record<string, any>) {
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

    if (data.attributes || data[':attributes']) {
      const attributes = data.attributes || data[':attributes']
      // check size of attributes
      const bytes = objectBytes(data.attributes || data[':attributes'])

      if (bytes > this.config.get<number>('ATTRIBUTE_LIMIT_SIZE')) {
        // save to s3
        const { pk, sk } = data
        const key = `ddb/${tableName}/${pk}/${sk}/${ulid()}.json`
        const s3Key = await this.s3Service.putItem(key, attributes)
        // assign s3 url to attributes
        data.attributes = toS3AttributeKey(s3Key.Bucket, s3Key.Key)
      }
    }

    return marshall(data, {
      convertClassInstanceToMap: true,
      removeUndefinedValues: true,
    })
  }

  private toDdbKey(key: DetailKey) {
    return marshall(key, {
      convertClassInstanceToMap: true,
      removeUndefinedValues: true,
    })
  }

  private buildUpdateExpression(input: DdbUpdateItem) {
    const ret: {
      updateExpression: string
      expressionAttributeNames: Record<string, string>
      expressionAttributeValues: Record<string, any>
    } = {
      updateExpression: '',
      expressionAttributeNames: {},
      expressionAttributeValues: {},
    }
    const mapper = {
      set: this.buildUpdateSetExpression.bind(this),
      remove: this.buildUpdateRemoveExpression.bind(this),
      delete: this.buildUpdateDeleteExpression.bind(this),
    }
    for (const key in mapper) {
      if (!input[key]) {
        continue
      }
      const expr = mapper[key](input[key])
      ret.updateExpression += ' ' + expr.updateExpression
      ret.expressionAttributeNames = {
        ...ret.expressionAttributeNames,
        ...expr.expressionAttributeNames,
      }
      ret.expressionAttributeValues = {
        ...ret.expressionAttributeValues,
        ...expr.expressionAttributeValues,
      }
    }

    return ret
  }

  private buildUpdateSetExpression(
    inputSet: Record<string, DdbValueAllType | DdbUpdateSetValue>,
  ) {
    const ret: {
      updateExpression: string
      expressionAttributeNames: Record<string, string>
      expressionAttributeValues: Record<string, any>
    } = {
      updateExpression: '',
      expressionAttributeNames: {},
      expressionAttributeValues: {},
    }

    const updExprList = []
    for (const key in inputSet) {
      const val = inputSet[key]
      if (typeof val === 'undefined') {
        continue
      }
      let updExpr = `#${key}=:${key}`
      ret.expressionAttributeNames[`#${key}`] = key

      if (typeof val === 'object') {
        let isSetValue = false
        // ifNotExists
        if ('ifNotExists' in val) {
          isSetValue = true
          const ifNotExists = val.ifNotExists as DdbUpdateSetPathValue
          const path = `#${ifNotExists.path || key}`
          const value = `:${key}InitVal`
          updExpr = `#${key}=if_not_exists(${path}, ${value})`
          ret.expressionAttributeValues[value] =
            ifNotExists.value || ifNotExists
          if (!ret.expressionAttributeNames[path]) {
            ret.expressionAttributeNames[path] = path.substring(1)
          }
        }
        // incrementBy | decrementBy
        if ('incrementBy' in val) {
          isSetValue = true
          const value = `:${key}IncrementBy`
          updExpr += ` + ${value}`
          ret.expressionAttributeValues[value] = val.incrementBy
        }
        if ('decrementBy' in val) {
          isSetValue = true
          const value = `:${key}DecrementBy`
          updExpr += ` - ${value}`
          ret.expressionAttributeValues[value] = val.decrementBy
        }
        // listAppend
        if ('listAppend' in val) {
          isSetValue = true
          const listAppend = val.listAppend as DdbUpdateSetPathValue
          const path = `#${listAppend.path || key}`
          const value = `:appendFor${path.substring(1)}`
          updExpr = `#${key}=list_append(${path}, ${value})`
          ret.expressionAttributeValues[value] = listAppend.value || listAppend
          if (!ret.expressionAttributeNames[path]) {
            ret.expressionAttributeNames[path] = path.substring(1)
          }
        }

        // set a map to key
        if (!isSetValue) {
          ret.expressionAttributeValues[`:${key}`] = val
        }
      } else {
        ret.expressionAttributeValues[`:${key}`] = val
      }

      updExprList.push(updExpr)
    }
    ret.updateExpression += `SET ${updExprList.join(', ')}`

    return ret
  }

  private buildUpdateRemoveExpression(
    inputRemove: Record<string, boolean | { index: number }>,
  ) {
    const ret: {
      updateExpression: string
      expressionAttributeNames: Record<string, string>
      expressionAttributeValues: Record<string, any>
    } = {
      updateExpression: '',
      expressionAttributeNames: {},
      expressionAttributeValues: {},
    }

    const updExprList = []
    for (const key in inputRemove) {
      const val = inputRemove[key]
      if (!val) {
        continue
      }
      let updExpr = `#${key}`
      if (typeof val === 'object' && 'index' in val) {
        updExpr += `[${val.index}]`
      }
      updExprList.push(updExpr)
      ret.expressionAttributeNames[`#${key}`] = key
    }

    ret.updateExpression += `REMOVE ${updExprList.join(', ')}`

    return ret
  }

  private buildUpdateDeleteExpression(
    inputDelete: Record<string, DdbValueType>,
  ) {
    const ret: {
      updateExpression: string
      expressionAttributeNames: Record<string, string>
      expressionAttributeValues: Record<string, any>
    } = {
      updateExpression: '',
      expressionAttributeNames: {},
      expressionAttributeValues: {},
    }

    const updExprList = []
    for (const key in inputDelete) {
      const val = inputDelete[key]
      if (typeof val === 'undefined') {
        continue
      }
      updExprList.push(`#${key} :${key}`)
      ret.expressionAttributeNames[`#${key}`] = key
      ret.expressionAttributeValues[`:${key}`] = val
    }

    ret.updateExpression += `DELETE ${updExprList.join(', ')}`

    return ret
  }

  getTableName(moduleName: string, type?: TableType): string {
    let tableName = this.tablePrefix + moduleName
    if (type) {
      tableName = `${tableName}-${type}`
    }
    return tableName
  }

  getModuleName(tableName: string): string {
    const removedPrefix = tableName.substring(this.tablePrefix.length)
    return removedPrefix.substring(0, removedPrefix.lastIndexOf('-'))
  }
}
