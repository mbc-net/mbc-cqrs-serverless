import { Global, Module, Logger } from '@nestjs/common'

import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { DynamoDbService } from '../data-store/dynamodb.service'
import { S3Service } from '../data-store/s3.service'
import { SessionService } from '../data-store/session.service'
import { SnsService } from '../queue/sns.service'
import * as context from '../context/user'
import { CommandModule } from './command.module'
import { CommandService } from './command.service'

describe('strict inline command contract', () => {
  const safety = { profile: 'strict-inline-v1' }
  const token = Symbol('owned transport')
  const options = { tableName: 'ledger', safety, strictDataStoreToken: token }
  const input = {
    pk: 'TENANT#test',
    sk: 'ASSET#one',
    version: 0,
    id: 'id',
    code: 'one',
    name: 'name',
    tenantCode: 'test',
    type: 'ASSET',
    attributes: { credential: 'synthetic-private-marker' },
  }

  function fixture() {
    const supplied = { ...options, safety: { ...safety } }
    const dynamo = {
      isStrictInline: true,
      getTableName: () => 'test-ledger-command',
      putItemWithConditions: jest.fn().mockResolvedValue(undefined),
      getItem: jest.fn().mockResolvedValue(null),
    }
    const sessions = {
      put: jest.fn().mockRejectedValue(new Error('synthetic-error-marker')),
    }
    const service = new CommandService(
      supplied as any,
      dynamo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { calculateTtl: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      sessions as any,
    )
    return { service, dynamo, supplied }
  }

  afterEach(() => jest.restoreAllMocks())

  it('keeps the boot profile after the caller mutates its options', async () => {
    const { service, supplied } = fixture()
    delete (supplied as any).safety
    await expect(
      service.getLatestItem({ pk: input.pk, sk: input.sk }),
    ).rejects.toThrow('Method is not supported')
  })

  it('snapshots registration options before instantiating providers', () => {
    const supplied = { ...options, safety: { ...safety } }
    const module = CommandModule.register(supplied as any)
    delete (supplied as any).safety
    const factory = module.providers.find(
      (provider: any) => provider.provide === DynamoDbService,
    ) as any
    const store = factory.useFactory(
      new ConfigService({ DYNAMODB_REGION: 'us-east-1' }),
      {},
    )
    try {
      expect(store.isStrictInline).toBe(true)
    } finally {
      store.onModuleDestroy()
    }
  })

  it('isolates two named domain transports from the shared provider', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    const config = new ConfigService({
      NODE_ENV: 'test',
      APP_NAME: 'fixture',
      DYNAMODB_ENDPOINT: 'http://127.0.0.1:1',
      DYNAMODB_REGION: 'us-east-1',
      RYW_SESSION_TTL_MINUTES: '1',
    })
    const shared = { isStrictInline: false }
    @Global()
    @Module({
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: S3Service, useValue: {} },
        { provide: SnsService, useValue: {} },
        { provide: DynamoDbService, useValue: shared },
        { provide: SessionService, useValue: {} },
      ],
      exports: [
        ConfigService,
        S3Service,
        SnsService,
        DynamoDbService,
        SessionService,
      ],
    })
    class SharedServices {}
    const otherToken = Symbol('other domain')
    const first = CommandModule.register(options as any)
    const second = CommandModule.register({
      ...options,
      tableName: 'other',
      strictDataStoreToken: otherToken,
    } as any)
    const container = await Test.createTestingModule({
      imports: [SharedServices, first, second],
    }).compile()
    try {
      await container.init()
      const one = container.get<DynamoDbService>(token)
      const two = container.get<DynamoDbService>(otherToken)
      expect(one).not.toBe(two)
      expect(one.isStrictInline).toBe(true)
      expect(two.isStrictInline).toBe(true)
      expect(await one.client.config.maxAttempts()).toBe(1)
      expect(await two.client.config.maxAttempts()).toBe(1)
      expect(
        container.select(SharedServices).get(DynamoDbService, { strict: true }),
      ).toBe(shared)
      expect(first.exports).toEqual([CommandService, token])
    } finally {
      await container.close()
    }
  })

  it('requires a named domain transport token', () => {
    expect(() =>
      CommandModule.register({ tableName: 'ledger', safety } as any),
    ).toThrow()
  })
  it('rejects malformed and partial profiles at registration', () => {
    expect(() =>
      CommandModule.register({ ...options, safety: {} } as any),
    ).toThrow()
    expect(() =>
      CommandModule.register({ ...options, safety: null } as any),
    ).toThrow()
    expect(() =>
      CommandModule.register({
        tableName: 'ledger',
        strictDataStoreToken: token,
      } as any),
    ).toThrow()
  })
  it.each([-1, undefined, NaN, 1.1])(
    'rejects non-explicit version before I/O (%s)',
    async (version) => {
      const { service, dynamo } = fixture()
      await expect(
        service.publishAsync({ ...input, version } as any, {} as any),
      ).rejects.toThrow()
      expect(dynamo.getItem).not.toHaveBeenCalled()
      expect(dynamo.putItemWithConditions).not.toHaveBeenCalled()
    },
  )
  it('rejects unsupported latest lookup before projection access', async () => {
    const { service } = fixture()
    await expect(
      service.getLatestItem({ pk: input.pk, sk: input.sk }),
    ).rejects.toThrow()
  })
  it('forces explicit command reads to be strongly consistent', async () => {
    const { service, dynamo } = fixture()
    await service.getItem(
      { pk: input.pk, sk: input.sk + '@1' },
      { consistentRead: false },
    )
    expect(dynamo.getItem).toHaveBeenCalledWith(
      'test-ledger-command',
      { pk: input.pk, sk: input.sk + '@1' },
      { consistentRead: true },
    )
  })
  it.each([
    null,
    { pk: 'p', sk: {} },
    Object.defineProperty({ pk: 'p' }, 'sk', {
      get() {
        throw new Error('synthetic-error-marker')
      },
    }),
  ])('rejects malformed key without leaking error text', async (key) => {
    const { service, dynamo } = fixture()
    try {
      await service.getItem(key as any)
      throw new Error('unexpected success')
    } catch (error) {
      expect(String(error).includes('synthetic-error-marker')).toBe(false)
    }
    expect(dynamo.getItem).not.toHaveBeenCalled()
  })
  it('does not invoke an input sort-key accessor or expose its error', async () => {
    const { service, dynamo } = fixture()
    const getter = jest.fn(() => {
      throw new Error('synthetic-error-marker')
    })
    const raw = Object.defineProperty({ ...input }, 'sk', { get: getter })
    await expect(service.publishAsync(raw, {} as any)).rejects.toThrow(
      'Invalid strict inline command',
    )
    expect(getter).not.toHaveBeenCalled()
    expect(dynamo.putItemWithConditions).not.toHaveBeenCalled()
  })
  it('does not pass payload or non-fatal RYW errors to the logger', async () => {
    jest
      .spyOn(context, 'getUserContext')
      .mockReturnValue({ userId: 'synthetic-user' } as any)
    const debug = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => {})
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {})
    const { service, dynamo } = fixture()
    await expect(service.publishAsync(input, {} as any)).resolves.toMatchObject(
      { version: 1 },
    )
    expect(dynamo.putItemWithConditions).toHaveBeenCalledTimes(1)
    const logs = JSON.stringify([debug.mock.calls, warn.mock.calls])
    expect(logs.includes('synthetic-private-marker')).toBe(false)
    expect(logs.includes('synthetic-error-marker')).toBe(false)
  })
})
