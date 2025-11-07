import {
  GetObjectCommand,
  GetObjectCommandInput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Service } from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

import { GenUploadFileDto } from './dto/upload-file.dto'

@Injectable()
export class DirectoryFileService {
  private readonly logger = new Logger(DirectoryFileService.name)
  private readonly s3Client: S3Client

  constructor(private readonly s3Service: S3Service) {
    this.s3Client = s3Service.client
  }

  async genViewUrl(key: string, filename?: string) {
    try {
      const getObjCmdInput: GetObjectCommandInput = {
        Bucket: this.s3Service.privateBucket,
        Key: key,
      }
      if (filename) {
        getObjCmdInput.ResponseContentDisposition = `inline; filename="${encodeURIComponent(
          filename,
        )}"`
      }
      const url = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand(getObjCmdInput),
        {
          expiresIn: 60 * 60, // 1 hour
        },
      )
      return { url }
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for view: ${error}`)
      throw new Error('Failed to generate presigned URL for view')
    }
  }

  async genUploadDirectoryUrl(dto: GenUploadFileDto) {
    try {
      const { tenant, path, filename } = dto
      const bucket = this.s3Service.privateBucket
      const key = `${tenant}/${process.env.NODE_ENV}/files/${path}/${filename}`
      const url = await getSignedUrl(
        this.s3Client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ACL: 'private',
        }),
        {
          expiresIn: 60 * 60, // 1 hour
        },
      )
      return {
        bucket,
        key,
        url,
      }
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for upload: ${error}`)
      throw new Error('Failed to generate presigned URL for upload')
    }
  }
}
