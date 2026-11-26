import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { DynamoDbService } from './dynamodb.service'
import { SessionService } from './session.service'

describe('SessionService strict inline logs', () => {
  const marker = 'synthetic-private-session'
  let logs: jest.SpyInstance[]
  let dynamo: {
    isStrictInline: boolean
    putItem: jest.Mock
    deleteItem: jest.Mock
  }
  const config = (enabled: boolean) =>
    ({
      get: (key: string) =>
        ({
          NODE_ENV: marker,
          APP_NAME: marker,
          RYW_SESSION_TTL_MINUTES: enabled ? '5' : undefined,
        })[key],
    }) as ConfigService

  beforeEach(() => {
    logs = ['debug', 'log', 'warn', 'error', 'verbose'].map((method) =>
      jest.spyOn(Logger.prototype, method as 'debug').mockImplementation(),
    )
    dynamo = {
      isStrictInline: true,
      putItem: jest.fn().mockResolvedValue(undefined),
      deleteItem: jest.fn().mockRejectedValue(new Error(marker)),
    }
  })
  afterEach(() => jest.restoreAllMocks())

  it('logs fixed events for startup, writes, and nonfatal deletion failures', async () => {
    const service = new SessionService(
      dynamo as unknown as DynamoDbService,
      config(true),
    )
    await service.put(marker, marker, marker, marker, 1)
    await expect(
      service.delete(marker, marker, marker, marker),
    ).resolves.toBeUndefined()
    expect(dynamo.putItem).toHaveBeenCalledTimes(1)
    expect(
      logs.every((spy) =>
        spy.mock.calls.every(
          (args) =>
            args.length === 1 &&
            typeof args[0] === 'string' &&
            !args[0].includes(marker),
        ),
      ),
    ).toBe(true)
  })

  it('keeps disabled-session startup and skip logs free of values', async () => {
    const service = new SessionService(
      dynamo as unknown as DynamoDbService,
      config(false),
    )
    await service.put(marker, marker, marker, marker, 1)
    expect(dynamo.putItem).not.toHaveBeenCalled()
    expect(
      logs.every((spy) =>
        spy.mock.calls.every(
          (args) =>
            args.length === 1 &&
            typeof args[0] === 'string' &&
            !args[0].includes(marker),
        ),
      ),
    ).toBe(true)
  })

  it('propagates write failure without retry or session-level error logging', async () => {
    dynamo.putItem.mockRejectedValue(new Error(marker))
    const service = new SessionService(
      dynamo as unknown as DynamoDbService,
      config(true),
    )
    let failed = false
    try {
      await service.put(marker, marker, marker, marker, 1)
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
    expect(dynamo.putItem).toHaveBeenCalledTimes(1)
    expect(
      logs.every((spy) =>
        spy.mock.calls.every(
          (args) =>
            args.length === 1 &&
            typeof args[0] === 'string' &&
            !args[0].includes(marker),
        ),
      ),
    ).toBe(true)
  })

  it('preserves legacy log behavior', async () => {
    dynamo.isStrictInline = false
    const service = new SessionService(
      dynamo as unknown as DynamoDbService,
      config(true),
    )
    await service.put(marker, marker, marker, marker, 1)
    expect(
      logs.some((spy) =>
        spy.mock.calls.some((args) => typeof args[1] === 'object'),
      ),
    ).toBe(true)
  })
})
