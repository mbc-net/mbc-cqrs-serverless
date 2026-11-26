import {
  AttributeValue,
  ConditionalCheckFailedException,
  ConditionCheck,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  TransactionCanceledException,
  TransactWriteItemsCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ulid } from 'ulid'

import { TableType } from '../commands'
import {
  CommandAdmissionContentionException,
  CommandAdmissionRejectedException,
} from '../exceptions'
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
import {
  DYNAMODB_SAFETY_OPTIONS,
  STRICT_INLINE_ATTRIBUTE_BYTES,
  STRICT_INLINE_ITEM_BYTES,
  StrictInlineOptions,
  validateStrictInlineOptions,
} from './strict-inline-options'

const CLIENT_INSTANCE = Symbol()

class StrictInlineDataRejected extends BadRequestException {
  constructor() {
    super('Strict inline data operation rejected')
  }
}

/** Keep native payloads and error causes inside the opted-in datastore. */
function StrictInlineBoundary(): MethodDecorator {
  return (_target, _property, descriptor: PropertyDescriptor) => {
    const original = descriptor.value
    descriptor.value = async function (
      this: DynamoDbService,
      ...args: unknown[]
    ) {
      try {
        return await original.apply(this, args)
      } catch (error) {
        if (!this.isStrictInline) throw error
        if (error instanceof StrictInlineDataRejected) {
          throw new StrictInlineDataRejected()
        }
        if (error instanceof ConditionalCheckFailedException) {
          throw new ConditionalCheckFailedException({
            message: 'The conditional request failed',
            $metadata: {},
          })
        }
        if (error instanceof CommandAdmissionRejectedException) {
          throw new CommandAdmissionRejectedException()
        }
        if (error instanceof CommandAdmissionContentionException) {
          throw new CommandAdmissionContentionException()
        }
        throw new ServiceUnavailableException(
          'Strict inline data operation unavailable',
        )
      }
    }
  }
}

@Injectable()
export class DynamoDbService {
  private readonly logger = new Logger(DynamoDbService.name)
  private readonly [CLIENT_INSTANCE]: DynamoDBClient
  private readonly tablePrefix: string
  private readonly strictInline: boolean
  private destroyed = false

  constructor(
    private readonly config: ConfigService,
    private readonly s3Service: S3Service,
    @Optional()
    @Inject(DYNAMODB_SAFETY_OPTIONS)
    safety?: StrictInlineOptions,
  ) {
    validateStrictInlineOptions(safety)
    this.strictInline = safety !== undefined
    this[CLIENT_INSTANCE] = new DynamoDBClient({
      endpoint: config.get<string>('DYNAMODB_ENDPOINT'),
      region: config.get<string>('DYNAMODB_REGION'),
      ...(this.strictInline ? { maxAttempts: 1 } : {}),
    })
    this.tablePrefix = `${config.get<string>('NODE_ENV')}-${config.get<string>(
      'APP_NAME',
    )}-`
  }

  get client(): DynamoDBClient {
    return this[CLIENT_INSTANCE]
  }

  get isStrictInline(): boolean {
    return this.strictInline
  }

  onModuleDestroy(): void {
    if (this.strictInline && !this.destroyed) {
      this.destroyed = true
      this[CLIENT_INSTANCE].destroy()
    }
  }

  @StrictInlineBoundary()
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

