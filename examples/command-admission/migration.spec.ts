import {
  ConditionalCheckFailedException,
  QueryCommand,
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
  const moveGate = jest.fn()
  const listCommands = jest.fn()
  const send = jest.fn(async (command) =>
    command instanceof QueryCommand ? listCommands(command) : moveGate(command),
  )
  const db = createMock<DynamoDbService>({ client: { send } as never })
  const conflict = () =>
    new TransactionConflictException({ message: 'conflict', $metadata: {} })
  const updated = (generation: number) => ({
    Attributes: { generation: { N: String(generation) } },
  })
  let f: Awaited<ReturnType<typeof fixture>>

  beforeEach(async () => {
    jest.clearAllMocks()
    moveGate.mockReset()
    listCommands.mockReset().mockResolvedValue({ Items: [] })
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
    moveGate
      .mockRejectedValueOnce(conflict())
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce(updated(8))
      .mockResolvedValueOnce(updated(9))
    await expect(f.migration.migrate('demo', options)).resolves.toEqual({
      generation: 9,
      migrated: false,
    })
    expect(moveGate).toHaveBeenCalledTimes(4)
  })

  it('gives up after bounded retries without reopening', async () => {
    moveGate.mockImplementation(async () => {
      throw conflict()
    })
    const failure = f.migration.migrate('demo', options)
    await expect(failure).rejects.toThrow('TENANT#demo')
    await expect(failure).rejects.toMatchObject({
      cause: expect.any(TransactionConflictException),
    })
    expect(moveGate).toHaveBeenCalledTimes(5)
  })

  it('does not retry other failures', async () => {
    const failure = new Error('denied')
    moveGate.mockRejectedValueOnce(failure)
    await expect(f.migration.migrate('demo', options)).rejects.toBe(failure)
    expect(moveGate).toHaveBeenCalledTimes(1)
  })

  it('reopens only the generation it closed', async () => {
    moveGate.mockResolvedValueOnce(updated(8)).mockResolvedValueOnce(updated(9))
    await f.migration.migrate('demo', options)
    const reopen = moveGate.mock.calls[1][0].input
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
    moveGate.mockResolvedValueOnce(updated(9))
    await f.migration.migrate('demo', options)
    expect(moveGate).toHaveBeenCalledTimes(1)
  })

  it('names the gate when it cannot be moved', async () => {
    const conditional = new ConditionalCheckFailedException({
      message: 'The conditional request failed',
      $metadata: {},
    })
    moveGate.mockRejectedValueOnce(conditional)
    db.getItem.mockImplementation(async (table) =>
      table === 'example-gates'
        ? { active: false, mode: 'maintenance', generation: 8 }
        : undefined,
    )
    const failure = f.migration.migrate('demo', options)
    await expect(failure).rejects.toThrow('TENANT#demo')
    await expect(failure).rejects.toMatchObject({ cause: conditional })
  })

  it('checks every page of commands when the data row is gone', async () => {
    const lastKey = { pk: { S: 'TENANT#demo' }, sk: { S: 'CONFIG#main@1' } }
    listCommands
      .mockResolvedValueOnce({
        Items: [{ version: { N: '1' }, status: { S: 'finish:FINISHED' } }],
        LastEvaluatedKey: lastKey,
      })
      .mockResolvedValueOnce({
        Items: [{ version: { N: '13' }, status: { S: 'sync_data:STARTED' } }],
      })
    moveGate.mockResolvedValueOnce(updated(8))
    await expect(f.migration.migrate('demo', options)).rejects.toThrow(
      'TENANT#demo@13 status=sync_data:STARTED',
    )
    expect(moveGate).toHaveBeenCalledTimes(1)
    expect(listCommands.mock.calls[0][0].input.ConsistentRead).toBe(true)
    expect(listCommands.mock.calls[1][0].input.ExclusiveStartKey).toEqual(
      lastKey,
    )
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
