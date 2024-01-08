import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const CLIENT_INSTANCE = Symbol()

@Injectable()
export class S3Service {
  private [CLIENT_INSTANCE]: S3Client

  constructor(private readonly config: ConfigService) {
    this[CLIENT_INSTANCE] = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION'),
      forcePathStyle: true,
    })
  }

  get client(): S3Client {
    return this[CLIENT_INSTANCE]
  }

  putItem(key: string, item: any): Promise<any> {
    return this.client.send(
      new PutObjectCommand({
        Bucket: this.config.get<string>('S3_BUCKET_NAME'),
        Key: key,
        Body: JSON.stringify(item),
      }),
    )
  }

  async getItem(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.get<string>('S3_BUCKET_NAME'),
        Key: key,
      }),
    )

    const body = await result.Body.transformToString()

    return JSON.parse(body)
  }
}