  /** Persist an item atomically with server-owned, read-only admission checks. */
  @StrictInlineBoundary()
  async putItemWithConditions(
    tableName: string,
    item: Record<string, any>,
    conditions: string | undefined,
    admissionConditions: ConditionCheck[],
  ) {
    // Validate before serialization, which can upload large attributes to S3.
    this.validateAdmissionConditions(admissionConditions)
    if (admissionConditions.length === 0) {
      return this.putItem(tableName, item, conditions)
    }
    const data = await this.objToDdbItem(tableName, item)
    try {
      await this.client.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            {
              Put: {
                TableName: tableName,
                Item: data,
                ConditionExpression: conditions,
              },
            },
            ...admissionConditions.map((ConditionCheck) => ({
              ConditionCheck,
            })),
          ],
        }),
      )
    } catch (error) {
      throw this.translateAdmissionFailure(error, item)
    }
    return item
  }

  /**
   * Reasons follow TransactItems order: [0] is the Put, the rest are checks.
   * A failed check wins over a version conflict because the request is stale.
   */
  private translateAdmissionFailure(
    error: unknown,
    item: Record<string, any>,
  ): unknown {
    if (!(error instanceof TransactionCanceledException)) {
      return error
    }
    const codes = (error.CancellationReasons ?? []).map(({ Code }) => Code)
    if (this.strictInline) {
      if (codes.slice(1).includes('ConditionalCheckFailed')) {
        return new CommandAdmissionRejectedException()
      }
      if (codes[0] === 'ConditionalCheckFailed') {
        return new ConditionalCheckFailedException({
          message: 'The conditional request failed',
          $metadata: {},
        })
      }
      if (codes.includes('TransactionConflict')) {
        return new CommandAdmissionContentionException()
      }
      return new ServiceUnavailableException(
        'Strict inline data operation unavailable',
      )
    }
    const context = `pk=${item.pk} sk=${item.sk} reasons=${codes.join(',')}`
    if (codes.slice(1).includes('ConditionalCheckFailed')) {
      this.logger.warn(`Command admission rejected: ${context}`)
      return new CommandAdmissionRejectedException(error)
    }
    if (codes[0] === 'ConditionalCheckFailed') {
      this.logger.warn(`Command version conflict: ${context}`)
      return Object.assign(
        new ConditionalCheckFailedException({
          message: 'The conditional request failed',
          $metadata: error.$metadata,
        }),
        { cause: error },
      )
    }
    if (codes.includes('TransactionConflict')) {
      this.logger.warn(`Command admission contention: ${context}`)
      return new CommandAdmissionContentionException(error)
    }
    return error
  }

  private validateAdmissionConditions(conditions: ConditionCheck[]): void {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value)
    const isString = (value: unknown) => typeof value === 'string'
    const isAttribute = (value: unknown): boolean => {
      if (!isRecord(value) || Object.keys(value).length !== 1) return false
      const [type, data] = Object.entries(value)[0]
      switch (type) {
        case 'S':
        case 'N':
          return isString(data)
        case 'B':
          return data instanceof Uint8Array
        case 'BOOL':
          return typeof data === 'boolean'
        case 'NULL':
          return data === true
        case 'SS':
        case 'NS':
          return Array.isArray(data) && data.length > 0 && data.every(isString)
        case 'BS':
          return (
            Array.isArray(data) &&
            data.length > 0 &&
            data.every((v) => v instanceof Uint8Array)
          )
        case 'L':
          return Array.isArray(data) && data.every(isAttribute)
        case 'M':
          return isRecord(data) && Object.values(data).every(isAttribute)
        default:
          return false
      }
    }
    const allowed = [
      'TableName',
      'Key',
      'ConditionExpression',
      'ExpressionAttributeNames',
      'ExpressionAttributeValues',
      'ReturnValuesOnConditionCheckFailure',
    ]
    if (!Array.isArray(conditions) || conditions.length > 99) {
      throw new TypeError(
        'Admission conditions must be an array of at most 99 ConditionCheck objects',
      )
    }
    for (const check of conditions) {
      if (
        !isRecord(check) ||
        Object.keys(check).some((key) => !allowed.includes(key)) ||
        typeof check.TableName !== 'string' ||
        !check.TableName.trim() ||
        typeof check.ConditionExpression !== 'string' ||
        !check.ConditionExpression.trim() ||
        !isRecord(check.Key) ||
        Object.keys(check.Key).length === 0 ||
        !Object.values(check.Key).every(
          (value) =>
            isAttribute(value) &&
            Object.keys(value).every((key) => ['S', 'N', 'B'].includes(key)),
        ) ||
        (check.ExpressionAttributeNames !== undefined &&
          (!isRecord(check.ExpressionAttributeNames) ||
            !Object.values(check.ExpressionAttributeNames).every(isString))) ||
        (check.ExpressionAttributeValues !== undefined &&
          (!isRecord(check.ExpressionAttributeValues) ||
            !Object.values(check.ExpressionAttributeValues).every(
              isAttribute,
            ))) ||
        (check.ReturnValuesOnConditionCheckFailure !== undefined &&
          !['NONE', 'ALL_OLD'].includes(
            check.ReturnValuesOnConditionCheckFailure,
          ))
      ) {
        throw new TypeError('Invalid admission ConditionCheck')
      }
    }
  }

  @StrictInlineBoundary()
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
    if (!this.strictInline) {
      this.logger.debug(updateExpression)
      this.logger.debug(expressionAttributeNames)
      this.logger.debug(expressionAttributeValues)
    }
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

  @StrictInlineBoundary()
  async getItem(
    tableName: string,
    key: DetailKey,
    options?: { consistentRead?: boolean },
  ) {
    const { Item } = await this.client.send(
      new GetItemCommand({
        TableName: tableName,
        Key: this.toDdbKey(key),
        ...(options?.consistentRead ? { ConsistentRead: true } : {}),
      }),
    )

    return await this.ddbItemToObj(Item)
  }

  @StrictInlineBoundary()
  async deleteItem(tableName: string, key: DetailKey, conditions?: string) {
    const res = await this.client.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: this.toDdbKey(key),
        ConditionExpression: conditions,
      }),
    )
    return res
  }

  @StrictInlineBoundary()
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

  @StrictInlineBoundary()
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
    if (this.strictInline) this.assertStrictInlineObject(item)

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

    if (this.strictInline) {
      const native = marshall(data, {
        convertClassInstanceToMap: true,
        removeUndefinedValues: true,
      })
      this.assertStrictInlineObject(native)
      return native
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

  private assertStrictInlineObject(
    native: Record<string, AttributeValue>,
  ): void {
    this.assertStrictInlineMapKeys(native)
    // Check the persisted representation, never a caller's JSON projection.
    const data = Object.fromEntries(
      Object.entries(native).map(([key, value]) => [
        key,
        this.strictInlineBudgetValue(value, false),
      ]),
    )
    for (const key of ['attributes', ':attributes']) {
      const attributes = data[key]
      if (attributes === undefined) continue
      if (
        isS3AttributeKey(attributes) ||
        Buffer.byteLength(JSON.stringify(attributes), 'utf8') >
          STRICT_INLINE_ATTRIBUTE_BYTES
      ) {
        throw new StrictInlineDataRejected()
      }
    }
    if (
      Buffer.byteLength(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(native).map(([key, value]) => [
              key,
              this.strictInlineBudgetValue(value, true),
            ]),
          ),
        ),
        'utf8',
      ) > STRICT_INLINE_ITEM_BYTES
    ) {
      throw new StrictInlineDataRejected()
    }
  }

  /** Stable JSON budgets independent of SDK Buffer/Uint8Array and Set shapes. */
  private strictInlineBudgetValue(
    value: AttributeValue,
    wire: boolean,
  ): unknown {
    if (value.M) {
      const map = Object.fromEntries(
        Object.entries(value.M).map(([key, entry]) => [
          key,
          this.strictInlineBudgetValue(entry, wire),
        ]),
      )
      return wire ? { M: map } : map
    }
    if (value.L) {
      const list = Array.from(value.L, (entry) =>
        this.strictInlineBudgetValue(entry, wire),
      )
      return wire ? { L: list } : list
    }
    if (value.B !== undefined) {
      const binary = this.strictInlineBinaryBudget(value.B)
      return wire ? { B: binary } : binary
    }
    if (value.BS) {
      const binaries = Array.from(value.BS, (entry) =>
        this.strictInlineBinaryBudget(entry),
      )
      return wire ? { BS: binaries } : binaries
    }
    if (value.SS) {
      const strings = Array.from(value.SS)
      return wire ? { SS: strings } : strings
    }
    if (value.NS) {
      return wire
        ? { NS: Array.from(value.NS) }
        : Array.from(unmarshall({ value }).value as Set<unknown>)
    }
    return wire ? { ...value } : unmarshall({ value }).value
  }

  private strictInlineBinaryBudget(value: Uint8Array): string {
    // Use intrinsic accessors so a caller serializer cannot change byte counts.
    const prototype =
      value instanceof DataView
        ? DataView.prototype
        : Object.getPrototypeOf(Uint8Array.prototype)
    const buffer = Object.getOwnPropertyDescriptor(
      prototype,
      'buffer',
    ).get.call(value)
    const offset = Object.getOwnPropertyDescriptor(
      prototype,
      'byteOffset',
    ).get.call(value)
    const length = Object.getOwnPropertyDescriptor(
      prototype,
      'byteLength',
    ).get.call(value)
    return Buffer.from(buffer, offset, length).toString('base64')
  }

  private assertStrictInlineMapKeys(map: Record<string, AttributeValue>): void {
    const prototype = Object.getPrototypeOf(map)
    // The SDK map converters cannot preserve this key. Reject before I/O or
    // decoding rather than silently losing it or omitting it from the budget.
    if (
      Object.prototype.hasOwnProperty.call(map, '__proto__') ||
      (prototype !== Object.prototype && prototype !== null)
    ) {
      throw new StrictInlineDataRejected()
    }
    for (const value of Object.values(map)) {
      if (value.M) this.assertStrictInlineMapKeys(value.M)
      if (value.L) {
        for (const entry of value.L) this.assertStrictInlineMapKeys({ entry })
      }
    }
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
