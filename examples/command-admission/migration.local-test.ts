import { randomUUID } from 'node:crypto'

import {
  ConditionalCheckFailedException,
  CreateTableCommand,
  DeleteTableCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { createMock } from '@golevelup/ts-jest'
import {
  CommandAdmissionRejectedException,
  DynamoDbService,
  HistoryService,
  S3Service,
  TableType,
} from '@mbc-cqrs-serverless/core'
import { TtlService } from '@mbc-cqrs-serverless/core/dist/commands/ttl.service'
import { ConfigService } from '@nestjs/config'

import { gateKey } from './admission'
import { localClient } from './local-dynamodb'
import { fixture, input, options } from './test-support'

const client = localClient()
const prefix = `admission-migration-${randomUUID()}`
const db = new DynamoDbService(
  new ConfigService({
    NODE_ENV: 'local',
    APP_NAME: prefix,
    DYNAMODB_REGION: 'us-east-1',
    DYNAMODB_ENDPOINT: 'http://127.0.0.1:8000',
    ATTRIBUTE_LIMIT_SIZE: 400000,
  }),
  createMock<S3Service>(),
)
const commandTable = db.getTableName('settings', TableType.COMMAND)
const dataTable = db.getTableName('settings', TableType.DATA)
const historyTable = db.getTableName('settings', TableType.HISTORY)
const gateTable = `${prefix}-gates`
const created: string[] = []
let f: Awaited<ReturnType<typeof fixture>>

const key = { pk: input.pk, sk: input.sk }
const finished = 'finish:FINISHED'
const read = (table: string, sk: string) =>
  db.getItem(table, { pk: input.pk, sk }, { consistentRead: true })
const gate = () => read(gateTable, gateKey('demo').sk)
const command = (version: number) =>
  read(commandTable, `${input.sk}@${version}`)

// Another controller moving the gate while a migration holds it.
const moveGate = () =>
  client.send(
    new UpdateItemCommand({
      TableName: gateTable,
      Key: { pk: { S: input.pk }, sk: { S: gateKey('demo').sk } },
      UpdateExpression: 'ADD #generation :one',
      ExpressionAttributeNames: { '#generation': 'generation' },
      ExpressionAttributeValues: { ':one': { N: '1' } },
    }),
  )

// Makes the next call fail, then calls through. Restored even if a test fails,
// so an unused failure cannot leak into a later test.
const spies: jest.SpyInstance[] = []
function failNext<T extends object>(
  target: T,
  method: keyof T & string,
  message: string,
) {
  spies.push(
    jest
      .spyOn(target as Record<string, any>, method)
      .mockRejectedValueOnce(new Error(message)),
  )
}
afterEach(() => spies.splice(0).forEach((spy) => spy.mockRestore()))

beforeAll(async () => {
  jest.spyOn(db, 'client', 'get').mockReturnValue(client)
  for (const TableName of [commandTable, dataTable, historyTable, gateTable]) {
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
  for (const version of [13, 14, 15]) {
    await db.deleteItem(commandTable, {
      ...key,
      sk: `${input.sk}@${version}`,
    })
  }
  await db.putItem(gateTable, {
    ...gateKey('demo'),
    active: true,
    mode: 'normal',
    generation: 7,
  })
  const v1 = { ...input, attributes: { value: 'old' } }
  await db.putItem(commandTable, {
    ...v1,
    sk: `${input.sk}@12`,
    status: finished,
  })
  await db.putItem(dataTable, v1)
})
afterAll(async () => {
  try {
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

describe('data migration with the real publisher and DynamoDB Local', () => {
  const v2 = (value: string) => ({ schemaVersion: 2, settings: { value } })

  it('migrates through a fenced command, then reopens at a new generation', async () => {
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 9,
      migrated: true,
    })
    expect(await command(13)).toEqual(
      expect.objectContaining({ attributes: v2('old'), status: finished }),
    )
    expect(await read(dataTable, input.sk)).toEqual(
      expect.objectContaining({ version: 13, attributes: v2('old') }),
    )
    expect(await read(historyTable, `${input.sk}@12`)).toEqual(
      expect.objectContaining({ attributes: { value: 'old' } }),
    )
    expect(await gate()).toEqual(
      expect.objectContaining({
        active: true,
        mode: 'normal',
        generation: 9,
      }),
    )
  })

  it('writes the new format for ordinary updates after reopening', async () => {
    await f.migration.migrate('demo', options)
    await f.application.update('demo', 'after', options)
    expect((await command(14)).attributes).toEqual(v2('after'))
  })

  it('stays closed until accepted work drains, then keeps that work', async () => {
    await f.application.update('demo', 'accepted', options)
    await expect(f.migration.migrate('demo', options)).rejects.toThrow(
      'not drained',
    )
    expect(await gate()).toEqual(
      expect.objectContaining({
        active: false,
        mode: 'migration',
        generation: 8,
      }),
    )
    expect(await command(14)).toBeUndefined()
    await expect(
      f.application.update('demo', 'blocked', options),
    ).rejects.toThrow('unavailable')

    // The stream and Step Functions pipeline finish the accepted command.
    await db.putItem(dataTable, {
      ...input,
      version: 13,
      attributes: { value: 'accepted' },
    })
    await f.commands.updateStatus({ ...key, sk: `${input.sk}@13` }, finished)
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 9,
      migrated: true,
    })
    expect((await command(14)).attributes).toEqual(v2('accepted'))
  })

  it('stays closed when accepted work failed', async () => {
    await f.commands.updateStatus(
      { ...key, sk: `${input.sk}@12` },
      'sync_data:FAILED',
    )
    await expect(f.migration.migrate('demo', options)).rejects.toThrow('failed')
    expect(await gate()).toEqual(
      expect.objectContaining({ active: false, generation: 8 }),
    )
    expect(await command(13)).toBeUndefined()
  })

  it('reports a newer command that failed instead of waiting for it', async () => {
    await f.application.update('demo', 'accepted', options)
    await f.commands.updateStatus(
      { ...key, sk: `${input.sk}@13` },
      'sync_data:FAILED',
    )
    await expect(f.migration.migrate('demo', options)).rejects.toThrow('failed')
    expect(await command(14)).toBeUndefined()
  })

  it('rejects the migration command when the gate moves during the migration', async () => {
    await expect(
      f.migration.migrate('demo', options, (attributes) => {
        return moveGate().then(() => ({ ...attributes, schemaVersion: 2 }))
      }),
    ).rejects.toBeInstanceOf(CommandAdmissionRejectedException)
    expect(await command(13)).toBeUndefined()
    expect(await read(dataTable, input.sk)).toEqual(
      expect.objectContaining({ version: 12 }),
    )
    expect(await gate()).toEqual(
      expect.objectContaining({ active: false, generation: 9 }),
    )
  })

  it('does not reopen a gate it no longer holds', async () => {
    const failure = f.migration.migrate('demo', options, (attributes) =>
      moveGate().then(() => attributes),
    )
    await expect(failure).rejects.toThrow('TENANT#demo')
    await expect(failure).rejects.toMatchObject({
      cause: expect.any(ConditionalCheckFailedException),
    })
    expect(await gate()).toEqual(
      expect.objectContaining({ active: false, generation: 9 }),
    )
  })

  it('does not skip a transform that changes its input in place', async () => {
    const inPlace = (attributes: Record<string, any>) => {
      attributes.schemaVersion = 2
      return attributes
    }
    await expect(
      f.migration.migrate('demo', options, inPlace),
    ).resolves.toEqual({ generation: 9, migrated: true })
    expect((await read(dataTable, input.sk)).attributes).toEqual({
      value: 'old',
      schemaVersion: 2,
    })
  })

  it('verifies a value that does not survive storage', async () => {
    const v1 = { ...input, attributes: {} }
    await db.putItem(dataTable, v1)
    await db.putItem(commandTable, {
      ...v1,
      sk: `${input.sk}@12`,
      status: finished,
    })
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 9,
      migrated: true,
    })
  })

  it('migrates a configuration that has no attributes', async () => {
    const v1 = { ...input }
    delete v1.attributes
    await db.putItem(dataTable, v1)
    await db.putItem(commandTable, {
      ...v1,
      sk: `${input.sk}@12`,
      status: finished,
    })
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 9,
      migrated: true,
    })
    expect((await read(dataTable, input.sk)).attributes).toEqual({
      schemaVersion: 2,
      settings: {},
    })
  })

  it('keeps metadata that the migration does not change', async () => {
    await db.putItem(dataTable, {
      ...input,
      seq: 42,
      attributes: { value: 'old' },
    })
    await f.migration.migrate('demo', options)
    expect(await read(dataTable, input.sk)).toEqual(
      expect.objectContaining({ seq: 42, version: 13, attributes: v2('old') }),
    )
  })

  describe('with a default TTL for the table', () => {
    beforeEach(() => {
      spies.push(
        jest
          .spyOn(f.module.get(TtlService), 'calculateTtl')
          .mockResolvedValue(999),
      )
    })

    it('keeps the expiry that the configuration already has', async () => {
      await db.putItem(dataTable, {
        ...input,
        ttl: 1234,
        attributes: { value: 'old' },
      })
      await f.migration.migrate('demo', options)
      expect(await read(dataTable, input.sk)).toEqual(
        expect.objectContaining({ version: 13, ttl: 1234 }),
      )
      expect((await command(13)).ttl).toBe(1234)
    })

    it('does not add an expiry to a configuration without one', async () => {
      await f.migration.migrate('demo', options)
      const stored = await read(dataTable, input.sk)
      expect(stored.version).toBe(13)
      expect(stored.ttl ?? null).toBeNull()
    })
  })

  it('sees a change that exists only inside a Set', async () => {
    const v1 = { ...input, attributes: { tags: new Set(['old']) } }
    await db.putItem(dataTable, v1)
    await db.putItem(commandTable, {
      ...v1,
      sk: `${input.sk}@12`,
      status: finished,
    })
    await expect(
      f.migration.migrate('demo', options, () => ({
        tags: new Set(['new']),
      })),
    ).resolves.toEqual({ generation: 9, migrated: true })
    expect((await read(dataTable, input.sk)).attributes.tags).toEqual(
      new Set(['new']),
    )
  })

  it('names the command and status that block a stuck migration', async () => {
    // The process died after persisting the command, so it stays STARTED.
    failNext(f.module.get(HistoryService), 'publish', 'throttled')
    failNext(f.commands, 'updateStatus', 'also down')
    await expect(f.migration.migrate('demo', options)).rejects.toThrow(
      'throttled',
    )
    await expect(f.migration.migrate('demo', options)).rejects.toThrow(
      `${input.pk}@13 status=publish_sync:STARTED`,
    )
    await db.deleteItem(commandTable, { ...key, sk: `${input.sk}@13` })
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 9,
      migrated: true,
    })
  })

  describe('when the migration command itself fails', () => {
    const failed = (version: number) =>
      expect.objectContaining({
        version,
        status: 'publish_sync:FAILED',
      })

    it('recovers by deleting the failed command when no data was applied', async () => {
      failNext(f.module.get(HistoryService), 'publish', 'throttled')
      await expect(f.migration.migrate('demo', options)).rejects.toThrow(
        'throttled',
      )
      expect(await command(13)).toEqual(failed(13))
      expect((await read(dataTable, input.sk)).version).toBe(12)
      await expect(f.migration.migrate('demo', options)).rejects.toThrow(
        'failed',
      )

      await db.deleteItem(commandTable, { ...key, sk: `${input.sk}@13` })
      await expect(f.migration.migrate('demo', options)).resolves.toEqual({
        generation: 9,
        migrated: true,
      })
      expect((await command(13)).attributes).toEqual(v2('old'))
    })

    it('recovers by completing the command when the data was applied', async () => {
      failNext(f.commands, 'updateStatus', 'handler failed')
      await expect(f.migration.migrate('demo', options)).rejects.toThrow(
        'handler failed',
      )
      expect(await command(13)).toEqual(failed(13))
      expect((await read(dataTable, input.sk)).version).toBe(13)
      await expect(f.migration.migrate('demo', options)).rejects.toThrow(
        'failed',
      )

      await f.commands.updateStatus({ ...key, sk: `${input.sk}@13` }, finished)
      await expect(f.migration.migrate('demo', options)).resolves.toEqual({
        generation: 9,
        migrated: false,
      })
      expect(await command(14)).toBeUndefined()
    })
  })

  it('is idempotent and adds no command when already migrated', async () => {
    await f.migration.migrate('demo', options)
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 11,
      migrated: false,
    })
    expect(await command(14)).toBeUndefined()
  })

  it('does not revive a deleted configuration', async () => {
    const deleted = {
      ...input,
      isDeleted: true,
      attributes: { value: 'gone' },
    }
    await db.putItem(dataTable, deleted)
    await db.putItem(commandTable, {
      ...deleted,
      sk: `${input.sk}@12`,
      status: finished,
    })
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 9,
      migrated: false,
    })
    expect(await command(13)).toBeUndefined()
  })
})
