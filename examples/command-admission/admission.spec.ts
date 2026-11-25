import { createMock } from '@golevelup/ts-jest'
import {
  CommandEventHandler,
  DataService,
  DataSyncCommandSfnName,
  DynamoDbService,
  JwtClaims,
  Repository,
} from '@mbc-cqrs-serverless/core'

import { ConfigurationCommands } from './admission'
import { fixture, input, options } from './test-support'

describe('server-owned admission and Nest registration', () => {
  let f: Awaited<ReturnType<typeof fixture>>
  const db = createMock<DynamoDbService>()
  beforeEach(async () => {
    jest.clearAllMocks()
    db.getTableName.mockImplementation(
      (name, type) => `example-${name}-${type}`,
    )
    db.getItem.mockImplementation(async (table) =>
      table === 'example-gates'
        ? { active: true, mode: 'normal', generation: 7 }
        : { ...input, sk: 'CONFIG#main@12', attributes: { value: 'old' } },
    )
    f = await fixture(db)
  })
  afterEach(async () => f?.module.close())

  it('uses the subclass, table binding and same service inside the event handler', async () => {
    expect(f.commands).toBeInstanceOf(ConfigurationCommands)
    expect(f.commands.tableName).toBe('example-settings-command')
    const handler = f.module.get<CommandEventHandler>(
      'settings_CommandEventHandler',
    )
    expect(handler).toBe(f.module.get(CommandEventHandler))
    const update = jest
      .spyOn(f.commands, 'updateStatus')
      .mockResolvedValue(undefined)
    const ttl = jest.spyOn(f.commands, 'updateTtl').mockResolvedValue(undefined)
    await expect(
      handler.execute(
        createMock<Parameters<CommandEventHandler['execute']>[0]>({
          commandKey: { pk: input.pk, sk: 'CONFIG#main@13' },
          commandRecord: { ...input },
          stepStateName: DataSyncCommandSfnName.SET_TTL_COMMAND,
        }),
      ),
    ).resolves.toEqual({ result: 'ok' })
    expect(ttl).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })

  it('passes the original generation and tenant check to the normal publisher', async () => {
    await f.admission.capture('demo', () =>
      f.commands.publishAsync(input, options),
    )
    expect(db.putItemWithConditions).toHaveBeenCalledWith(
      f.commands.tableName,
      expect.objectContaining({ sk: 'CONFIG#main@13', version: 13 }),
      'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      [
        expect.objectContaining({
          TableName: 'example-gates',
          ConditionExpression:
            '#active = :active AND #mode = :mode AND #generation = :generation',
          Key: {
            pk: { S: 'TENANT#demo' },
            sk: { S: 'CONFIGURATION_ADMISSION' },
          },
          ExpressionAttributeValues: {
            ':active': { BOOL: true },
            ':mode': { S: 'normal' },
            ':generation': { N: '7' },
          },
        }),
      ],
    )
    expect(
      db.getItem.mock.calls.filter(([table]) => table === 'example-gates'),
    ).toHaveLength(1)
  })

  it('uses the same replacement service when Repository merges a pending command', async () => {
    const repository = f.module.get(Repository)
    const key = { pk: input.pk, sk: input.sk }
    f.session.get.mockResolvedValue({
      pk: 'example-user#demo',
      sk: `settings#${input.pk}#${input.sk}`,
      version: 13,
      ttl: 2000000000,
    })
    jest
      .spyOn(f.module.get(DataService), 'getItem')
      .mockResolvedValue({ ...input, attributes: { value: 'old' } })
    const read = jest.spyOn(f.commands, 'getItem').mockResolvedValue({
      ...input,
      sk: 'CONFIG#main@13',
      version: 13,
      attributes: { value: 'pending' },
    })

    const result = await repository.getItem(
      key,
      createMock<Parameters<Repository['getItem']>[1]>({
        invokeContext: {
          event: {
            requestContext: {
              authorizer: {
                jwt: {
                  claims: createMock<JwtClaims>({
                    sub: 'example-user',
                    'custom:tenant': 'demo',
                    'custom:roles': '[]',
                    'custom:groups': '[]',
                  }),
                },
              },
            },
          },
        },
      }),
    )
    expect(f.commands).toBeInstanceOf(ConfigurationCommands)
    expect(read).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledWith({ pk: input.pk, sk: 'CONFIG#main@13' })
    expect(result).toEqual(
      expect.objectContaining({
        ...key,
        version: 13,
        attributes: { value: 'pending' },
      }),
    )
  })

  it('rejects a protected write with no server witness', async () => {
    await expect(f.commands.publishAsync(input, options)).rejects.toThrow(
      'witness',
    )
    expect(db.putItemWithConditions).not.toHaveBeenCalled()
  })

  it('rejects a cross-tenant write', async () => {
    await expect(
      f.admission.capture('other', () =>
        f.commands.publishAsync(input, options),
      ),
    ).rejects.toThrow('tenant')
    expect(db.putItemWithConditions).not.toHaveBeenCalled()
  })

  it('allows unrelated command keys without a witness', async () => {
    await f.commands.publishAsync({ ...input, sk: 'MESSAGE#main' }, options)
    expect(db.putItemWithConditions).toHaveBeenCalledWith(
      f.commands.tableName,
      expect.any(Object),
      expect.any(String),
      [],
    )
  })

  it('captures before reading/building and passes the observed command version', async () => {
    const order: string[] = []
    db.getItem.mockImplementation(async () => {
      order.push('capture')
      return { active: true, mode: 'normal', generation: 7 }
    })
    jest.spyOn(f.commands, 'getLatestItem').mockImplementation(async () => {
      order.push('read')
      return input
    })
    const publish = jest
      .spyOn(f.commands, 'publishAsync')
      .mockResolvedValue(null)
    await f.application.update('demo', 'updated', options)
    expect(order).toEqual(['capture', 'read'])
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 12,
        attributes: { value: 'updated' },
      }),
      options,
    )
  })

  it.each([
    undefined,
    { active: false, mode: 'maintenance', generation: 8 },
    { active: true, mode: 'maintenance', generation: 8 },
    { active: true, mode: 'normal', generation: '7' },
  ])(
    'does not build an update for an unavailable or malformed gate: %j',
    async (gate) => {
      db.getItem.mockResolvedValue(gate)
      const read = jest.spyOn(f.commands, 'getLatestItem')
      await expect(
        f.application.update('demo', 'new', options),
      ).rejects.toThrow('unavailable')
      expect(read).not.toHaveBeenCalled()
      expect(db.putItemWithConditions).not.toHaveBeenCalled()
    },
  )

  it('does not refresh or retry after a transaction rejection', async () => {
    const failure = new Error('TransactionCanceledException')
    db.putItemWithConditions.mockRejectedValueOnce(failure)
    await expect(
      f.admission.capture('demo', () =>
        f.commands.publishAsync(input, options),
      ),
    ).rejects.toBe(failure)
    expect(db.putItemWithConditions).toHaveBeenCalledTimes(1)
    expect(db.putItem).not.toHaveBeenCalled()
    expect(f.session.put).not.toHaveBeenCalled()
    expect(
      db.getItem.mock.calls.filter(([table]) => table === 'example-gates'),
    ).toHaveLength(1)
    expect(f.admission.witness).toBeUndefined()
  })

  it('does not use VERSION_LATEST when the observed version is invalid', async () => {
    jest
      .spyOn(f.commands, 'getLatestItem')
      .mockResolvedValue({ ...input, version: -1 })
    await expect(f.application.update('demo', 'new', options)).rejects.toThrow(
      'existing configuration',
    )
    expect(db.putItemWithConditions).not.toHaveBeenCalled()
  })

  it('rejects a deleted configuration before publishing a command that could revive it', async () => {
    const order: string[] = []
    db.getItem.mockImplementation(async () => {
      order.push('capture')
      return { active: true, mode: 'normal', generation: 7 }
    })
    jest.spyOn(f.commands, 'getLatestItem').mockImplementation(async () => {
      order.push('read')
      return { ...input, isDeleted: true }
    })
    const publish = jest.spyOn(f.commands, 'publishAsync')

    await expect(f.application.update('demo', 'new', options)).rejects.toThrow(
      'existing configuration',
    )
    expect(order).toEqual(['capture', 'read'])
    expect(publish).not.toHaveBeenCalled()
    expect(db.putItemWithConditions).not.toHaveBeenCalled()
    expect(f.session.put).not.toHaveBeenCalled()
  })
})
