import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { Test } from '@nestjs/testing'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'
import { DynamoDbService, S3Service } from '../data-store'
import { createMock } from '@golevelup/ts-jest'
import { ConfigService } from '@nestjs/config'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { sdkStreamMixin } from '@smithy/util-stream'
import { Readable } from 'stream'
import { ulid } from 'ulid'
import { toISOStringWithTimezone } from '../helpers'

const keys = {
  NODE_ENV: 'env',
  APP_NAME: 'app_name',
  ATTRIBUTE_LIMIT_SIZE: 16, // byte
}

describe('DynamoDbService', () => {
  let dynamoDbService: DynamoDbService
  const dynamoDBMock = mockClient(DynamoDBClient)
  const s3Mock = mockClient(S3Client)

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DynamoDbService,
        S3Service,
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>({
            get: jest.fn((key) => {
              return keys[key] ?? 'default'
            }),
          }),
        },
      ],
    }).compile()
    dynamoDbService = moduleRef.get<DynamoDbService>(DynamoDbService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    dynamoDBMock.reset()
    s3Mock.reset()
  })

  describe('get', () => {
    it('should return the dynamodb client', () => {
      expect(dynamoDbService.client).toBeDefined()
      expect(dynamoDbService.client).toBeInstanceOf(DynamoDBClient)
    })
  })

  describe('putItem', () => {
    it('should send PutItemCommand with the origin data', async () => {
      // Arrange
      const item = { pk: 'master', sk: 'test', attributes: { key: 'value' } }

      // Action
      await dynamoDbService.putItem('table_name', item)

      // Assert

      expect(dynamoDBMock).toHaveReceivedCommandWith(PutItemCommand, {
        TableName: 'table_name',
        Item: {
          attributes: { M: { key: { S: 'value' } } },
          pk: { S: 'master' },
          sk: { S: 'test' },
        },
      })
    })

    it('should send a PutItemCommand with the data and store the attribute in S3', async () => {
      // Arrange
      const item = {
        pk: 'master',
        sk: 'test',
        attributes: { key: 'long-value', otherKey: 'long-value' },
      }

      // Action
      await dynamoDbService.putItem('table_name', item)

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommandWith(PutItemCommand, {
        TableName: 'table_name',
        Item: {
          attributes: {
            S: expect.stringMatching(
              /(s3:\/\/default\/ddb\/table_name\/master\/test\/)[^/]+(.json)/,
            ),
          },
          pk: { S: 'master' },
          sk: { S: 'test' },
        },
      })
    })
  })

  describe('getItem', () => {
    it('should send GetItemCommand', async () => {
      // Arrange
      dynamoDBMock.on(GetItemCommand).resolves({ Item: {} })
      const key = { pk: 'master', sk: 'test' }
      // Action
      await dynamoDbService.getItem('table_name', key)
      // Assert
      expect(dynamoDBMock).toHaveReceivedCommand(GetItemCommand)
    })

    it('should return the data', async () => {
      // Arrange
      dynamoDBMock.on(GetItemCommand).resolves({
        Item: {
          attributes: { M: { key: { S: 'value' } } },
          pk: { S: 'master' },
          sk: { S: 'test' },
        },
      })
      const key = { pk: 'master', sk: 'test' }
      // Action
      const result = await dynamoDbService.getItem('table_name', key)
      // Assert
      expect(result).toEqual({
        attributes: { key: 'value' },
        pk: 'master',
        sk: 'test',
      })
    })

    it('should get the attribute data from s3 and return the data', async () => {
      // Arrange
      dynamoDBMock.on(GetItemCommand).resolves({
        Item: {
          pk: { S: 'master' },
          sk: { S: 'test' },
          attributes: {
            S: `s3://default/ddb/table_name/master/test/${ulid()}.json`,
          },
        },
      })
      const stream = new Readable()
      stream.push(JSON.stringify({ key: 'long-value', otherKey: 'long-value' }))
      stream.push(null) // end of stream
      const sdkStream = sdkStreamMixin(stream)
      s3Mock.on(GetObjectCommand).resolves({ Body: sdkStream })
      const key = { pk: 'master', sk: 'test' }

      // Action
      const result = await dynamoDbService.getItem('table_name', key)

      // Assert
      expect(result).toEqual({
        attributes: { key: 'long-value', otherKey: 'long-value' },
        pk: 'master',
        sk: 'test',
      })
    })
  })

  describe('updateItem', () => {
    it('should return updated attributes', async () => {
      // Arrange
      const key = { pk: 'master', sk: 'test' }
      const updatedAt = new Date().toISOString()
      dynamoDBMock.on(UpdateItemCommand).resolves({
        Attributes: {
          attributes: {
            M: {
              key: {
                S: 'update',
              },
            },
          },
        },
      })

      // Action
      const result = await dynamoDbService.updateItem('table_name', key, {
        set: { attributes: { key: 'update' } },
      })

      // Assert
      expect(result).toEqual({
        attributes: { key: 'update' },
      })
    })

    it('should send UpdateItemCommand', async () => {
      // Arrange
      const key = { pk: 'master', sk: 'test' }
      dynamoDBMock.on(UpdateItemCommand).resolves({
        Attributes: {
          attributes: {
            M: {
              key: {
                S: 'update',
              },
            },
          },
        },
      })

      // Action
      await dynamoDbService.updateItem('table_name', key, {
        set: { attributes: { key: 'update' } },
      })

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommand(UpdateItemCommand)
      expect(dynamoDBMock).toReceiveCommandWith(UpdateItemCommand, {
        TableName: 'table_name',
        Key: {
          pk: { S: 'master' },
          sk: { S: 'test' },
        },
        UpdateExpression: ' SET #attributes=:attributes, #updatedAt=:updatedAt',
      })
    })
  })

  describe('listItemsByPk', () => {
    it('should return data', async () => {
      // Arrange
      dynamoDBMock.on(QueryCommand).resolves({
        Items: [
          {
            attributes: { M: { key: { S: 'value' } } },
            pk: { S: 'master' },
            sk: { S: 'test' },
          },
        ],
      })

      // Action
      const result = await dynamoDbService.listItemsByPk('table_name', 'master')

      // Assert
      expect(result).toEqual({
        lastKey: undefined,
        items: [{ attributes: { key: 'value' }, pk: 'master', sk: 'test' }],
      })
    })

    it('should send QueryCommand', async () => {
      // Arrange
      dynamoDBMock.on(QueryCommand).resolves({
        Items: [
          {
            attributes: { M: { key: { S: 'value' } } },
            pk: { S: 'master' },
            sk: { S: 'test' },
          },
        ],
      })

      // Action
      await dynamoDbService.listItemsByPk('table_name', 'master')

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommand(QueryCommand)
      expect(dynamoDBMock).toReceiveCommandWith(QueryCommand, {
        TableName: 'table_name',
      })
    })
  })

  describe('listAllItems', () => {
    it('should return data', async () => {
      // Arrange
      dynamoDBMock.on(ScanCommand).resolves({
        Items: [
          {
            attributes: { M: { key: { S: 'value' } } },
            pk: { S: 'master' },
            sk: { S: 'test' },
          },
        ],
      })

      // Action
      const result = await dynamoDbService.listAllItems('table_name')

      // Assert
      expect(result).toEqual({
        lastKey: undefined,
        items: [{ attributes: { key: 'value' }, pk: 'master', sk: 'test' }],
      })
    })

    it('should send ScanCommand', async () => {
      // Arrange
      dynamoDBMock.on(ScanCommand).resolves({
        Items: [
          {
            attributes: { M: { key: { S: 'value' } } },
            pk: { S: 'master' },
            sk: { S: 'test' },
          },
        ],
      })

      // Action
      await dynamoDbService.listAllItems('table_name')

      // Assert
      expect(dynamoDBMock).toHaveReceivedCommand(ScanCommand)
      expect(dynamoDBMock).toReceiveCommandWith(ScanCommand, {
        TableName: 'table_name',
      })
    })
  })
})
