import { Logger, ServiceUnavailableException } from '@nestjs/common'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { TableType } from './enums'
import { TtlService } from './ttl.service'

describe('TtlService strict inline boundary', () => {
  const marker = 'synthetic-private-ttl'
  let logs: jest.SpyInstance[]
  let dynamo: {
    isStrictInline: boolean
    getTableName: jest.Mock
    getItem: jest.Mock
  }
  let service: TtlService

  beforeEach(() => {
    logs = ['debug', 'log', 'warn', 'error', 'verbose'].map((method) =>
      jest.spyOn(Logger.prototype, method as 'debug').mockImplementation(),
    )
    dynamo = {
      isStrictInline: true,
      getTableName: jest.fn().mockReturnValue('synthetic-table'),
      getItem: jest.fn(),
    }
    service = new TtlService(
      { tableName: marker },
      dynamo as unknown as DynamoDbService,
    )
  })

  afterEach(() => jest.restoreAllMocks())

  it('uses a fixed logger context in strict mode', () => {
    expect((service as any).logger.context === 'TtlService:strict-inline').toBe(
      true,
    )
  })

  it('stops on read failure without passing raw errors to the logger', async () => {
    dynamo.getItem.mockRejectedValue(new Error(marker))
    let failure: unknown
    try {
      await service.getTtlConfiguration(TableType.DATA, marker)
    } catch (error) {
      failure = error
    }
    expect(failure instanceof ServiceUnavailableException).toBe(true)
    expect(
      (failure as Error)?.message === 'TTL configuration is unavailable',
    ).toBe(true)
    expect(
      logs.some((spy) =>
        spy.mock.calls.some((args) =>
          args.some(
            (arg) => arg instanceof Error || String(arg).includes(marker),
          ),
        ),
      ),
    ).toBe(false)
  })

  it('allows an acknowledged missing configuration', async () => {
    dynamo.getItem.mockResolvedValue(null)
    await expect(
      service.calculateTtl(TableType.DATA, marker),
    ).resolves.toBeNull()
    expect(dynamo.getItem).toHaveBeenCalledTimes(1)
  })

  it.each([
    undefined,
    null,
    '17',
    'invalid',
    NaN,
    Infinity,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects malformed or unsafe days (case %#)', async (days) => {
    dynamo.getItem.mockResolvedValue({ attributes: { days } })
    let failure: unknown
    try {
      await service.calculateTtl(TableType.DATA, marker)
    } catch (error) {
      failure = error
    }
    expect(failure instanceof ServiceUnavailableException).toBe(true)
  })

  it('rejects a missing attributes object on an existing row', async () => {
    dynamo.getItem.mockResolvedValue({ pk: 'synthetic-key' })
    let failure: unknown
    try {
      await service.calculateTtl(TableType.DATA, marker)
    } catch (error) {
      failure = error
    }
    expect(failure instanceof ServiceUnavailableException).toBe(true)
  })

  it('rejects an unsafe computed timestamp', async () => {
    dynamo.getItem.mockResolvedValue({
      attributes: { days: Number.MAX_SAFE_INTEGER },
    })
    let failure: unknown
    try {
      await service.calculateTtl(TableType.DATA, marker, new Date(0))
    } catch (error) {
      failure = error
    }
    expect(failure instanceof ServiceUnavailableException).toBe(true)
  })

  it('rejects an invalid start date', async () => {
    dynamo.getItem.mockResolvedValue({ attributes: { days: 17 } })
    let failure: unknown
    try {
      await service.calculateTtl(TableType.DATA, marker, new Date(NaN))
    } catch (error) {
      failure = error
    }
    expect(failure instanceof ServiceUnavailableException).toBe(true)
  })

  it('does not log configuration values', async () => {
    dynamo.getItem.mockResolvedValue({ attributes: { days: 17 } })
    await expect(
      service.calculateTtl(TableType.DATA, marker, new Date(0)),
    ).resolves.toBe(17 * 86400)
    expect(
      logs.every((spy) =>
        spy.mock.calls.every(
          (args) => args.length === 1 && typeof args[0] === 'string',
        ),
      ),
    ).toBe(true)
  })

  it('preserves legacy read-error behavior', async () => {
    dynamo.isStrictInline = false
    dynamo.getItem.mockRejectedValue(new Error(marker))
    await expect(
      service.getTtlConfiguration(TableType.DATA),
    ).resolves.toBeNull()
    expect(
      logs.some((spy) =>
        spy.mock.calls.some((args) => args[1] instanceof Error),
      ),
    ).toBe(true)
  })
})
