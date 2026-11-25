import {
  ConditionalCheckFailedException,
  PutItemCommand,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { DynamoDbService } from './dynamodb.service'
import { STRICT_INLINE_ATTRIBUTE_BYTES } from './strict-inline-options'

describe('strict inline DynamoDB boundary', () => {
  const services: DynamoDbService[] = []
  const marker = 'synthetic-sensitive-marker'
  const s3 = { getItem: jest.fn(), putItem: jest.fn() }
  const config = new ConfigService({
    NODE_ENV: 'test',
    APP_NAME: 'strict',
    DYNAMODB_REGION: 'ap-northeast-1',
    ATTRIBUTE_LIMIT_SIZE: 1,
  })
  function create(strict = true) {
    const service = new (DynamoDbService as any)(
      config,
      s3,
      strict ? { profile: 'strict-inline-v1' } : undefined,
    ) as DynamoDbService
    services.push(service)
    return service
  }
  afterEach(() => {
    for (const service of services.splice(0)) service.client.destroy()
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('owns an explicit single-attempt client without affecting legacy instances', async () => {
    const strict = create(),
      legacy = create(false)
    expect((strict as any).isStrictInline).toBe(true)
    expect((legacy as any).isStrictInline).toBe(false)
    expect(strict.client).not.toBe(legacy.client)
    expect(await strict.client.config.maxAttempts()).toBe(1)
  })

  it('keeps lawful attributes inline regardless of the legacy S3 threshold', async () => {
    const service = create()
    const send = jest
      .spyOn(service.client, 'send')
      .mockResolvedValue({} as never)
    const item = { pk: 'p', sk: 's', attributes: { value: marker } }
    await service.putItem('table', item)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutItemCommand)
    expect(
      (send.mock.calls[0][0] as PutItemCommand).input.Item.attributes.M.value.S,
    ).toBe(marker)
    expect(s3.putItem).not.toHaveBeenCalled()
  })

  it('accepts the exact attribute byte boundary and counts Unicode in UTF-8', async () => {
    const service = create()
    const send = jest
      .spyOn(service.client, 'send')
      .mockResolvedValue({} as never)
    const overhead = Buffer.byteLength(JSON.stringify({ value: '' }))
    const bytes = STRICT_INLINE_ATTRIBUTE_BYTES - overhead
    const value = '名'.repeat(Math.floor(bytes / 3)) + 'x'.repeat(bytes % 3)
    await service.putItem('table', { pk: 'p', sk: 's', attributes: { value } })
    expect(send).toHaveBeenCalledTimes(1)
    await expect(
      service.putItem('table', {
        pk: 'p',
        sk: 's',
        attributes: { value: value + 'x' },
      }),
    ).rejects.toThrow('Strict inline data operation rejected')
    expect(send).toHaveBeenCalledTimes(1)
    expect(s3.putItem).not.toHaveBeenCalled()
  })

  it('rejects invalid or partial profile settings before constructing a client', () => {
    for (const value of [
      null,
      {},
      { profile: 'unknown' },
      { profile: 'strict-inline-v1', extra: true },
    ]) {
      expect(() => new (DynamoDbService as any)(config, s3, value)).toThrow(
        'Invalid strict inline profile',
      )
    }
  })

  it.each([
    ['put', (d: DynamoDbService) => d.putItem('table', { pk: 'p', sk: 's' })],
    [
      'update',
      (d: DynamoDbService) =>
        d.updateItem('table', { pk: 'p', sk: 's' }, { set: { name: 'value' } }),
    ],
    [
      'delete',
      (d: DynamoDbService) => d.deleteItem('table', { pk: 'p', sk: 's' }),
    ],
    ['query', (d: DynamoDbService) => d.listItemsByPk('table', 'p')],
    ['scan', (d: DynamoDbService) => d.listAllItems('table')],
    [
      'admission',
      (d: DynamoDbService) =>
        d.putItemWithConditions('table', { pk: 'p', sk: 's' }, undefined, [
          {
            TableName: 'control',
            Key: { pk: { S: 'p' } },
            ConditionExpression: 'attribute_exists(pk)',
          },
        ]),
    ],
  ])('scrubs SDK error values from %s', async (_name, operation) => {
    const service = create()
    jest
      .spyOn(service.client as any, 'send')
      .mockRejectedValue(Object.assign(new Error(marker), { payload: marker }))
    let error: any
    try {
      await (operation as (d: DynamoDbService) => Promise<any>)(service)
    } catch (e) {
      error = e
    }
    expect(error.message).toBe('Strict inline data operation unavailable')
    expect(error.cause).toBeUndefined()
    expect(JSON.stringify(error)).not.toContain(marker)
  })

  it.each([
    { attributes: 's3://bucket/key' },
    { attributes: { value: 'x'.repeat(STRICT_INLINE_ATTRIBUTE_BYTES) } },
    { attributes: {}, name: 'x'.repeat(300 * 1024) },
  ])(
    'rejects unsupported inline payload before DynamoDB or S3 writes',
    async (extra) => {
      const service = create()
      const send = jest
        .spyOn(service.client, 'send')
        .mockResolvedValue({} as never)
      await expect(
        service.putItem('table', { pk: 'p', sk: 's', ...extra }),
      ).rejects.toThrow('Strict inline data operation rejected')
      expect(send).not.toHaveBeenCalled()
      expect(s3.putItem).not.toHaveBeenCalled()
    },
  )

  it('rejects S3 references on reads before S3 access', async () => {
    const service = create()
    jest.spyOn(service.client, 'send').mockResolvedValue({
      Item: {
        pk: { S: 'p' },
        sk: { S: 's' },
        attributes: { S: 's3://bucket/key' },
      },
    } as never)
    await expect(
      service.getItem('table', { pk: 'p', sk: 's' }),
    ).rejects.toThrow('Strict inline data operation rejected')
    expect(s3.getItem).not.toHaveBeenCalled()
  })

  it('never gives update values or expressions to the logger', async () => {
    const service = create()
    const log = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined)
    jest
      .spyOn(service.client, 'send')
      .mockResolvedValue({ Attributes: {} } as never)
    await service.updateItem(
      'table',
      { pk: marker, sk: marker },
      { set: { attributes: { value: marker } } },
    )
    expect(JSON.stringify(log.mock.calls)).not.toContain(marker)
    expect(s3.putItem).not.toHaveBeenCalled()
  })

  it('scrubs native failures while retaining only fixed conditional classification', async () => {
    const service = create()
    const raw = new Error(marker)
    Object.assign(raw, { cause: marker, $metadata: { requestId: marker } })
    const send = jest
      .spyOn(service.client as any, 'send')
      .mockRejectedValue(raw)
    let error: any
    try {
      await service.getItem('table', { pk: 'p', sk: 's' })
    } catch (e) {
      error = e
    }
    expect(error).not.toBe(raw)
    expect(error.message).toBe('Strict inline data operation unavailable')
    expect(JSON.stringify(error)).not.toContain(marker)
    expect(error.cause).toBeUndefined()
    send.mockRejectedValue(
      new ConditionalCheckFailedException({
        message: marker,
        $metadata: { requestId: marker },
      }),
    )
    await expect(
      service.putItem('table', { pk: 'p', sk: 's' }),
    ).rejects.toMatchObject({
      name: 'ConditionalCheckFailedException',
      message: 'The conditional request failed',
    })
  })

  it('keeps native transaction admission rejection free of raw cause and key logs', async () => {
    const service = create()
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined)
    jest.spyOn(service.client as any, 'send').mockRejectedValue(
      new TransactionCanceledException({
        message: marker,
        $metadata: { requestId: marker },
        CancellationReasons: [
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed', Message: marker },
        ],
      }),
    )
    let error: any
    try {
      await service.putItemWithConditions(
        'table',
        { pk: marker, sk: marker },
        undefined,
        [
          {
            TableName: 'control',
            Key: { pk: { S: 'p' } },
            ConditionExpression: 'attribute_exists(pk)',
          },
        ],
      )
    } catch (e) {
      error = e
    }
    expect(error.message).toBe('Command admission rejected')
    expect(error.cause).toBeUndefined()
    expect(JSON.stringify(error)).not.toContain(marker)
    expect(JSON.stringify(warn.mock.calls)).not.toContain(marker)
  })

  it('destroys only its owned strict client once at shutdown', () => {
    const service = create(),
      legacy = create(false)
    const strictDestroy = jest.spyOn(service.client, 'destroy')
    const legacyDestroy = jest.spyOn(legacy.client, 'destroy')
    ;(service as any).onModuleDestroy()
    ;(service as any).onModuleDestroy()
    expect(strictDestroy).toHaveBeenCalledTimes(1)
    expect(legacyDestroy).not.toHaveBeenCalled()
  })
})
