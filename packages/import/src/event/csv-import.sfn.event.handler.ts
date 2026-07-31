import { GetObjectCommand } from '@aws-sdk/client-s3'
import {
  EventHandler,
  IEventHandler,
  S3Service,
  SqsService,
} from '@mbc-cqrs-serverless/core'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Buffer } from 'buffer'
import { randomUUID } from 'crypto'
import csv from 'csv-parser'
import * as JSONStream from 'JSONStream'
import { Readable } from 'stream'

import {
  ACTION_CSV_BATCH_PROCESS,
  SQS_MAX_BATCH_SIZE,
  SQS_PAYLOAD_ENVELOPE_BYTES,
  SQS_SAFE_BODY_BYTES,
  SqsBatchPayload,
} from '../constant/sqs.constant'
import { CreateCsvImportDto } from '../dto/create-csv-import.dto'
import { ICsvRowImport } from '../dto/csv-import-row.interface'
import { ImportStatusEnum } from '../enum'
import { parseId } from '../helpers'
import { IMPORT_STRATEGY_MAP } from '../import.module-definition'
import { ImportService } from '../import.service'
import { IImportStrategy } from '../interface'
import {
  CsvBatchProcessingSummary,
  CsvFinalizeParentJobInput,
  CsvImportSfnEvent,
  SfnResultWriterDetails,
} from './csv-import.sfn.event'

