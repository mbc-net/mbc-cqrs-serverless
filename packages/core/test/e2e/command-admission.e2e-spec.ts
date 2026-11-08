import {
  ConditionalCheckFailedException,
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { ConfigService } from '@nestjs/config'

import { DynamoDbService } from '../../src/data-store/dynamodb.service'
import { S3Service } from '../../src/data-store/s3.service'
import { CommandAdmissionRejectedException } from '../../src/exceptions'

// Match the CI harness by default; allow only an explicit local test override.
const endpoint =
  process.env.COMMAND_ADMISSION_DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000'
const endpointMatch = endpoint.match(
  /^http:\/\/(?:127\.0\.0\.1|localhost):([1-9]\d{0,4})\/?$/,
)
if (
  !endpointMatch ||
  endpointMatch[0] !== endpoint ||
  Number(endpointMatch[1]) > 65535
) {
  throw new Error(
    'COMMAND_ADMISSION_DYNAMODB_ENDPOINT must be http://127.0.0.1:<port> or http://localhost:<port> (port 1..65535, optional trailing slash)',
  )
}
// Never use general AWS endpoint environment variables or ambient credentials.
const client = new DynamoDBClient({
  endpoint,
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
    ).rejects.toBeInstanceOf(CommandAdmissionRejectedException)
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
    ).rejects.toBeInstanceOf(ConditionalCheckFailedException)
    // A stale witness wins when the same request also conflicts on version.
    await expect(
      service.putItemWithConditions(
        tableName,
        { ...item, attributes: { value: 'replacement' } },
        condition,
        check('1'),
      ),
    ).rejects.toBeInstanceOf(CommandAdmissionRejectedException)
    expect(
      await service.getItem(
        tableName,
        { pk: item.pk, sk: item.sk },
        { consistentRead: true },
      ),
    ).toEqual(item)
  })
})
