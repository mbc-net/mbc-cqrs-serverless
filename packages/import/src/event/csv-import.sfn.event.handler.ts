import { GetObjectCommand } from '@aws-sdk/client-s3'
import {
  CommandInputModel,
  CommandPartialInputModel,
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

import { ImportPublishMode } from '../constant/import-publish'
import { CreateCsvImportDto } from '../dto/create-csv-import.dto'
import { ICsvRowImport } from '../dto/csv-import-row.interface'
import { ComparisonStatus, ImportStatusEnum } from '../enum'
import { parseId } from '../helpers'
import {
  IMPORT_STRATEGY_MAP,
  PROCESS_STRATEGY_MAP,
  PUBLISH_MODE_MAP,
} from '../import.module-definition'
import { ImportService } from '../import.service'
import { IImportStrategy, IProcessStrategy } from '../interface'
import {
  CsvBatchProcessingSummary,
  CsvFinalizeParentJobInput,
  CsvImportSfnEvent,
} from './csv-import.sfn.event'

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
    @Inject(PROCESS_STRATEGY_MAP)
    private readonly processStrategyMap: Map<
      string,
      IProcessStrategy<any, any>
    >,
    @Inject(PUBLISH_MODE_MAP)
    private readonly publishModeMap: Map<string, ImportPublishMode>,
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
      this.logger.debug(`Counting rows for file: ${input.key}`)
      const totalRows = await this.countCsvRows(input)
      this.logger.debug(`Found ${totalRows} rows. Updating parent job.`)

      // 3. Update the parent job with the total count
      const updatedEntity = await this.importService.updateImportJob(
        parentKey,
        {
          set: { totalRows },
        },
      )

      if (updatedEntity.processedRows >= totalRows) {
        this.logger.debug(
          `Job ${input.sourceId} already finished. Setting final status.`,
        )
        // Set status to FAILED if any child job failed, otherwise COMPLETED
        // 子ジョブが1つでも失敗していればFAILED、そうでなければCOMPLETED
        const finalStatus =
          updatedEntity.failedRows > 0
            ? ImportStatusEnum.FAILED
            : ImportStatusEnum.COMPLETED

        await this.importService.updateStatus(parentKey, finalStatus)
      }

      // 4. Proceed to load the first batch of rows as before
      return this.loadCsv(input)
    }

    if (event.context.State.Name === 'finalize_parent_job') {
      return this.finalizeParentJob(
        event.input as CsvFinalizeParentJobInput,
        event.context.Execution.Input.sourceId as string,
      )
    }

    const input = event.input as ICsvRowImport
    const items = input.Items
    const attributes = input.BatchInput.Attributes

    const importStrategy = this.importStrategyMap.get(attributes.tableName)
    const processStrategy = this.processStrategyMap.get(attributes.tableName)
    const publishMode =
      this.publishModeMap.get(attributes.tableName) ?? ImportPublishMode.ASYNC

    if (!importStrategy || !processStrategy) {
      throw new Error(`Strategies not found for table: ${attributes.tableName}`)
    }

    let succeededRows = 0
    let failedRows = 0

    // CommandService publish* requires ICommandOptions.invokeContext; extract from this Lambda invocation.
    const invokeContext = extractInvokeContext()
    const options: ICommandOptions = {
      invokeContext,
      source: 'CSV_BATCH_PROCESSOR',
    }
    const commandService = processStrategy.getCommandService()

    // Rows run sequentially; SYNC awaits publishSync per row (see ImportPublishMode).
    for (const [index, item] of items.entries()) {
      try {
        // 1. Transform & Validate
        const transformedData = await importStrategy.transform(item)
        await importStrategy.validate(transformedData)

        // 2. Compare against existing data
        const compareResult = await processStrategy.compare(
          { ...transformedData, __s3Key: input.BatchInput.Attributes.key },
          attributes.tenantCode,
        )

        if (compareResult.status === ComparisonStatus.EQUAL) {
          succeededRows++
          continue // Skip identical data
        }

        // 3. Map to Command Input
        const mappedData = await processStrategy.map(
          compareResult.status,
          { ...transformedData, __s3Key: input.BatchInput.Attributes.key },
          attributes.tenantCode,
          compareResult.existingData,
        )

        // 4. Publish to CommandService
        if (compareResult.status === ComparisonStatus.NOT_EXIST) {
          if (publishMode === ImportPublishMode.SYNC) {
            await commandService.publishSync(
              mappedData as CommandInputModel,
              options,
            )
          } else {
            await commandService.publishAsync(
              mappedData as CommandInputModel,
              options,
            )
          }
        } else {
          if (publishMode === ImportPublishMode.SYNC) {
            await commandService.publishPartialUpdateSync(
              mappedData as CommandPartialInputModel,
              options,
            )
          } else {
            await commandService.publishPartialUpdateAsync(
              mappedData as CommandPartialInputModel,
              options,
            )
          }
        }

        succeededRows++
      } catch (error) {
        this.logger.warn(`Row ${index + 1} failed processing.`, {
          item,
          errorMessage: (error as Error).message,
          stack: (error as Error).stack,
        })
        failedRows++
      }
    }

    // Return the summary for Step Functions aggregation
    return {
      totalRows: items.length,
      succeededRows,
      failedRows,
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

  /**
   * Normalizes Step Functions payloads: Map merges `processingResults`, or
   * legacy shape stores the batch array at index 0.
   */
  private resolveFinalizeProcessingResults(
    input: CsvFinalizeParentJobInput,
  ): readonly CsvBatchProcessingSummary[] {
    if (this.isCsvFinalizeNestedBatchArray(input)) {
      const first = input[0]
      return Array.isArray(first) ? first : []
    }
    return input.processingResults ?? []
  }

  private isCsvFinalizeNestedBatchArray(
    input: CsvFinalizeParentJobInput,
  ): input is readonly CsvBatchProcessingSummary[][] {
    return Array.isArray(input)
  }

  private async finalizeParentJob(
    input: CsvFinalizeParentJobInput,
    sourceId: string,
  ): Promise<void> {
    const parentKey = parseId(sourceId)
    const results = this.resolveFinalizeProcessingResults(input)

    if (results.length === 0) {
      this.logger.warn(
        `No batch results found for parent job ${sourceId}. Marking as FAILED.`,
      )
      await this.importService.updateStatus(parentKey, ImportStatusEnum.FAILED, {
        result: { message: 'No batch processing results received.' },
      })
      return
    }

    // Sum up the output of all Map / Lambda batches
    const finalSummary = results.reduce(
      (acc, batch: CsvBatchProcessingSummary) => {
        acc.totalRows += batch.totalRows
        acc.succeededRows += batch.succeededRows
        acc.failedRows += batch.failedRows
        return acc
      },
      { totalRows: 0, succeededRows: 0, failedRows: 0 },
    )

    this.logger.log(
      `Finalizing parent CSV job ${parentKey.pk}#${parentKey.sk}`,
      finalSummary,
    )

    const finalStatus =
      finalSummary.failedRows > 0
        ? ImportStatusEnum.FAILED
        : ImportStatusEnum.COMPLETED

    await this.importService.updateStatus(parentKey, finalStatus, {
      result: {
        message: 'All batches have been processed.',
        total: finalSummary.totalRows,
        succeeded: finalSummary.succeededRows,
        failed: finalSummary.failedRows,
      },
    })
  }
}
