import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  ListTablesCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { spawn } from 'child_process'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { createServer } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import { inspect } from 'util'

import { DynamoDbService } from '../src/data-store/dynamodb.service'
import { SessionService } from '../src/data-store/session.service'
import { CommandService } from '../src/commands/command.service'
import { TableType } from '../src/commands/enums'
import { TtlService } from '../src/commands/ttl.service'

/** Actual SDK, core services and isolated DynamoDB Local; no application data. */
describe('strict inline publication on real DynamoDB', () => {
  const safety = { profile: 'strict-inline-v1' as const }
  const marker = 'synthetic-sensitive-value'
  const tenant = 'synthetic-sensitive-tenant'
  const actor = 'synthetic-sensitive-actor'
  let directory: string
  let processHandle: ReturnType<typeof spawn>
  let native: DynamoDBClient
  let dynamo: DynamoDbService
  let commands: CommandService
  let commandTable: string
  let masterTable: string
  let sessionTable: string
  let closeProcess: Promise<void>
  const tables: string[] = []
  const requests: Array<{ operation: string; input: any }> = []
  const logs: unknown[][] = []
  let hook:
    | ((
        operation: string,
        input: any,
        forward: () => Promise<any>,
      ) => Promise<any>)
    | undefined
  const priorEnv = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
    AWS_EC2_METADATA_DISABLED: process.env.AWS_EC2_METADATA_DISABLED,
    AWS_PROFILE: process.env.AWS_PROFILE,
    AWS_SHARED_CREDENTIALS_FILE: process.env.AWS_SHARED_CREDENTIALS_FILE,
    AWS_CONFIG_FILE: process.env.AWS_CONFIG_FILE,
  }
  const s3 = {
    getItem: jest.fn(async () => {
      throw new Error('S3 is prohibited by this fixture')
    }),
    putItem: jest.fn(async () => {
      throw new Error('S3 is prohibited by this fixture')
    }),
  }
  const invoke = {
    event: {
      requestContext: {
        http: { sourceIp: '127.0.0.1' },
        authorizer: { jwt: { claims: { sub: actor } } },
      },
    },
    context: { awsRequestId: 'synthetic-request' },
  } as any
  function input(code: string, attributes: any = { value: marker }): any {
    return {
      pk: `ASSET#${tenant}`,
      sk: code,
      tenantCode: tenant,
      type: 'ASSET',
      id: `ASSET#${tenant}#${code}`,
      code,
      name: 'Synthetic fixture',
      version: 0,
      attributes,
    }
  }
  function commandPuts(): number {
    return requests.filter(
      ({ operation, input: request }) =>
        (operation === 'PutItem' && request.TableName === commandTable) ||
        (operation === 'TransactWriteItems' &&
          request.TransactItems?.some(
            (item: any) => item.Put?.TableName === commandTable,
          )),
    ).length
  }
  function transportFault() {
    return Object.assign(new Error(marker), { code: 'ECONNRESET' })
  }
  async function readCommand(code: string, version = 1) {
    const result = await native.send(
      new GetItemCommand({
        TableName: commandTable,
        Key: { pk: { S: `ASSET#${tenant}` }, sk: { S: `${code}@${version}` } },
        ConsistentRead: true,
      }),
    )
    return result.Item ? unmarshall(result.Item) : undefined
  }
  beforeAll(async () => {
    const home = process.env.STRICT_INLINE_DYNAMODB_HOME
    if (!home || !existsSync(join(home, 'DynamoDBLocal.jar'))) {
      throw new Error('STRICT_INLINE_DYNAMODB_HOME must name DynamoDB Local')
    }
    for (const method of [
      'debug',
      'log',
      'warn',
      'error',
      'verbose',
    ] as const) {
      jest.spyOn(Logger.prototype, method).mockImplementation((...args) => {
        logs.push(args)
      })
    }
    process.env.AWS_ACCESS_KEY_ID = 'local'
    process.env.AWS_SECRET_ACCESS_KEY = 'local'
    delete process.env.AWS_SESSION_TOKEN
    process.env.AWS_EC2_METADATA_DISABLED = 'true'
    process.env.AWS_PROFILE = ''
    process.env.AWS_SHARED_CREDENTIALS_FILE = '/dev/null'
    process.env.AWS_CONFIG_FILE = '/dev/null'
    const port = await new Promise<number>((resolve, reject) => {
      const server = createServer()
      server.on('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        const selected = typeof address === 'object' && address?.port
        server.close((error) => {
          if (error || !selected) reject(error ?? new Error('No local port'))
          else resolve(selected)
        })
      })
    })
    directory = mkdtempSync(join(tmpdir(), 'strict-inline-ddb-'))
    processHandle = spawn(
      'java',
      [
        `-Djava.library.path=${join(home, 'DynamoDBLocal_lib')}`,
        '-jar',
        join(home, 'DynamoDBLocal.jar'),
        '-inMemory',
        '-sharedDb',
        '-port',
        String(port),
      ],
      { cwd: directory, stdio: 'ignore' },
    )
    closeProcess = new Promise((resolve) =>
      processHandle.once('close', resolve),
    )
    const endpoint = `http://127.0.0.1:${port}`
    native = new DynamoDBClient({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      maxAttempts: 1,
    })
    const deadline = Date.now() + 20000
    while (true) {
      try {
        await native.send(new ListTablesCommand({}))
        break
      } catch {
        if (Date.now() > deadline || processHandle.exitCode !== null) {
          throw new Error('Isolated DynamoDB Local did not start')
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
    const config = new ConfigService({
      NODE_ENV: 'test',
      APP_NAME: `strict-inline-${process.pid}-${Date.now()}`,
      DYNAMODB_ENDPOINT: endpoint,
      DYNAMODB_REGION: 'us-east-1',
      ATTRIBUTE_LIMIT_SIZE: 256 * 1024,
      RYW_SESSION_TTL_MINUTES: '5',
    })
    // The cast keeps the initial RED behavioral rather than a missing-type error.
    dynamo = new (DynamoDbService as any)(config, s3, safety)
    commandTable = dynamo.getTableName('fixture', TableType.COMMAND)
    masterTable = dynamo.getTableName('master', TableType.DATA)
    sessionTable = `${config.get('NODE_ENV')}-${config.get('APP_NAME')}-session`
    for (const TableName of [commandTable, masterTable, sessionTable]) {
      await native.send(
        new CreateTableCommand({
          TableName,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' },
          ],
        }),
      )
      tables.push(TableName)
    }
    const handler = dynamo.client.config.requestHandler
    const handle = handler.handle.bind(handler)
    jest
      .spyOn(handler, 'handle')
      .mockImplementation(async (request: any, options) => {
        const operation = String(request.headers['x-amz-target'])
          .split('.')
          .pop()!
        const body = JSON.parse(Buffer.from(request.body).toString('utf8'))
        requests.push({ operation, input: body })
        const forward = () => handle(request, options)
        return hook ? hook(operation, body, forward) : forward()
      })
    const ttl = new TtlService({ tableName: 'fixture', safety } as any, dynamo)
    const session = new SessionService(dynamo, config)
    commands = new CommandService(
      { tableName: 'fixture', safety } as any,
      dynamo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        getItem: () => {
          throw new Error('Projection prohibited')
        },
      } as any,
      ttl,
      {} as any,
      session,
    )
  }, 30000)
  beforeEach(() => {
    hook = undefined
    requests.length = 0
    logs.length = 0
  })
  afterEach(() => {
    // Error.message/cause are non-enumerable, so JSON alone misses raw errors.
    const serialized = inspect(logs, { depth: null })
    expect(serialized.includes(marker)).toBe(false)
    expect(serialized.includes(tenant)).toBe(false)
    expect(serialized.includes(actor)).toBe(false)
    expect(s3.getItem).not.toHaveBeenCalled()
    expect(s3.putItem).not.toHaveBeenCalled()
  })
  afterAll(async () => {
    hook = undefined
    try {
      for (const TableName of tables) {
        await native.send(new DeleteTableCommand({ TableName }))
      }
    } finally {
      if (dynamo) {
        const lifecycle = (dynamo as any).onModuleDestroy
        if (lifecycle) lifecycle.call(dynamo)
        else dynamo.client.destroy()
      }
      native?.destroy()
      if (processHandle) {
        processHandle.kill('SIGTERM')
        const timer = setTimeout(() => processHandle.kill('SIGKILL'), 3000)
        await closeProcess
        clearTimeout(timer)
      }
      if (directory) rmSync(directory, { recursive: true, force: true })
      for (const [key, value] of Object.entries(priorEnv)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      jest.restoreAllMocks()
    }
  }, 15000)

  it('persists with real TTL lookup and enabled real RYW, using one SDK attempt', async () => {
    expect(await dynamo.client.config.maxAttempts()).toBe(1)
    const result = await commands.publishAsync(input('normal'), {
      invokeContext: invoke,
    })
    expect(result?.version).toBe(1)
    expect(commandPuts()).toBe(1)
    expect(
      requests.some(
        ({ operation, input: body }) =>
          operation === 'GetItem' && body.TableName === masterTable,
      ),
    ).toBe(true)
    expect(
      requests.some(
        ({ operation, input: body }) =>
          operation === 'PutItem' && body.TableName === sessionTable,
      ),
    ).toBe(true)
    expect((await readCommand('normal'))?.attributes).toEqual({ value: marker })
  })
  it('does not replay an accepted command when its native Put response is lost', async () => {
    hook = async (operation, body, forward) => {
      const output = await forward()
      if (operation === 'PutItem' && body.TableName === commandTable)
        throw transportFault()
      return output
    }
    await expect(
      commands.publishAsync(input('lost-command'), { invokeContext: invoke }),
    ).rejects.toThrow()
    expect(commandPuts()).toBe(1)
    expect((await readCommand('lost-command'))?.version).toBe(1)
    expect(
      requests.some(({ input: body }) => body.TableName === sessionTable),
    ).toBe(false)
  })
  it('uses the explicit native version for no-op and subsequent update', async () => {
    const body = input('explicit-update')
    await commands.publishAsync(body, { invokeContext: invoke })
    requests.length = 0
    const noop = await commands.publishAsync(
      { ...body, version: 1 },
      { invokeContext: invoke },
    )
    expect(noop).toBeNull()
    expect(commandPuts()).toBe(0)
    expect(
      requests.some(
        ({ operation, input: request }) =>
          operation === 'GetItem' &&
          request.TableName === commandTable &&
          request.ConsistentRead === true &&
          request.Key.sk.S === 'explicit-update@1',
      ),
    ).toBe(true)
    const updated = await commands.publishAsync(
      { ...body, version: 1, attributes: { value: `${marker}-updated` } },
      { invokeContext: invoke },
    )
    expect(updated?.version).toBe(2)
    expect(commandPuts()).toBe(1)
    expect((await readCommand('explicit-update', 2))?.attributes).toEqual({
      value: `${marker}-updated`,
    })
  })
  it('stops before command Put when the real TTL lookup is unconfirmed', async () => {
    hook = async (operation, body, forward) => {
      if (operation === 'GetItem' && body.TableName === masterTable)
        throw transportFault()
      return forward()
    }
    await expect(
      commands.publishAsync(input('lost-ttl'), { invokeContext: invoke }),
    ).rejects.toThrow()
    expect(commandPuts()).toBe(0)
    expect(await readCommand('lost-ttl')).toBeUndefined()
  })
  it('keeps post-Put RYW uncertainty nonfatal without replaying the command', async () => {
    hook = async (operation, body, forward) => {
      const output = await forward()
      if (operation === 'PutItem' && body.TableName === sessionTable)
        throw transportFault()
      return output
    }
    const result = await commands.publishAsync(input('lost-session'), {
      invokeContext: invoke,
    })
    expect(result?.version).toBe(1)
    expect(commandPuts()).toBe(1)
    expect(
      requests.filter(
        ({ operation, input: body }) =>
          operation === 'PutItem' && body.TableName === sessionTable,
      ),
    ).toHaveLength(1)
    expect((await readCommand('lost-session'))?.version).toBe(1)
  })
  it('rejects excessive inline attributes without a command Put or S3 request', async () => {
    await expect(
      commands.publishAsync(
        input('too-large', { value: 'x'.repeat(128 * 1024) }),
        {
          invokeContext: invoke,
        },
      ),
    ).rejects.toThrow()
    expect(commandPuts()).toBe(0)
    expect(await readCommand('too-large')).toBeUndefined()
  })
  it('rejects a native S3 reference before invoking the S3 reader', async () => {
    await native.send(
      new PutItemCommand({
        TableName: commandTable,
        Item: {
          pk: { S: `ASSET#${tenant}` },
          sk: { S: 's3-reference@1' },
          attributes: { S: 's3://synthetic-bucket/synthetic-key' },
        },
      }),
    )
    await expect(
      commands.getItem({ pk: `ASSET#${tenant}`, sk: 's3-reference@1' }),
    ).rejects.toThrow()
    expect(commandPuts()).toBe(0)
  })
  it('preserves the fixed conditional-conflict category without overwriting a native command', async () => {
    const body = input('duplicate-version')
    await commands.publishAsync(body, { invokeContext: invoke })
    requests.length = 0
    await expect(
      commands.publishAsync(
        { ...body, attributes: { value: `${marker}-replacement` } },
        { invokeContext: invoke },
      ),
    ).rejects.toMatchObject({ name: 'ConditionalCheckFailedException' })
    expect(commandPuts()).toBe(1)
    expect((await readCommand('duplicate-version'))?.attributes).toEqual({
      value: marker,
    })
  })
})
