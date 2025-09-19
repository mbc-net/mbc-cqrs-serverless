import { GetObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import {
  EventHandler,
  IEventHandler,
  S3Service,
  StepFunctionService,
} from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as JSZip from 'jszip'
import { Readable } from 'stream'

import { ZIP_IMPORT_PK_PREFIX } from '../constant'
import { CreateZipImportDto } from '../dto/create-zip-import.dto'
import { ImportStatusEnum } from '../enum'
import { ImportService } from '../import.service'
import { ImportQueueEvent } from './import.queue.event'

@EventHandler(ImportQueueEvent)
export class ZipImportQueueEventHandler
  implements IEventHandler<ImportQueueEvent>
{
  private readonly logger = new Logger(ZipImportQueueEventHandler.name)
  private readonly zipOrchestratorArn: string

  constructor(
    private readonly configService: ConfigService,
    private readonly sfnService: StepFunctionService,
    private readonly importService: ImportService,
    private readonly s3Service: S3Service,
  ) {
    this.zipOrchestratorArn = this.configService.get<string>(
      'SFN_IMPORT_ZIP_ORCHESTRATOR_ARN',
    )
  }

  async execute(event: ImportQueueEvent): Promise<any> {
    const importEntity = event.importEvent.importEntity

    if (!importEntity.pk.startsWith(ZIP_IMPORT_PK_PREFIX)) {
      return
    }

    const importKey = event.importEvent.importKey
    const zipJobAttributes = importEntity.attributes as CreateZipImportDto
    this.logger.log(
      `Received master ZIP job from queue: ${importEntity.id} for file ${zipJobAttributes.key}`,
    )

    try {
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.PROCESSING,
        { result: { step: 'Unzipping archive' } },
      )

      const s3ReadStream = await this.getS3Stream(zipJobAttributes)
      const extractedFileKeys = await this.unzipAndUpload(
        s3ReadStream,
        zipJobAttributes,
        importEntity.id,
      )

      if (extractedFileKeys.length === 0) {
        throw new Error('No CSV files found in the ZIP archive.')
      }

      // Sort the file keys alphabetically to ensure sequential processing order
      extractedFileKeys.sort()

      await this.importService.updateImportJob(importKey, {
        set: {
          attributes: {
            ...zipJobAttributes,
            extractedFileKeys, // Save the list of files to the master job
          },
        },
      })

      // Start the main orchestrator with the sorted list of files
      await this.sfnService.startExecution(
        this.zipOrchestratorArn,
        {
          masterJobKey: importKey,
          sortedS3Keys: extractedFileKeys,
          // Pass through original attributes needed by the sub-workflows
          parameters: {
            bucket: zipJobAttributes.bucket,
            tenantCode: zipJobAttributes.tenantCode,
          },
        },
        `${zipJobAttributes.tenantCode}-zip-import-${Date.now()}`,
      )

      this.logger.log(
        `Started ZIP Orchestrator Step Function for master job ${importEntity.id}`,
      )
    } catch (error) {
      this.logger.error(`Failed to process ZIP job ${importEntity.id}`, error)
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.FAILED,
        {
          error: {
            message: `Failed during unzip and preparation: ${
              (error as Error).message
            }`,
          },
        },
      )
      throw error
    }
  }

  private async getS3Stream(attributes: CreateZipImportDto): Promise<Readable> {
    const { Body: s3Stream } = await this.s3Service.client.send(
      new GetObjectCommand({
        Bucket: attributes.bucket,
        Key: attributes.key,
      }),
    )

    if (!(s3Stream instanceof Readable)) {
      throw new Error('Failed to get a readable stream from S3 object.')
    }
    return s3Stream
  }

  /**
   * Helper function to convert a Readable stream into a Buffer.
   * Required for yauzl, which operates on a complete data source.
   */
  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }

  /**
   * Re-implemented using the `jszip` library, which is more tolerant
   * of malformed ZIP archives.
   */
  private async unzipAndUpload(
    zipStream: Readable,
    attributes: CreateZipImportDto,
    jobId: string,
  ): Promise<string[]> {
    const tempS3Prefix = `unzipped/${attributes.tenantCode}/${jobId.replace(/[^a-zA-Z0-9]/g, '_')}`

    // 1. JSZip operates on a buffer, so we first load the stream into memory.
    const zipBuffer = await this.streamToBuffer(zipStream)

    // 2. Load the ZIP data.
    const zip = await JSZip.loadAsync(zipBuffer)

    const uploadPromises: Promise<any>[] = []
    const extractedFileKeys: string[] = []

    // 3. Loop through each file in the archive.
    for (const file of Object.values(zip.files)) {
      // 4. Skip directories and process only CSV files.
      if (!file.dir && file.name.toLowerCase().endsWith('.csv')) {
        this.logger.debug(`Extracting ${file.name} ...`)

        // 5. Decompress the file content into a buffer.
        const contentBuffer = await file.async('nodebuffer')

        const s3UploadKey = `${tempS3Prefix}/${file.name}`
        extractedFileKeys.push(s3UploadKey)

        // 6. Create and track the S3 upload promise.
        const upload = new Upload({
          client: this.s3Service.client,
          params: {
            Bucket: attributes.bucket,
            Key: s3UploadKey,
            Body: contentBuffer,
          },
        })

        uploadPromises.push(upload.done())
      }
    }

    // 7. Wait for all files to be uploaded to S3.
    await Promise.all(uploadPromises)

    this.logger.log(
      `Finished unzipping with JSZip. Uploaded ${extractedFileKeys.length} CSV files.`,
    )

    return extractedFileKeys
  }
}
