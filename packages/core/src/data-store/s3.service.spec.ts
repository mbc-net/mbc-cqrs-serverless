import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createMock } from '@golevelup/ts-jest'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { sdkStreamMixin } from '@smithy/util-stream'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'
import { Readable } from 'stream'
import { S3Service } from '../data-store'

const keys = {
  S3_BUCKET_NAME: 'bucket_name',
}

describe('DynamoDbService', () => {
  let s3Service: S3Service
  const s3Mock = mockClient(S3Client)

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>({
            get: (key) => keys[key] ?? 'default',
          }),
        },
      ],
    }).compile()
    s3Service = moduleRef.get<S3Service>(S3Service)
  })

  afterEach(() => {
    jest.clearAllMocks()
    s3Mock.reset()
  })

  describe('get', () => {
    it('should return the dynamodb client', () => {
      expect(s3Service.client).toBeDefined()
      expect(s3Service.client).toBeInstanceOf(S3Client)
    })
  })

  describe('getItem', () => {
    it('should retrieve data from s3 and return it', async () => {
      // Arrange
      const data = { key: 'stream data' }
      const stream = new Readable()
      stream.push(JSON.stringify(data))
      stream.push(null) // end of stream
      const sdkStream = sdkStreamMixin(stream)
      s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream })

      // Action
      const result = await s3Service.getItem('object-key')

      // Assert
      expect(s3Mock).toHaveReceivedCommand(GetObjectCommand)
      expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
        Bucket: expect.any(String),
        Key: 'object-key',
      })
      expect(result).toEqual(data)
    })
  })

  describe('putItem', () => {
    it('should upload data to s3', async () => {
      // Arrange
      const data = { key: 'stream data' }

      s3Mock.on(PutObjectCommand).resolves({})

      // Action
      const result = await s3Service.putItem('object-key', data)

      // Assert
      expect(s3Mock).toHaveReceivedCommand(PutObjectCommand)
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: expect.any(String),
        Key: 'object-key',
        Body: JSON.stringify(data),
      })
      expect(result).toEqual({
        Bucket: 'bucket_name',
        Key: 'object-key',
      })
    })
  })
})
