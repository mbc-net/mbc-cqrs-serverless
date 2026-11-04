import {
  ConditionCheck,
  PutItemCommand,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb'
import { ConfigService } from '@nestjs/config'

import { DynamoDbService } from './dynamodb.service'
import { S3Service } from './s3.service'

const check: ConditionCheck = {
  TableName: 'witness',
  Key: { pk: { S: 'tenant' } },
  ConditionExpression: '#g = :g',
  ExpressionAttributeNames: { '#g': 'generation' },
  ExpressionAttributeValues: { ':g': { N: '3' } },
}

describe('conditional command persistence', () => {
  let service: DynamoDbService
  let send: jest.SpyInstance
  const upload = jest
    .fn()
    .mockResolvedValue({ Bucket: 'bucket', Key: 'object' })
  beforeEach(() => {
    upload.mockClear()
    service = new DynamoDbService(
      new ConfigService({ ATTRIBUTE_LIMIT_SIZE: 64, DYNAMODB_REGION: 'local' }),
      { putItem: upload } as unknown as S3Service,
    )
    send = jest.spyOn(service.client, 'send').mockResolvedValue({} as never)
  })
  afterEach(() => service.client.destroy())
  const item = () => ({
    pk: 'tenant',
    sk: 'command@1',
    createdAt: new Date('2026-01-01Z'),
    attributes: { value: 'small' },
    missing: undefined,
  })
  it('uses the original Put for zero checks', async () => {
    const original = jest.spyOn(service, 'putItem')
    const input = item()
    expect(
      await service.putItemWithConditions(
        'commands',
        input,
        'attribute_not_exists(pk)',
        [],
      ),
    ).toBe(input)
    expect(original).toHaveBeenCalledWith(
      'commands',
      input,
      'attribute_not_exists(pk)',
    )
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutItemCommand)
  })
  it('composes one immutable Put followed by checks using the existing serializer', async () => {
    const input = item()
    await service.putItemWithConditions(
      'commands',
      input,
      'attribute_not_exists(pk)',
      [check],
    )
    const transaction = send.mock.calls[0][0]
    expect(transaction).toBeInstanceOf(TransactWriteItemsCommand)
    expect(transaction.input.TransactItems).toEqual([
      {
        Put: {
          TableName: 'commands',
          Item: {
            pk: { S: input.pk },
            sk: { S: input.sk },
            createdAt: { S: expect.any(String) },
            attributes: { M: { value: { S: 'small' } } },
          },
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
      { ConditionCheck: check },
    ])
  })
  it.each([63, 64, 65, 400 * 1024])(
    'preserves attribute offload at %i payload bytes',
    async (bytes) => {
      // JSON string quotes count towards the existing byte threshold.
      const input = { ...item(), attributes: 'x'.repeat(bytes - 2) }
      await service.putItemWithConditions('commands', input, undefined, [check])
      expect(upload).toHaveBeenCalledTimes(bytes > 64 ? 1 : 0)
      expect(input.attributes).toHaveLength(bytes - 2)
      expect(
        send.mock.calls[0][0].input.TransactItems[0].Put.Item.attributes.S,
      ).toBe(bytes > 64 ? 's3://bucket/object' : input.attributes)
    },
  )
  it('propagates rejection without a fallback Put or pointer mutation', async () => {
    const failure = new Error('TransactionCanceledException')
    send.mockRejectedValueOnce(failure)
    const input = { ...item(), attributes: { big: 'x'.repeat(100) } }
    await expect(
      service.putItemWithConditions('commands', input, undefined, [check]),
    ).rejects.toBe(failure)
    expect(send).toHaveBeenCalledTimes(1)
    expect(input.attributes.big).toHaveLength(100)
    expect(upload).toHaveBeenCalledTimes(1)
  })
  it('accepts 99 checks', async () => {
    await service.putItemWithConditions(
      'commands',
      item(),
      undefined,
      Array.from({ length: 99 }, (_, i) => ({
        ...check,
        Key: { pk: { S: String(i) } },
      })),
    )
    expect(send.mock.calls[0][0].input.TransactItems).toHaveLength(100)
  })
  it.each([
    null,
    {},
    Array(100).fill(check),
    [null],
    [{}],
    [{ ...check, Put: {} }],
    [{ ...check, Key: {} }],
    [{ ...check, Key: { pk: 'raw' } }],
    [{ ...check, ConditionExpression: 1 }],
    [{ ...check, ExpressionAttributeNames: { '#g': 1 } }],
    [{ ...check, ExpressionAttributeValues: { ':g': { N: 1 } } }],
    [{ ...check, ReturnValuesOnConditionCheckFailure: 'ALL_NEW' }],
  ])('rejects malformed conditions before S3: %j', async (checks) => {
    await expect(
      service.putItemWithConditions(
        'commands',
        { ...item(), attributes: 'x'.repeat(100) },
        undefined,
        checks as ConditionCheck[],
      ),
    ).rejects.toThrow()
    expect(upload).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
