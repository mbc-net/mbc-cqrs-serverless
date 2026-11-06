import { ConditionCheck } from '@aws-sdk/client-dynamodb'
import { createMock } from '@golevelup/ts-jest'
import { ModuleRef } from '@nestjs/core'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { SessionService } from '../data-store/session.service'
import { CommandModel } from '../interfaces'
import { ICommandOptions } from '../interfaces/command.options.interface'
import { SnsService } from '../queue/sns.service'
import { ExplorerService } from '../services'
import { CommandService } from './command.service'
import { DataService } from './data.service'
import { DataSyncDdsHandler } from './handlers/data-sync-dds.handler'
import { HistoryService } from './history.service'
import { TtlService } from './ttl.service'

class AdmittedCommands extends CommandService {
  readonly admission = jest
    .fn<Promise<ConditionCheck[]>, [Readonly<CommandModel>, ICommandOptions]>()
    .mockResolvedValue([])
  protected getCommandAdmissionConditions(
    command: Readonly<CommandModel>,
    options: ICommandOptions,
  ): Promise<ConditionCheck[]> {
    return this.admission(command, options)
  }
}
const witness: ConditionCheck = {
  TableName: 'witness',
  Key: { pk: { S: 'tenant' } },
  ConditionExpression: 'attribute_exists(pk)',
}
const input = {
  pk: 'TENANT#tenant',
  sk: 'item',
  id: 'id',
  code: 'code',
  name: 'changed',
  tenantCode: 'tenant',
  type: 'item',
  version: 1,
}
const options: ICommandOptions = {
  requestId: 'request',
  source: 'server',
  invokeContext: {
    event: {
      requestContext: { authorizer: { jwt: { claims: { sub: 'user' } } } },
    },
  } as ICommandOptions['invokeContext'],
}

describe('command admission boundary', () => {
  let service: AdmittedCommands
  let db: ReturnType<typeof createMock<DynamoDbService>>
  let data: ReturnType<typeof createMock<DataService>>
  let history: ReturnType<typeof createMock<HistoryService>>
  let session: ReturnType<typeof createMock<SessionService>>
  beforeEach(() => {
    db = createMock<DynamoDbService>({ getTableName: () => 'commands' })
    data = createMock<DataService>({
      getItem: async () => ({ ...input, name: 'old' }),
    })
    history = createMock<HistoryService>()
    session = createMock<SessionService>()
    db.getItem.mockImplementation(async () => ({
      ...input,
      name: 'old',
      sk: 'item@1',
    }))
    service = new AdmittedCommands(
      { tableName: 'items' },
      db,
      createMock<ExplorerService>(),
      createMock<ModuleRef>(),
      createMock<SnsService>(),
      createMock<DataSyncDdsHandler>(),
      data,
      createMock<TtlService>({ calculateTtl: async () => 123 }),
      history,
      session,
    )
    jest
      .spyOn(service, 'getLatestItem')
      .mockResolvedValue({ ...input, name: 'old', sk: 'item@1' })
    jest.spyOn(service, 'updateStatus').mockResolvedValue(undefined)
  })
  const paths = [
    'publishSync',
    'publishAsync',
    'duplicate',
    'publishPartialUpdateSync',
    'publishPartialUpdateAsync',
  ] as const
  it.each(paths)(
    '%s admits exactly the persisted version and options',
    async (path) => {
      service.admission.mockResolvedValue([witness])
      await service[path](input, options)
      expect(service.admission).toHaveBeenCalledTimes(1)
      expect(service.admission).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: input.pk,
          sk: 'item@2',
          version: 2,
          requestId: 'request',
          source: path === 'duplicate' ? 'duplicated' : 'server',
        }),
        options,
      )
      expect(db.putItemWithConditions).toHaveBeenCalledWith(
        'commands',
        expect.objectContaining({ sk: 'item@2', version: 2 }),
        'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        [witness],
      )
    },
  )
  it.each(paths)(
    '%s stops all downstream writes on admission failure',
    async (path) => {
      const error = new Error('admission denied')
      service.admission.mockRejectedValue(error)
      await expect(service[path](input, options)).rejects.toBe(error)
      expect(db.putItemWithConditions).not.toHaveBeenCalled()
      expect(db.putItem).not.toHaveBeenCalled()
      expect(data.publish).not.toHaveBeenCalled()
      expect(history.publish).not.toHaveBeenCalled()
      expect(session.put).not.toHaveBeenCalled()
      expect(service.updateStatus).not.toHaveBeenCalled()
    },
  )
  it.each(paths)(
    '%s stops downstream writes on transaction failure',
    async (path) => {
      service.admission.mockResolvedValue([witness])
      const error = new Error('TransactionCanceledException')
      db.putItemWithConditions.mockRejectedValue(error)
      await expect(service[path](input, options)).rejects.toBe(error)
      expect(db.putItem).not.toHaveBeenCalled()
      expect(db.updateItem).not.toHaveBeenCalled()
      expect(data.publish).not.toHaveBeenCalled()
      expect(history.publish).not.toHaveBeenCalled()
      expect(session.put).not.toHaveBeenCalled()
      expect(service.updateStatus).not.toHaveBeenCalled()
    },
  )
  it.each(paths)(
    '%s preserves the default empty admission contract',
    async (path) => {
      service.admission.mockImplementation((command, opts) =>
        CommandService.prototype['getCommandAdmissionConditions'].call(
          service,
          command,
          opts,
        ),
      )
      await service[path](input, options)
      expect(db.putItemWithConditions).toHaveBeenCalledWith(
        'commands',
        expect.any(Object),
        'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        [],
      )
    },
  )
  it('writes the async session only after acceptance', async () => {
    service.admission.mockResolvedValue([witness])
    await service.publishAsync(input, options)
    expect(session.put).toHaveBeenCalledWith('user', 'tenant', 'items', 'id', 2)
    expect(db.putItemWithConditions.mock.invocationCallOrder[0]).toBeLessThan(
      session.put.mock.invocationCallOrder[0],
    )
  })
  it('does not consult admission when draining accepted commands or updating TTL/task tokens', async () => {
    service.admission.mockRejectedValue(new Error('closed'))
    await service.updateTtl({ pk: input.pk, sk: 'item@2' })
    await service.updateTaskToken({ pk: input.pk, sk: 'item@2' }, 'token')
    await service.getNextCommand({ pk: input.pk, sk: 'item@1' })
    expect(db.putItem).toHaveBeenCalledWith(
      'commands',
      expect.objectContaining({ sk: 'item@1', ttl: 123 }),
    )
    expect(db.getItem).toHaveBeenLastCalledWith(
      'commands',
      { pk: input.pk, sk: 'item@2' },
      { consistentRead: true },
    )
    expect(service.admission).not.toHaveBeenCalled()
  })
  it('runs TTL/history/data/status only after admission succeeds', async () => {
    service.admission.mockResolvedValue([witness])
    await service.publishSync(input, options)
    expect(db.putItemWithConditions.mock.invocationCallOrder[0]).toBeLessThan(
      db.putItem.mock.invocationCallOrder[0],
    )
    expect(db.putItem.mock.invocationCallOrder[0]).toBeLessThan(
      history.publish.mock.invocationCallOrder[0],
    )
    expect(history.publish.mock.invocationCallOrder[0]).toBeLessThan(
      data.publish.mock.invocationCallOrder[0],
    )
    expect(service.updateStatus).toHaveBeenCalledTimes(1)
  })
})