@EventHandler(CsvImportSfnEvent)
export class CsvImportSfnEventHandler
  implements IEventHandler<CsvImportSfnEvent>
{
  private readonly logger: Logger = new Logger(CsvImportSfnEventHandler.name)

  constructor(
    private readonly importService: ImportService,
    @Inject(IMPORT_STRATEGY_MAP)
    private readonly importStrategyMap: Map<string, IImportStrategy<any, any>>,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
    private readonly sqsService: SqsService,
  ) {}

  async execute(event: CsvImportSfnEvent): Promise<any> {
    try {
      return await this.handleStepState(event)
    } catch (error) {
      this.logger.error('import step execution failed', error)
      throw error
    }
  }

  async handleStepState(event: CsvImportSfnEvent): Promise<any> {
    if (event.context.State.Name === 'csv_loader') {
      const input = event.input as CreateCsvImportDto
      const parentKey = parseId(input.sourceId)
      const totalRows = await this.countCsvRows(input)

      const updatedEntity = await this.importService.updateImportJob(
        parentKey,
        {
          set: { totalRows },
        },
      )

      if (updatedEntity.processedRows >= totalRows) {
        const finalStatus =
          updatedEntity.failedRows > 0
            ? ImportStatusEnum.FAILED
            : ImportStatusEnum.COMPLETED
        await this.importService.updateStatus(parentKey, finalStatus)
      }

      return this.loadCsv(input)
    }

    if (event.context.State.Name === 'finalize_parent_job') {
      return this.finalizeParentJob(
        event.input as CsvFinalizeParentJobInput,
        event.context.Execution.Input.sourceId as string,
      )
    }

    // --- ROW PARSER & SQS PACKER ---
    const input = event.input as ICsvRowImport
    const items = input.Items
    const attributes = input.BatchInput.Attributes

    const strategy = this.importStrategyMap.get(attributes.tableName)
    if (!strategy)
      throw new Error(
        `No import strategy found for table: ${attributes.tableName}`,
      )

    let succeededRows = 0
    let failedRows = 0

    let currentChunk: any[] = []
    let currentBytes = 2
    const sqsBatchEntries: any[] = []
    const messageItemCounts = new Map<string, number>()

    const packChunkToEntry = () => {
      if (currentChunk.length === 0) return

      const payload: SqsBatchPayload = {
        action: ACTION_CSV_BATCH_PROCESS,
        tableName: attributes.tableName,
        tenantCode: attributes.tenantCode,
        sourceId: attributes.sourceId,
        s3Key: attributes.key,
        items: currentChunk,
      }

      const messageId = randomUUID().replace(/-/g, '')
      sqsBatchEntries.push({
        Id: messageId,
        MessageBody: JSON.stringify(payload),
      })
      messageItemCounts.set(messageId, currentChunk.length)

      currentChunk = []
      currentBytes = 2
    }

    const sendBatchToSqs = async () => {
      if (sqsBatchEntries.length === 0) return

      const queueUrl = this.configService.get<string>('IMPORT_QUEUE_URL')
      if (!queueUrl) throw new Error('IMPORT_QUEUE_URL is not configured.')

      while (sqsBatchEntries.length > 0) {
        const batch = sqsBatchEntries.splice(0, SQS_MAX_BATCH_SIZE)
        const result = await this.sqsService.sendMessageBatch(queueUrl, batch)

        for (const success of result.Successful || []) {
          if (success.Id) {
            succeededRows += messageItemCounts.get(success.Id) || 0
            messageItemCounts.delete(success.Id)
          }
        }

        for (const failure of result.Failed || []) {
          if (failure.Id) {
            const lostRowCount = messageItemCounts.get(failure.Id) || 0
            failedRows += lostRowCount
            this.logger.error(
              `SQS send failed for message ${failure.Id}. Lost ${lostRowCount} rows. Reason: ${failure.Message}`,
            )
            messageItemCounts.delete(failure.Id)
          }
        }
      }
    }

    for (const [index, item] of items.entries()) {
      try {
        const transformedData = await strategy.transform(item)
        await strategy.validate(transformedData)

        const serialized = JSON.stringify(transformedData)
        const itemBytes = Buffer.byteLength(serialized, 'utf8')
        const separatorBytes = currentChunk.length > 0 ? 1 : 0

        if (itemBytes > SQS_SAFE_BODY_BYTES - SQS_PAYLOAD_ENVELOPE_BYTES) {
          this.logger.warn(
            `Row ${index + 1} exceeds SQS limits (${itemBytes} bytes). Skipping.`,
          )
          failedRows++
          continue
        }

        if (
          currentBytes +
            separatorBytes +
            itemBytes +
            SQS_PAYLOAD_ENVELOPE_BYTES >
          SQS_SAFE_BODY_BYTES
        ) {
          packChunkToEntry()
          await sendBatchToSqs()
        }

        currentChunk.push(transformedData)
        currentBytes += separatorBytes + itemBytes
      } catch (error) {
        this.logger.warn(`Row ${index + 1} failed transform/validate.`, {
          item,
          error: (error as Error).message,
        })
        failedRows++
      }
    }

    packChunkToEntry()
    await sendBatchToSqs()

    return {
      totalRows: items.length,
      succeededRows,
      failedRows,
    }
  }

  // Helper Methods
  // ----------------------------------------------------------------
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

  // Helper to safely read an S3 Stream into a JSON string
  private async streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
  }

  // Helper to fetch and parse S3 ResultWriter files
  private async getResultsFromS3Writer(
    details: SfnResultWriterDetails,
  ): Promise<CsvBatchProcessingSummary[]> {
    this.logger.debug(
      `Fetching ResultWriter manifest: s3://${details.Bucket}/${details.Key}`,
    )

    const manifestResponse = await this.s3Service.client.send(
      new GetObjectCommand({ Bucket: details.Bucket, Key: details.Key }),
    )
    const manifestStr = await this.streamToString(
      manifestResponse.Body as Readable,
    )
    const manifest = JSON.parse(manifestStr)

    const allBatchResults: CsvBatchProcessingSummary[] = []

    // ----------------------------------------------------------------
    // THE FIX: Combine both SUCCEEDED and FAILED files from the manifest
    // ----------------------------------------------------------------
    const filesToProcess = [
      ...(manifest.ResultFiles?.SUCCEEDED || []),
      ...(manifest.ResultFiles?.FAILED || []),
    ]

    for (const file of filesToProcess) {
      this.logger.debug(`Streaming large result file: ${file.Key}`)
      const fileResponse = await this.s3Service.client.send(
        new GetObjectCommand({ Bucket: details.Bucket, Key: file.Key }),
      )

      const readStream = fileResponse.Body as Readable
      const pipeline = readStream.pipe(JSONStream.parse('*'))

      await new Promise<void>((resolve, reject) => {
        pipeline.on('data', (value: any) => {
          if (value && value.Output) {
            // Scenario A: A normal successful iteration
            try {
              allBatchResults.push(JSON.parse(value.Output))
            } catch (e) {
              this.logger.error(
                'Failed to parse Step Functions Output string',
                e,
              )
            }
          } else if (value && value.Error) {
            // Scenario B: A crashed Map state iteration (e.g., Lambda Timeout)
            try {
              let rowCount = 0
              if (value.Input) {
                // The Step Function logs the raw Input payload when an iteration fails.
                // We parse it to find exactly how many items were in that doomed batch.
                const inputObj =
                  typeof value.Input === 'string'
                    ? JSON.parse(value.Input)
                    : value.Input
                rowCount = inputObj?.Items?.length || 0
              }
              this.logger.warn(
                `Found failed Map iteration with ${rowCount} rows. Error: ${value.Error}`,
              )

              allBatchResults.push({
                totalRows: rowCount,
                succeededRows: 0,
                failedRows: rowCount, // Count all rows in this iteration as failed
              })
            } catch (e) {
              this.logger.error(
                'Failed to parse Step Functions Input string for failed iteration',
                e,
              )
            }
          }
        })
        pipeline.on('end', () => resolve())
        pipeline.on('error', (error: Error) => reject(error))
      })
    }

    return allBatchResults
  }

  private async finalizeParentJob(
    input: CsvFinalizeParentJobInput,
    sourceId: string,
  ): Promise<void> {
    const parentKey = parseId(sourceId)

    // ----------------------------------------------------------------
    // FAIL-SAFE: Handle any Step Function Map State crashes
    // ----------------------------------------------------------------
    if (input.errorOutput) {
      const errorName = input.errorOutput.Error || 'UnknownError'
      const cause = input.errorOutput.Cause || 'No cause provided by AWS.'

      // Scenario A: The known "Empty CSV" edge case (Mark as COMPLETED)
      if (
        errorName === 'States.ItemReaderFailed' &&
        cause.includes('only CSV headers')
      ) {
        this.logger.log(
          `CSV file for ${parentKey.pk}#${parentKey.sk} contained only headers.`,
        )
        await this.importService.updateStatus(
          parentKey,
          ImportStatusEnum.COMPLETED,
          {
            result: {
              message: 'CSV file contains only headers. No data to process.',
              total: 0,
              succeeded: 0,
              failed: 0,
            },
          },
        )
        return
      }

      // Scenario B: Any other unexpected infrastructure/Step Function error (Mark as FAILED)
      this.logger.error(
        `Map state failed for ${parentKey.pk}#${parentKey.sk}. Error: ${errorName}`,
      )

      await this.importService.updateStatus(
        parentKey,
        ImportStatusEnum.FAILED,
        {
          error: {
            message: `Step Function execution failed: ${errorName}`,
            stack: cause,
          },
        },
      )

      // Because we used updateStatus(), your framework will automatically trigger the
      // DynamoDB stream -> ImportQueueEventHandler -> SingleImportProcessor logic,
      // which safely increments the ZIP parent job's 'failed' counter!
      return
    }

    // ----------------------------------------------------------------
    // NORMAL SUCCESSFUL FLOW (No errors)
    // ----------------------------------------------------------------
    let results: CsvBatchProcessingSummary[] = []

    if (input.mapOutput?.ResultWriterDetails) {
      results = await this.getResultsFromS3Writer(
        input.mapOutput.ResultWriterDetails,
      )
    } else if (input.processingResults) {
      const rawResults = input.processingResults
      results = Array.isArray(rawResults)
        ? Array.isArray(rawResults[0])
          ? rawResults[0]
          : rawResults
        : []
    }

    const finalSummary = results.reduce(
      (acc, batch) => {
        acc.totalRows += batch.totalRows
        acc.succeededRows += batch.succeededRows
        acc.failedRows += batch.failedRows
        return acc
      },
      { totalRows: 0, succeededRows: 0, failedRows: 0 },
    )

    let finalStatus = ImportStatusEnum.COMPLETED
    let finalMessage = 'All items successfully transformed and queued to SQS.'

    if (results.length === 0) {
      finalStatus = ImportStatusEnum.FAILED
      finalMessage = 'No batch processing results received.'
    } else if (finalSummary.failedRows > 0) {
      finalStatus = ImportStatusEnum.FAILED
    }

    await this.importService.updateStatus(parentKey, finalStatus, {
      result: {
        message: finalMessage,
        total: finalSummary.totalRows,
        succeeded: finalSummary.succeededRows,
        failed: finalSummary.failedRows,
      },
    })
  }
}
