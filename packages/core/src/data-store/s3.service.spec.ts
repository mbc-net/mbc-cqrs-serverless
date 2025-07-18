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

  /**
   * Test Overview: Tests error handling scenarios for S3 service operations
   * Purpose: Ensures the service properly handles and recovers from various S3 operation failures
   * Details: Verifies error handling for network failures, access denied, bucket not found, and other AWS S3 errors
   */
  describe('Error Handling Scenarios', () => {
    describe('getItem - Error Cases', () => {
      it('should handle S3 access denied errors', async () => {
        const accessError = new Error('Access Denied')
        accessError.name = 'AccessDenied'
        s3Mock.on(GetObjectCommand).rejects(accessError)

        await expect(s3Service.getItem('restricted-key')).rejects.toThrow('Access Denied')
        expect(s3Mock).toHaveReceivedCommand(GetObjectCommand)
      })

      it('should handle S3 bucket not found errors', async () => {
        const bucketError = new Error('The specified bucket does not exist')
        bucketError.name = 'NoSuchBucket'
        s3Mock.on(GetObjectCommand).rejects(bucketError)

        await expect(s3Service.getItem('any-key')).rejects.toThrow('The specified bucket does not exist')
      })

      it('should handle S3 object not found errors', async () => {
        const notFoundError = new Error('The specified key does not exist')
        notFoundError.name = 'NoSuchKey'
        s3Mock.on(GetObjectCommand).rejects(notFoundError)

        await expect(s3Service.getItem('non-existent-key')).rejects.toThrow('The specified key does not exist')
      })

      it('should handle network timeout errors', async () => {
        const timeoutError = new Error('Request timeout')
        timeoutError.name = 'TimeoutError'
        s3Mock.on(GetObjectCommand).rejects(timeoutError)

        await expect(s3Service.getItem('timeout-key')).rejects.toThrow('Request timeout')
      })

      it('should handle malformed JSON data from S3', async () => {
        const invalidJsonStream = new Readable()
        invalidJsonStream.push('{ invalid json }')
        invalidJsonStream.push(null)
        const sdkStream = sdkStreamMixin(invalidJsonStream)
        s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream })

        await expect(s3Service.getItem('invalid-json-key')).rejects.toThrow()
      })

      it('should handle empty stream from S3', async () => {
        const emptyStream = new Readable()
        emptyStream.push(null)
        const sdkStream = sdkStreamMixin(emptyStream)
        s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream })

        await expect(s3Service.getItem('empty-key')).rejects.toThrow()
      })
    })

    describe('putItem - Error Cases', () => {
      it('should handle S3 upload access denied errors', async () => {
        const accessError = new Error('Access Denied for upload')
        accessError.name = 'AccessDenied'
        s3Mock.on(PutObjectCommand).rejects(accessError)

        const data = { test: 'data' }
        await expect(s3Service.putItem('restricted-upload-key', data)).rejects.toThrow('Access Denied for upload')
      })

      it('should handle S3 storage quota exceeded errors', async () => {
        const quotaError = new Error('Storage quota exceeded')
        quotaError.name = 'QuotaExceeded'
        s3Mock.on(PutObjectCommand).rejects(quotaError)

        const data = { large: 'data' }
        await expect(s3Service.putItem('quota-key', data)).rejects.toThrow('Storage quota exceeded')
      })

      it('should handle network errors during upload', async () => {
        const networkError = new Error('Network error')
        networkError.name = 'NetworkingError'
        s3Mock.on(PutObjectCommand).rejects(networkError)

        const data = { network: 'test' }
        await expect(s3Service.putItem('network-key', data)).rejects.toThrow('Network error')
      })
    })
  })

  /**
   * Test Overview: Tests edge cases for S3 service operations with various data types and sizes
   * Purpose: Ensures the service handles boundary conditions and different data scenarios properly
   * Details: Verifies behavior with large payloads, special characters, null values, and complex objects
   */
  describe('Edge Cases', () => {
    describe('getItem - Data Variations', () => {
      it('should handle large JSON objects from S3', async () => {
        const largeData = {
          items: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: 'A'.repeat(100)
          }))
        }
        const stream = new Readable()
        stream.push(JSON.stringify(largeData))
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream })

        const result = await s3Service.getItem('large-object-key')
        expect(result).toEqual(largeData)
        expect(result.items).toHaveLength(1000)
      })

      it('should handle objects with special characters', async () => {
        const specialData = {
          unicode: '🚀 Unicode test ñáéíóú',
          special: 'Special chars: !@#$%^&*()',
          newlines: 'Line 1\nLine 2\rLine 3',
          quotes: 'Single \' and double " quotes'
        }
        const stream = new Readable()
        stream.push(JSON.stringify(specialData))
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream })

        const result = await s3Service.getItem('special-chars-key')
        expect(result).toEqual(specialData)
      })

      it('should handle nested complex objects', async () => {
        const complexData = {
          level1: {
            level2: {
              level3: {
                array: [1, 2, { nested: true }],
                nullValue: null,
                boolValue: false,
                numberValue: 42.5
              }
            }
          }
        }
        const stream = new Readable()
        stream.push(JSON.stringify(complexData))
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream })

        const result = await s3Service.getItem('complex-object-key')
        expect(result).toEqual(complexData)
      })
    })

    describe('putItem - Data Variations', () => {
      it('should handle uploading null and undefined values', async () => {
        s3Mock.on(PutObjectCommand).resolves({})

        const dataWithNulls = {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zeroValue: 0,
          falseValue: false
        }

        const result = await s3Service.putItem('null-values-key', dataWithNulls)
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: expect.any(String),
          Key: 'null-values-key',
          Body: JSON.stringify(dataWithNulls)
        })
        expect(result.Key).toBe('null-values-key')
      })

      it('should handle uploading arrays and complex structures', async () => {
        s3Mock.on(PutObjectCommand).resolves({})

        const complexArray = [
          { id: 1, items: [1, 2, 3] },
          { id: 2, items: ['a', 'b', 'c'] },
          { id: 3, nested: { deep: { value: 'test' } } }
        ]

        const result = await s3Service.putItem('complex-array-key', complexArray)
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: expect.any(String),
          Key: 'complex-array-key',
          Body: JSON.stringify(complexArray)
        })
        expect(result.Key).toBe('complex-array-key')
      })

      it('should handle uploading empty objects and arrays', async () => {
        s3Mock.on(PutObjectCommand).resolves({})

        const emptyData = {
          emptyObject: {},
          emptyArray: [],
          emptyString: ''
        }

        const result = await s3Service.putItem('empty-data-key', emptyData)
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: expect.any(String),
          Key: 'empty-data-key',
          Body: JSON.stringify(emptyData)
        })
        expect(result.Key).toBe('empty-data-key')
      })
    })
  })

  /**
   * Test Overview: Tests concurrent operations and race conditions for S3 service
   * Purpose: Ensures the service handles multiple simultaneous operations correctly
   * Details: Verifies behavior during concurrent reads, writes, and mixed operations
   */
  describe('Concurrent Operations', () => {
    it('should handle concurrent getItem operations', async () => {
      const testData = { concurrent: 'test' }
      
      s3Mock.on(GetObjectCommand).callsFake(() => {
        const stream = new Readable()
        stream.push(JSON.stringify(testData))
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        return Promise.resolve({ Body: sdkStream })
      })

      const promises = Array.from({ length: 5 }, (_, i) => 
        s3Service.getItem(`concurrent-key-${i}`)
      )

      const results = await Promise.all(promises)
      results.forEach(result => {
        expect(result).toEqual(testData)
      })
      expect(s3Mock).toHaveReceivedCommandTimes(GetObjectCommand, 5)
    })

    it('should handle concurrent putItem operations', async () => {
      s3Mock.on(PutObjectCommand).resolves({})

      const promises = Array.from({ length: 3 }, (_, i) => 
        s3Service.putItem(`concurrent-upload-${i}`, { index: i })
      )

      const results = await Promise.all(promises)
      results.forEach((result, index) => {
        expect(result.Key).toBe(`concurrent-upload-${index}`)
      })
      expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 3)
    })

    it('should handle mixed concurrent read and write operations', async () => {
      const readData = { read: 'data' }
      
      s3Mock.on(GetObjectCommand).callsFake(() => {
        const stream = new Readable()
        stream.push(JSON.stringify(readData))
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        return Promise.resolve({ Body: sdkStream })
      })
      s3Mock.on(PutObjectCommand).resolves({})

      const readPromises = Array.from({ length: 2 }, (_, i) => 
        s3Service.getItem(`read-key-${i}`)
      )
      const writePromises = Array.from({ length: 2 }, (_, i) => 
        s3Service.putItem(`write-key-${i}`, { write: i })
      )

      const [readResults, writeResults] = await Promise.all([
        Promise.all(readPromises),
        Promise.all(writePromises)
      ])

      readResults.forEach(result => {
        expect(result).toEqual(readData)
      })
      writeResults.forEach((result, index) => {
        expect(result.Key).toBe(`write-key-${index}`)
      })
    })
  })
})
