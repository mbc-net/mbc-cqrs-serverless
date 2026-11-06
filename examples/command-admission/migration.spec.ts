import {
  ConditionalCheckFailedException,
  TransactionConflictException,
} from '@aws-sdk/client-dynamodb'
import { createMock } from '@golevelup/ts-jest'
import { DynamoDbService } from '@mbc-cqrs-serverless/core'
import { Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { ConfigurationExampleModule } from './example.module'
import { ConfigurationMigration } from './migration'
import { fixture, options } from './test-support'

describe('migration gate updates', () => {
  const send = jest.fn()
  const db = createMock<DynamoDbService>({ client: { send } as never })
  const conflict = () =>
    new TransactionConflictException({ message: 'conflict', $metadata: {} })
  const updated = (generation: number) => ({
    Attributes: { generation: { N: String(generation) } },
  })
  let f: Awaited<ReturnType<typeof fixture>>

  beforeEach(async () => {
    jest.clearAllMocks()
    send.mockReset()
    db.getTableName.mockImplementation(
      (name, type) => `example-${name}-${type}`,
    )
    // No configuration exists, so the migration only moves the gate.
    db.getItem.mockImplementation(async (table) =>
      table === 'example-gates'
        ? { active: true, mode: 'normal', generation: 7 }
        : undefined,
    )
    f = await fixture(db)
  })
  afterEach(async () => f?.module.close())

  it('retries a gate update that loses to an in-flight transaction', async () => {
    send
      .mockRejectedValueOnce(conflict())
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce(updated(8))
      .mockResolvedValueOnce(updated(9))
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 9,
      migrated: false,
    })
    expect(send).toHaveBeenCalledTimes(4)
  })

  it('gives up after bounded retries without reopening', async () => {
    send.mockImplementation(async () => {
      throw conflict()
    })
    const failure = f.migration.migrate('demo', options)
    await expect(failure).rejects.toThrow('TENANT#demo')
    await expect(failure).rejects.toMatchObject({
      cause: expect.any(TransactionConflictException),
    })
    expect(send).toHaveBeenCalledTimes(5)
  })

  it('does not retry other failures', async () => {
    const failure = new Error('denied')
    send.mockRejectedValueOnce(failure)
    await expect(f.migration.migrate('demo', options)).rejects.toBe(failure)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('reopens only the generation it closed', async () => {
    send.mockResolvedValueOnce(updated(8)).mockResolvedValueOnce(updated(9))
    await f.migration.migrate('demo', options)
    const reopen = send.mock.calls[1][0].input
    expect(reopen.ConditionExpression).toContain('#generation = :held')
    expect(reopen.ExpressionAttributeValues[':held']).toEqual({ N: '8' })
    expect(reopen.ExpressionAttributeValues[':toMode']).toEqual({ S: 'normal' })
  })

  it('resumes a held gate without advancing it', async () => {
    db.getItem.mockImplementation(async (table) =>
      table === 'example-gates'
        ? { active: false, mode: 'migration', generation: 8 }
        : undefined,
    )
    send.mockResolvedValueOnce(updated(9))
    await f.migration.migrate('demo', options)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('names the gate when it cannot be moved', async () => {
    const conditional = new ConditionalCheckFailedException({
      message: 'The conditional request failed',
      $metadata: {},
    })
    send.mockRejectedValueOnce(conditional)
    db.getItem.mockImplementation(async (table) =>
      table === 'example-gates'
        ? { active: false, mode: 'maintenance', generation: 8 }
        : undefined,
    )
    const failure = f.migration.migrate('demo', options)
    await expect(failure).rejects.toThrow('TENANT#demo')
    await expect(failure).rejects.toMatchObject({ cause: conditional })
  })

  it('resolves DynamoDbService from non-global infrastructureImports', async () => {
    @Module({
      providers: [{ provide: DynamoDbService, useValue: db }],
      exports: [DynamoDbService],
    })
    class Infrastructure {}
    const module = await Test.createTestingModule({
      imports: [
        ConfigurationExampleModule.register({
          tableName: 'settings',
          witnessTableName: 'example-gates',
          infrastructureImports: [Infrastructure],
        }),
      ],
    })
      // Mock the rest, but leave DynamoDbService to real module visibility.
      .useMocker((token) =>
        token === DynamoDbService ? undefined : createMock(),
      )
      .compile()
    expect(module.get(ConfigurationMigration)).toBeInstanceOf(
      ConfigurationMigration,
    )
    await module.close()
  })
})
