import { UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  DdbUpdateItem,
  DetailKey,
  DynamoDbService,
  getUserContext,
  ICommandOptions,
  IInvoke,
  INotification,
  KEY_SEPARATOR,
  S3Service,
  SnsService,
} from '@mbc-cqrs-serverless/core'
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import csv from 'csv-parser'
import { Readable } from 'stream'
import { ulid } from 'ulid'

import {
  CSV_IMPORT_PK_PREFIX,
  IMPORT_PK_PREFIX,
  ZIP_IMPORT_PK_PREFIX,
} from './constant'
import { CreateCsvImportDto } from './dto/create-csv-import.dto'
import { CreateImportDto } from './dto/create-import.dto'
import { CreateZipImportDto } from './dto/create-zip-import.dto'
import { ImportEntity } from './entity'
import { ImportStatusEnum } from './enum'
import { ImportQueueEvent } from './event'
import { IMPORT_STRATEGY_MAP } from './import.module-definition'
import { IImportStrategy } from './interface'

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name)
  private readonly tableName: string
  private readonly alarmTopicArn: string

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly snsService: SnsService,

    private readonly config: ConfigService,
    private readonly s3Service: S3Service,
    @Inject(IMPORT_STRATEGY_MAP)
    private readonly importStrategyMap: Map<string, IImportStrategy<any, any>>,
  ) {
    this.tableName = dynamoDbService.getTableName('import_tmp')
    this.alarmTopicArn = this.config.get<string>('SNS_ALARM_TOPIC_ARN')
  }

  /**
   * Handles a single import request from the API.
   * It uses the appropriate ImportStrategy to transform and validate the data
   * before creating a record in the temporary import table.
   */
  async createWithApi(
    dto: CreateImportDto,
    options: ICommandOptions,
  ): Promise<ImportEntity> {
    const { tableName, attributes } = dto

    const strategy = this.importStrategyMap.get(tableName)
    if (!strategy) {
      throw new BadRequestException(
        `No import strategy found for table: ${tableName}`,
      )
    }

    const transformedData = await strategy.transform(attributes)

    await strategy.validate(transformedData)

    return this.createImport({ ...dto, attributes: transformedData }, options)
  }

  /**
   * Main router for handling CSV imports. It delegates to the correct
   * processing method based on the specified execution strategy.
   */
  async handleCsvImport(
    dto: CreateCsvImportDto,
    options: ICommandOptions,
  ): Promise<ImportEntity[] | ImportEntity> {
    if (dto.processingMode === 'DIRECT') {
      return this._processCsvDirectly(dto, options)
    } else {
      return this.createCsvJob(dto, options)
    }
  }

  /**
   * Creates a master job record for a CSV import that will be orchestrated
   * by a Step Function.
   */
  async createCsvJob(
    dto: CreateCsvImportDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<ImportEntity> {
    const sourceIp =
      options.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(options.invokeContext)

    const taskCode = ulid()
    const pk = `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}${dto.tenantCode}`
    const sk = `${dto.tableName}#${taskCode}`

    const item = new ImportEntity({
      id: `${pk}#${sk}`,
      pk,
      sk,
      version: 0,
      code: taskCode,
      tenantCode: dto.tenantCode,
      type: 'CSV_MASTER_JOB',
      name: `CSV Import: ${dto.key.split('/').pop()}`,
      status: ImportStatusEnum.CREATED,
      attributes: dto,
      requestId: options.invokeContext?.context?.awsRequestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userContext.userId,
      updatedBy: userContext.userId,
      createdIp: sourceIp,
      updatedIp: sourceIp,
    })

    await this.dynamoDbService.putItem(this.tableName, item)
    return item
  }

  async createZipJob(
    dto: CreateZipImportDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<ImportEntity> {
    const sourceIp =
      options.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(options.invokeContext)

    const taskCode = ulid()
    const pk = `${ZIP_IMPORT_PK_PREFIX}${KEY_SEPARATOR}${dto.tenantCode}`
    const sk = `ZIP#${taskCode}`

    const item = new ImportEntity({
      id: `${pk}#${sk}`,
      pk,
      sk,
      version: 0,
      code: taskCode,
      tenantCode: dto.tenantCode,
      type: 'ZIP_MASTER_JOB',
      name: `ZIP Import: ${dto.key.split('/').pop()}`,
      status: ImportStatusEnum.CREATED,
      attributes: dto,
      requestId: options.invokeContext?.context?.awsRequestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userContext.userId,
      updatedBy: userContext.userId,
      createdIp: sourceIp,
      updatedIp: sourceIp,
    })

    await this.dynamoDbService.putItem(this.tableName, item)
    return item
  }

  /**
   * Creates a import job record for a single json import
   */
  async createImport(
    dto: CreateImportDto,
    options: ICommandOptions,
  ): Promise<ImportEntity> {
    const sourceIp =
      options.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(options.invokeContext)

    const taskCode = ulid()
    const pk = `${IMPORT_PK_PREFIX}${KEY_SEPARATOR}${dto.tenantCode}`
    const sk = dto.sourceId
      ? `${dto.sourceId}#${taskCode}`
      : `${dto.tableName}#${taskCode}`

    const item = {
      id: `${pk}${KEY_SEPARATOR}${sk}`,
      pk,
      sk,
      version: 0,
      code: taskCode,
      tenantCode: dto.tenantCode,
      type: dto.tableName,
      name: dto.name || dto.tableName,
      status: ImportStatusEnum.CREATED,
      attributes: dto.attributes,
      requestId: options.invokeContext?.context?.awsRequestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userContext.userId,
      updatedBy: userContext.userId,
      createdIp: sourceIp,
      updatedIp: sourceIp,
    }

    await this.dynamoDbService.putItem(this.tableName, item)

    return new ImportEntity(item)
  }

  /**
   * Creates a CSV master job that is part of a larger ZIP orchestration.
   * It stores the SFN Task Token needed to signal completion back to the orchestrator.
   * @param dto The details of the CSV file to process.
   * @param taskToken The task token from the waiting Step Function.
   * @param sourceId The key of the parent ZIP_MASTER_JOB.
   * @returns The created ImportEntity.
   */
  async createCsvJobWithTaskToken(
    dto: CreateCsvImportDto,
    taskToken: string,
    sourceId: DetailKey,
  ): Promise<ImportEntity> {
    const taskCode = ulid()
    const pk = `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}${dto.tenantCode}`
    const sk = `${dto.tableName}${KEY_SEPARATOR}${taskCode}`

    const item = new ImportEntity({
      id: `${pk}${KEY_SEPARATOR}${sk}`,
      pk,
      sk,
      version: 0,
      code: taskCode,
      tenantCode: dto.tenantCode,
      type: 'CSV_MASTER_JOB',
      name: `CSV Import (from ZIP): ${dto.key.split('/').pop()}`,
      status: ImportStatusEnum.CREATED,
      // Store both the original DTO and the crucial task token
      attributes: {
        ...dto,
        taskToken,
      },
      source: `${sourceId.pk}${KEY_SEPARATOR}${sourceId.sk}`, // Link back to the parent ZIP job
      requestId: ulid(), // System-generated
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system', // This job is created by the system, not a direct user action
      updatedBy: 'system',
    })

    await this.dynamoDbService.putItem(this.tableName, item)
    return item
  }

  /**
   * Handles the 'DIRECT' execution strategy by fetching the CSV from S3
   * and processing its stream immediately.
   */
  private async _processCsvDirectly(
    dto: CreateCsvImportDto,
    options: ICommandOptions,
  ): Promise<ImportEntity[]> {
    this.logger.log(`Starting DIRECT CSV processing for key: ${dto.key}`)

    // 1. Fetch the S3 object stream
    const { Body: s3Stream } = await this.s3Service.client.send(
      new GetObjectCommand({
        Bucket: dto.bucket,
        Key: dto.key,
      }),
    )

    if (!(s3Stream instanceof Readable)) {
      throw new Error('Failed to get a readable stream from S3 object.')
    }

    // 2. Pass the stream to the centralized processor
    return this._processCsvStream(s3Stream, dto, options)
  }

  /**
   * Centralized logic to process a CSV stream. It reads each row, uses the
   * appropriate ImportStrategy to transform and validate, and creates a
   * temporary import record for each valid row.
   */
  private async _processCsvStream(
    stream: Readable,
    attributes: CreateCsvImportDto,
    options: ICommandOptions,
  ): Promise<ImportEntity[]> {
    const strategy = this.importStrategyMap.get(attributes.tableName)
    if (!strategy) {
      throw new Error(
        `No import strategy found for table: ${attributes.tableName}`,
      )
    }

    const processingPromises: Promise<ImportEntity | void>[] = []

    return new Promise((resolve, reject) => {
      const parser = csv({
        mapHeaders: ({ header }) => header.trim(),
        mapValues: ({ value }) => value.trim(),
      })

      stream
        .pipe(parser)
        .on('data', (row: Record<string, any>) => {
          const processRow = (async (): Promise<ImportEntity | void> => {
            try {
              const transformedData = await strategy.transform(row)
              await strategy.validate(transformedData)
              const createImportDto: CreateImportDto = {
                tableName: attributes.tableName,
                tenantCode: attributes.tenantCode,
                attributes: transformedData,
              }
              // Return the created entity
              return await this.createImport(createImportDto, options)
            } catch (error) {
              this.logger.warn(
                `Skipping CSV row due to error: ${error instanceof Error ? error.message : String(error)}`,
                { row },
              )
              return
            }
          })()
          processingPromises.push(processRow)
        })
        .on('end', async () => {
          // Wait for all row processing to complete before resolving
          const results = await Promise.all(processingPromises)
          const successfulImports = results.filter(
            (result): result is ImportEntity => !!result,
          )
          this.logger.log(
            `Finished CSV stream. Created ${successfulImports.length} import records.`,
          )
          resolve(successfulImports)
        })
        .on('error', (error: Error) => {
          this.logger.error('Error parsing CSV stream:', error)
          reject(error)
        })
    })
  }
  async updateStatus(
    key: DetailKey,
    status: string,
    payload?: { result?: any; error?: any },
    attributes?: { result?: any; error?: any },
    notifyId?: string,
  ) {
    await this.dynamoDbService.updateItem(this.tableName, key, {
      set: {
        status,
        attributes,
        result: payload?.result || payload?.error,
      },
    })

    // notification via SNS
    await this.snsService.publish<INotification>({
      action: 'import-status',
      ...key,
      table: this.tableName,
      id: notifyId || `${key.pk}#${key.sk}`,
      tenantCode: key.pk.substring(key.pk.indexOf('#') + 1),
      content: {
        status,
        attributes,
        result: payload?.result || payload?.error,
      },
    })
  }

  /**
   * Atomically increments the progress counters for a parent CSV job.
   * After incrementing, it checks if the job is complete and updates the
   * final status if necessary.
   * @param parentKey The key of the master CSV job entity.
   * @param childSucceeded True if the child job was successful, false otherwise.
   */
  async incrementParentJobCounters(
    parentKey: DetailKey,
    childSucceeded: boolean,
  ): Promise<ImportEntity> {
    this.logger.debug(
      `Incrementing counters for parent job (atomic workaround): ${parentKey.pk}#${parentKey.sk}`,
    )

    // 1. Define which counters to increment.
    const countersToIncrement: { [key: string]: number } = {
      processedRows: 1,
    }
    if (childSucceeded) {
      countersToIncrement.succeededRows = 1
    } else {
      countersToIncrement.failedRows = 1
    }

    // 2. Use the local helper to build the command parts.
    const {
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    } = this._buildAtomicCounterUpdateExpression(countersToIncrement)

    // 3. Manually create and send the UpdateItemCommand.
    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall(parentKey),
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues: marshall(ExpressionAttributeValues),
      ReturnValues: 'ALL_NEW',
    })

    const response = await this.dynamoDbService.client.send(command)
    const updatedEntity = unmarshall(response.Attributes) as ImportEntity

    // 4. Check if the job is complete (this logic remains the same).
    const { totalRows, processedRows, failedRows } = updatedEntity
    if (totalRows > 0 && processedRows >= totalRows) {
      this.logger.log(
        `Finalizing parent CSV job ${parentKey.pk}#${parentKey.sk}`,
      )
      const finalStatus =
        failedRows > 0 ? ImportStatusEnum.COMPLETED : ImportStatusEnum.COMPLETED

      await this.updateStatus(parentKey, finalStatus, {
        result: {
          message: 'All child jobs have been processed.',
          total: totalRows,
          succeeded: updatedEntity.succeededRows || 0,
          failed: failedRows || 0,
        },
      })
    }

    return updatedEntity
  }

  /**
   * A private helper to build a valid DynamoDB UpdateExpression for atomic counters.
   * @param counters A map of attribute names to the amount they should be incremented by.
   * @returns An object with the UpdateExpression and its necessary parameter maps.
   */
  private _buildAtomicCounterUpdateExpression(counters: {
    [key: string]: number
  }) {
    const setExpressions: string[] = []
    const expressionAttributeNames: { [key: string]: string } = {}
    const expressionAttributeValues: { [key: string]: any } = {}

    for (const key in counters) {
      const attrName = `#${key}`
      const startValuePlaceholder = `:${key}Start`
      const incValuePlaceholder = `:${key}Inc`

      setExpressions.push(
        `${attrName} = if_not_exists(${attrName}, ${startValuePlaceholder}) + ${incValuePlaceholder}`,
      )

      expressionAttributeNames[attrName] = key
      expressionAttributeValues[startValuePlaceholder] = 0 // Always start from 0 if the attribute is new.
      expressionAttributeValues[incValuePlaceholder] = counters[key] // The amount to increment by.
    }

    return {
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }
  }

  // add a generic update method for setting totalRows
  async updateImportJob(key: DetailKey, payload: DdbUpdateItem) {
    return this.dynamoDbService.updateItem(this.tableName, key, payload)
  }

  async publishAlarm(
    event: ImportQueueEvent,
    errorDetails: any,
  ): Promise<void> {
    this.logger.debug('event', event)
    const importKey = event.importEvent.importKey
    const tenantCode = importKey.pk.substring(
      importKey.pk.indexOf(KEY_SEPARATOR) + 1,
    )

    const alarm: INotification = {
      action: 'sfn-alarm',
      id: `${importKey.pk}#${importKey.sk}`,
      table: this.tableName,
      pk: importKey.pk,
      sk: importKey.sk,
      tenantCode,
      content: {
        errorMessage: errorDetails,
      },
    }

    this.logger.error('alarm:::', alarm)
    await this.snsService.publish<INotification>(alarm, this.alarmTopicArn)
  }

  async getImportByKey(key: DetailKey): Promise<ImportEntity> {
    const item = await this.dynamoDbService.getItem(this.tableName, key)
    if (!item) {
      throw new BadRequestException(
        `Import item not found for key: ${key.pk}#${key.sk}`,
      )
    }
    return new ImportEntity(item)
  }
}
