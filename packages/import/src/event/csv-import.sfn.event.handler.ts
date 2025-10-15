import { GetObjectCommand } from '@aws-sdk/client-s3'
import {
  EventHandler,
  extractInvokeContext,
  ICommandOptions,
  IEventHandler,
  S3Service,
} from '@mbc-cqrs-serverless/core'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import csv from 'csv-parser'
import { Readable } from 'stream'

import { CreateCsvImportDto } from '../dto/create-csv-import.dto'
import { CreateImportDto } from '../dto/create-import.dto'
import { ICsvRowImport } from '../dto/csv-import-row.interface'
import { ImportStatusEnum } from '../enum'
import { parseId } from '../helpers'
import { IMPORT_STRATEGY_MAP } from '../import.module-definition'
import { ImportService } from '../import.service'
import { IImportStrategy } from '../interface'
import { CsvImportSfnEvent } from './csv-import.sfn.event'

interface MapResultPayload {
  MapResult: any[]
}
@EventHandler(CsvImportSfnEvent)
export class CsvImportSfnEventHandler
  implements IEventHandler<CsvImportSfnEvent>
{
  private readonly logger: Logger = new Logger(CsvImportSfnEventHandler.name)
  private readonly alarmTopicArn: string

  constructor(
    private readonly importService: ImportService,
    @Inject(IMPORT_STRATEGY_MAP)
    private readonly importStrategyMap: Map<string, IImportStrategy<any, any>>,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    this.alarmTopicArn = this.configService.get<string>('SNS_ALARM_TOPIC_ARN')
  }

  async execute(event: CsvImportSfnEvent): Promise<any> {
    try {
      return await this.handleStepState(event)
    } catch (error) {
      this.logger.error('import step execution failed', error)
      throw error
    }
  }

  async handleStepState(event: CsvImportSfnEvent): Promise<any> {
    this.logger.debug('Processing event:::', JSON.stringify(event, null, 2))
    if (event.context.State.Name === 'csv_loader') {
      const input = event.input as CreateCsvImportDto

      // 1. Get the parent job's key from the sourceId
      const parentKey = parseId(input.sourceId)

      // 2. Count the total rows in the CSV
      this.logger.log(`Counting rows for file: ${input.key}`)
      const totalRows = await this.countCsvRows(input)
      this.logger.log(`Found ${totalRows} rows. Updating parent job.`)

      // 3. Update the parent job with the total count
      const updatedEntity = await this.importService.updateImportJob(
        parentKey,
        {
          set: { totalRows },
        },
      )

      if (updatedEntity.processedRows >= totalRows) {
        this.logger.log(
          `Job ${input.sourceId} already finished. Setting final status.`,
        )
        const finalStatus =
          updatedEntity.failedRows > 0
            ? ImportStatusEnum.COMPLETED
            : ImportStatusEnum.COMPLETED

        await this.importService.updateStatus(parentKey, finalStatus)
      }

      // 4. Proceed to load the first batch of rows as before
      return this.loadCsv(input)
    }

    if (event.context.State.Name === 'finalize_parent_job') {
      const finalizeEvent = event.input as CreateCsvImportDto & MapResultPayload
      return this.finalizeParentJob(finalizeEvent)
    }

    const input = event.input as ICsvRowImport
    const items = input.Items
    const attributes = input.BatchInput.Attributes
    const createImportDtos: CreateImportDto[] = []

    const strategy = this.importStrategyMap.get(attributes.tableName)
    if (!strategy) {
      throw new Error(
        `No import strategy found for table: ${attributes.tableName}`,
      )
    }

    for (const [index, item] of items.entries()) {
      try {
        const transformedData = await strategy.transform(item)
        await strategy.validate(transformedData)
        const createImport: CreateImportDto = {
          tableName: attributes.tableName,
          tenantCode: attributes.tenantCode,
          attributes: transformedData,
          sourceId: attributes.sourceId,
        }
        createImportDtos.push(createImport)
      } catch (error) {
        this.logger.warn(`Row ${index + 1} failed mapping.`, { item, error })
        throw error
      }
    }

    const invokeContext = extractInvokeContext()
    const options: ICommandOptions = {
      invokeContext,
    }
    if (createImportDtos.length > 0) {
      const importPromises = createImportDtos.map((dto) =>
        this.importService.createImport(dto, options),
      )
      await Promise.all(importPromises)
    }
  }

  private async loadCsv(
    input: CreateCsvImportDto,
    limit = 10,
  ): Promise<ICsvRowImport> {
    // 1. Fetch the S3 object stream
    const { Body: s3Stream } = await this.s3Service.client.send(
      new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
      }),
    )

    if (!(s3Stream instanceof Readable)) {
      // This handles cases where the Body might not be a stream (e.g., error or empty object)
      throw new Error('Failed to get a readable stream from S3 object.')
    }

    // 2. Wrap the stream processing in a Promise for async/await compatibility
    return new Promise((resolve, reject) => {
      const items: Record<string, any>[] = []

      const parser = csv({
        mapHeaders: ({ header }) => header.trim(),
        mapValues: ({ value }) => value.trim(),
      })

      const streamPipeline = s3Stream.pipe(parser)

      streamPipeline
        .on('data', (row: Record<string, any>) => {
          // Only push items until the limit is reached
          if (items.length < limit) {
            items.push(row)
          } else {
            // 3. Efficiently destroy the stream once the limit is met.
            // This stops reading the file from S3 and parsing, saving resources.
            streamPipeline.destroy()
            this.logger.debug(
              `Limit of ${limit} rows reached. Destroying stream.`,
            )
            resolve({
              BatchInput: {
                Attributes: input,
              },
              Items: items,
            })
          }
        })
        .on('end', () => {
          // This 'end' event will only be reached if the file has fewer rows than the limit.
          this.logger.debug(`CSV parsing finished. Found ${items.length} rows.`)
          resolve({
            BatchInput: {
              Attributes: input,
            },
            Items: items,
          })
        })
        .on('error', (error: Error) => {
          // Handle any errors during streaming or parsing
          this.logger.error('Error parsing CSV stream:', error)
          reject(error)
        })
    })
  }

  private async countCsvRows(input: CreateCsvImportDto): Promise<number> {
    const { Body: s3Stream } = await this.s3Service.client.send(
      new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
    )

    if (!(s3Stream instanceof Readable)) {
      throw new Error('Failed to get a readable stream from S3 object.')
    }

    return new Promise((resolve, reject) => {
      let count = 0
      const parser = csv()

      s3Stream
        .pipe(parser)
        .on('data', () => count++)
        .on('end', () => resolve(count))
        .on('error', (error) => reject(error))
    })
  }

  private async finalizeParentJob(
    event: CreateCsvImportDto & MapResultPayload,
  ): Promise<void> {
    const parentKey = parseId(event.sourceId)
    const totalRows = event.MapResult.length

    this.logger.log(
      `Setting totalRows=${totalRows} for parent job ${event.sourceId}.`,
    )

    const updatedEntity = await this.importService.updateImportJob(parentKey, {
      set: { totalRows },
    })

    const { processedRows, failedRows } = updatedEntity
    if (totalRows > 0 && processedRows >= totalRows) {
      this.logger.log(
        `Finalizing parent CSV job ${parentKey.pk}#${parentKey.sk}`,
      )
      const finalStatus =
        failedRows > 0 ? ImportStatusEnum.COMPLETED : ImportStatusEnum.COMPLETED

      await this.importService.updateStatus(parentKey, finalStatus, {
        result: {
          message: 'All child jobs have been processed.',
          total: totalRows,
          succeeded: updatedEntity.succeededRows || 0,
          failed: failedRows || 0,
        },
      })
    }
  }
}
