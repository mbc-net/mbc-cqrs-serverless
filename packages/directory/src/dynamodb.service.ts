import {
  AttributeValue,
  BatchWriteItemCommand,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  DetailKey,
  isS3AttributeKey,
  parseS3AttributeKey,
  S3Service,
  toISOStringWithTimezone,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

import { DynamoDataListEntity } from './entity/dyanmo-data-list.entity'

const CLIENT_INSTANCE = Symbol()

@Injectable()
export class DynamoService {
  private readonly logger = new Logger(DynamoService.name)
  private readonly [CLIENT_INSTANCE]: DynamoDBClient

  constructor(private readonly s3Service: S3Service) {
    this[CLIENT_INSTANCE] = new DynamoDBClient({
      endpoint: process.env.DYNAMODB_ENDPOINT,
      region: process.env.DYNAMODB_REGION,
    })
  }

  get client(): DynamoDBClient {
    return this[CLIENT_INSTANCE]
  }

  async getItem(tableName: string, key: DetailKey) {
    const { Item } = await this.client.send(
      new GetItemCommand({
        TableName: tableName,
        Key: this.toDdbKey(key),
      }),
    )
    if (Item) {
      const item = this.ddbItemToObj(Item)

      if (isS3AttributeKey(item?.attributes)) {
        const { key } = parseS3AttributeKey(
          item?.attributes as unknown as string,
        )
        item.attributes = await this.s3Service.getItem(key)
      }
      return item
    }
    return undefined
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
    limit?: number,
    order: 'asc' | 'desc' = 'asc',
  ): Promise<DynamoDataListEntity> {
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
        ExpressionAttributeValues: this.objToDdbItem({
          ...sk?.skAttributeValues,
          ':pk': pk,
        }),
      }),
    )

    const lastSk = res.LastEvaluatedKey
      ? unmarshall(res.LastEvaluatedKey).sk
      : undefined
    const items = await Promise.all(
      res.Items?.map(async (data) => {
        const item = this.ddbItemToObj(data)

        if (isS3AttributeKey(item?.attributes)) {
          const { key } = parseS3AttributeKey(
            item?.attributes as unknown as string,
          )
          item.attributes = await this.s3Service.getItem(key)
        }

        return item
      }),
    )

    return {
      lastSk,
      items,
    }
  }

  private ddbItemToObj(item: Record<string, AttributeValue>) {
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

  private objToDdbItem(obj: Record<string, any>) {
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

  toDdbKey(key: DetailKey) {
    return marshall(key, {
      convertClassInstanceToMap: true,
      removeUndefinedValues: true,
    })
  }

  async deleteItem(key: DetailKey, tableName: string) {
    return await this.client.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: this.toDdbKey(key),
        ReturnValues: 'NONE',
      }),
    )
  }

  async batchPutItem(tableName: string, items: any[]) {
    const putRequests = items.map((item) => ({
      PutRequest: { Item: this.objToDdbItem(item) },
    }))

    const command = new BatchWriteItemCommand({
      RequestItems: {
        [`${tableName}`]: putRequests,
      },
    })

    return await this.client.send(command)
  }

  async batchDelete(tableName: string, record: any[]) {
    const deleteRequests = record.map((item) => {
      const key = this.objToDdbItem({
        pk: item.pk,
        sk: item.sk,
      })

      return {
        DeleteRequest: {
          Key: key,
        },
      }
    })
    const requestItems = {
      [tableName]: deleteRequests,
    }

    let unprocessed = requestItems![tableName] ?? []

    let attempt = 0
    const maxRetries = 5

    while (unprocessed.length > 0 && attempt < maxRetries) {
      const params = {
        RequestItems: {
          [tableName]: unprocessed,
        },
      }

      const response = await this.client.send(new BatchWriteItemCommand(params))
      unprocessed = response.UnprocessedItems?.[tableName] ?? ([] as any)

      if (unprocessed.length > 0) {
        attempt++
        const delay = Math.pow(2, attempt) * 100 // exponential backoff: 100ms, 200ms, ...
        this.logger.log(
          `Retrying ${unprocessed.length} unprocessed items (attempt ${attempt})`,
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    if (unprocessed.length > 0) {
      this.logger.log(
        `Failed to process ${unprocessed.length} items after ${maxRetries} attempts`,
      )
    }
  }
}
