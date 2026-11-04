import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  PutItemCommand,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb'
import { ConfigService } from '@nestjs/config'

import { DynamoDbService } from '../../src/data-store/dynamodb.service'
import { S3Service } from '../../src/data-store/s3.service'

// Dedicated local process only: never use environment-provided AWS endpoints or credentials.
const client = new DynamoDBClient({
  endpoint: 'http://127.0.0.1:18765',
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  maxAttempts: 1,
})
const tableName = `admission-local-${process.pid}-${Date.now()}`
const service = new DynamoDbService(
  new ConfigService({
    DYNAMODB_REGION: 'us-east-1',
    ATTRIBUTE_LIMIT_SIZE: 400000,
  }),
  {} as S3Service,
)
let created = false

describe('atomic admission on isolated DynamoDB Local', () => {
  beforeAll(async () => {
    jest.spyOn(service, 'client', 'get').mockReturnValue(client)
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    )
    created = true
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          pk: { S: 'tenant' },
          sk: { S: 'witness' },
          generation: { N: '2' },
        },
      }),
    )
  })
  afterAll(async () => {
    try {
      if (created)
        await client.send(new DeleteTableCommand({ TableName: tableName }))
    } finally {
      client.destroy()
      jest.restoreAllMocks()
      service.client.destroy()
    }
  })
  it('rejects stale generations atomically and preserves immutable accepted commands', async () => {
    const item = {
      pk: 'tenant',
      sk: 'command@1',
      attributes: { value: 'original' },
    }
    const check = (generation: string) => [
      {
        TableName: tableName,
        Key: { pk: { S: 'tenant' }, sk: { S: 'witness' } },
        ConditionExpression: '#g = :g',
        ExpressionAttributeNames: { '#g': 'generation' },
        ExpressionAttributeValues: { ':g': { N: generation } },
      },
    ]
    const condition = 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
    await expect(
      service.putItemWithConditions(tableName, item, condition, check('1')),
    ).rejects.toBeInstanceOf(TransactionCanceledException)
    expect(
      await service.getItem(
        tableName,
        { pk: item.pk, sk: item.sk },
        { consistentRead: true },
      ),
    ).toBeUndefined()
    await service.putItemWithConditions(tableName, item, condition, check('2'))
    await expect(
      service.putItemWithConditions(
        tableName,
        { ...item, attributes: { value: 'replacement' } },
        condition,
        check('2'),
      ),
    ).rejects.toBeInstanceOf(TransactionCanceledException)
    expect(
      await service.getItem(
        tableName,
        { pk: item.pk, sk: item.sk },
        { consistentRead: true },
      ),
    ).toEqual(item)
  })
})
