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
  private readonly [CLIENT_INSTANCE]: S3Client
  public readonly privateBucket: string

  constructor(private readonly config: ConfigService) {
    this[CLIENT_INSTANCE] = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION'),
      forcePathStyle: true,
    })
    this.privateBucket = config.get<string>('S3_BUCKET_NAME')
  }

  get client(): S3Client {
    return this[CLIENT_INSTANCE]
  }

  async putItem(key: string, item: any) {
    const ret = {
      Bucket: this.privateBucket,
      Key: key,
    }
    await this.client.send(
      new PutObjectCommand({
        ...ret,
        Body: JSON.stringify(item),
      }),
    )

    return ret
  }

  async getItem(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.privateBucket,
        Key: key,
      }),
    )

    const body = await result.Body.transformToString()

    return JSON.parse(body)
  }
}
