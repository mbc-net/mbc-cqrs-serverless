import { randomUUID } from 'node:crypto'

import {
  CreateTableCommand,
  DeleteTableCommand,
  TransactionCanceledException,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { createMock } from '@golevelup/ts-jest'
import {
  DynamoDbService,
  S3Service,
  TableType,
} from '@mbc-cqrs-serverless/core'
import { ConfigService } from '@nestjs/config'

import { configurationKey, gateKey } from './admission'
import { localClient } from './local-dynamodb'
import { fixture, input, options } from './test-support'

const client = localClient()
const prefix = `admission-example-${randomUUID()}`
const config = new ConfigService({
  NODE_ENV: 'local',
  APP_NAME: prefix,
  DYNAMODB_REGION: 'us-east-1',
  DYNAMODB_ENDPOINT: 'http://127.0.0.1:8000',
  ATTRIBUTE_LIMIT_SIZE: 400000,
})
const db = new DynamoDbService(config, createMock<S3Service>())
const commandTable = db.getTableName('settings', TableType.COMMAND)
const dataTable = db.getTableName('settings', TableType.DATA)
const gateTable = `${prefix}-gates`
const created: string[] = []
let f: Awaited<ReturnType<typeof fixture>>

// A maintenance controller must advance the generation atomically on BOTH
// close and reopen. Real controllers also need authorization and coordination.
async function transition(active: boolean) {
  await client.send(
    new UpdateItemCommand({
      TableName: gateTable,
      Key: { pk: { S: input.pk }, sk: { S: gateKey('demo').sk } },
      UpdateExpression:
        'SET #active = :active, #mode = :mode ADD #generation :one',
      ConditionExpression: 'attribute_exists(pk)',
      ExpressionAttributeNames: {
        '#active': 'active',
        '#mode': 'mode',
        '#generation': 'generation',
      },
      ExpressionAttributeValues: {
        ':active': { BOOL: active },
        ':mode': { S: active ? 'normal' : 'maintenance' },
        ':one': { N: '1' },
      },
    }),
  )
}
const acceptedRow = () =>
  db.getItem(
    commandTable,
    { pk: input.pk, sk: 'CONFIG#main@13' },
    { consistentRead: true },
  )

beforeAll(async () => {
  jest.spyOn(db, 'client', 'get').mockReturnValue(client)
  for (const TableName of [commandTable, dataTable, gateTable]) {
    await client.send(
      new CreateTableCommand({
        TableName,
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
    created.push(TableName)
  }
  f = await fixture(db, gateTable)
})
beforeEach(async () => {
  await db.deleteItem(commandTable, { pk: input.pk, sk: 'CONFIG#main@13' })
  await db.putItem(gateTable, {
    ...gateKey('demo'),
    active: true,
    mode: 'normal',
    generation: 7,
  })
  await db.putItem(commandTable, {
    ...input,
    sk: 'CONFIG#main@12',
    attributes: { value: 'old' },
  })
  await db.putItem(dataTable, { ...input, attributes: { value: 'old' } })
  f.session.put.mockClear()
})
afterAll(async () => {
  try {
    // Attempt cleanup of every successfully created table, even after failures.
    const results = await Promise.allSettled([
      f?.module.close(),
      ...created.map((TableName) =>
        client.send(new DeleteTableCommand({ TableName })),
      ),
    ])
    const failure = results.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
  } finally {
    client.destroy()
    jest.restoreAllMocks()
    db.client.destroy()
  }
})

describe('maintenance freeze with the real publisher and DynamoDB Local', () => {
  it('accepts an open matching generation through the application', async () => {
    const result = await f.application.update('demo', 'new', options)
    expect(result?.version).toBe(13)
    expect(await acceptedRow()).toEqual(
      expect.objectContaining({
        version: 13,
        attributes: { value: 'new' },
        createdAt: expect.any(Date),
      }),
    )
  })

  it.each([false, true])(
    'rejects gen7 after close (reopened=%s) with no command',
    async (reopen) => {
      await expect(
        f.admission.capture('demo', async () => {
          const observed = await f.commands.getLatestItem(
            configurationKey('demo'),
          )
          expect(observed.version).toBe(12)
          await transition(false) // generation 8: closed after the read
          if (reopen) await transition(true) // generation 9: open, but gen7 is stale
          return f.commands.publishAsync(
            { ...input, version: observed.version },
            options,
          )
        }),
      ).rejects.toBeInstanceOf(TransactionCanceledException)
      expect(await acceptedRow()).toBeUndefined()
      expect(f.session.put).not.toHaveBeenCalled()
    },
  )

  it('rejects starting while stopped, but unrelated commands continue', async () => {
    await transition(false)
    await expect(f.application.update('demo', 'new', options)).rejects.toThrow(
      'unavailable',
    )
    expect(await acceptedRow()).toBeUndefined()
    const result = await f.commands.publishAsync(
      { ...input, sk: 'MESSAGE#main', version: 0 },
      options,
    )
    expect(
      await db.getItem(
        commandTable,
        { pk: input.pk, sk: result.sk },
        { consistentRead: true },
      ),
    ).toBeDefined()
  })

  it('rejects missing or cross-tenant context without persisting', async () => {
    await expect(f.commands.publishAsync(input, options)).rejects.toThrow(
      'witness',
    )
    await db.putItem(gateTable, {
      ...gateKey('other'),
      active: true,
      mode: 'normal',
      generation: 7,
    })
    await expect(
      f.admission.capture('other', () =>
        f.commands.publishAsync(input, options),
      ),
    ).rejects.toThrow('tenant')
    expect(await acceptedRow()).toBeUndefined()
  })

  it('accepts a fresh request after reopening, with a freshly read observed version', async () => {
    await transition(false)
    await transition(true)
    expect(await f.application.update('demo', 'fresh', options)).toEqual(
      expect.objectContaining({ version: 13 }),
    )
    expect(await acceptedRow()).toEqual(
      expect.objectContaining({ attributes: { value: 'fresh' } }),
    )
  })
})
