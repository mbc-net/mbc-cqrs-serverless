import { isDeepStrictEqual } from 'node:util'

import {
  ConditionalCheckFailedException,
  TransactionConflictException,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import {
  CommandInputModel,
  CommandService,
  CommandStatus,
  DataService,
  DynamoDbService,
  getCommandStatus,
  ICommandOptions,
  pickKeys,
} from '@mbc-cqrs-serverless/core'
import { Injectable } from '@nestjs/common'

import { ConfigurationAdmission, configurationKey, gateKey } from './admission'

type Attributes = Record<string, any>
type Transform = (attributes: Attributes) => Attributes | Promise<Attributes>
interface GateState {
  active: boolean
  mode: string
}

const NORMAL: GateState = { active: true, mode: 'normal' }
const MIGRATION: GateState = { active: false, mode: 'migration' }
const FINISHED = getCommandStatus('finish', CommandStatus.STATUS_FINISHED)
const MAX_ATTEMPTS = 5

// A migration changes only the attributes. This fails to compile if core adds an
// input field, so a new field cannot be dropped from migrated data unnoticed.
const INHERITED: Record<
  Exclude<keyof CommandInputModel, 'attributes'>,
  true
> = {
  pk: true,
  sk: true,
  id: true,
  code: true,
  name: true,
  version: true,
  tenantCode: true,
  type: true,
  isDeleted: true,
  seq: true,
  ttl: true,
}

// Compare in the stored format, as undefined members do not survive storage.
const stored = (attributes: Attributes) =>
  marshall(attributes ?? {}, {
    convertClassInstanceToMap: true,
    removeUndefinedValues: true,
  })
const sameStored = (left: Attributes, right: Attributes) =>
  isDeepStrictEqual(stored(left), stored(right))

// The example format change. Rerunning it on migrated data changes nothing.
export const toSchemaV2: Transform = (attributes) =>
  attributes.schemaVersion === 2
    ? attributes
    : { schemaVersion: 2, settings: { value: attributes.value } }

/**
 * Close -> wait for accepted work -> migrate -> verify -> reopen.
 *
 * Every failure leaves the gate closed. Run `migrate` again to resume, except
 * after a failed command, which needs the recovery steps in the README first.
 * Call this from one trusted controller at a time, never from a request path.
 */
@Injectable()
export class ConfigurationMigration {
  constructor(
    private readonly admission: ConfigurationAdmission,
    private readonly commands: CommandService,
    private readonly data: DataService,
    private readonly db: DynamoDbService,
  ) {}

  async migrate(
    tenant: string,
    options: ICommandOptions,
    transform: Transform = toSchemaV2,
  ): Promise<{ generation: number; migrated: boolean }> {
    const held = await this.holdGate(tenant)
    const current = await this.readDrained(tenant)
    let migrated = false
    // A deleted configuration stays deleted: a new command would revive it.
    if (current && !current.isDeleted) {
      // A copy, so a transform that edits its input is still seen as a change.
      const attributes = await transform(
        structuredClone(current.attributes ?? {}),
      )
      if (!sameStored(attributes, current.attributes)) {
        await this.admission.asMigration(tenant, held, () =>
          this.commands.publishSync(
            {
              ...pickKeys(current, Object.keys(INHERITED)),
              // Without a value, core would calculate a new default expiry.
              ttl: current.ttl ?? null,
              attributes,
            } as CommandInputModel,
            options,
          ),
        )
        await this.verify(tenant, attributes)
        migrated = true
      }
    }
    const generation = await this.moveGate(tenant, MIGRATION, NORMAL, held)
    return { generation, migrated }
  }

  private async holdGate(tenant: string): Promise<number> {
    const gate = await this.db.getItem(
      this.admission.tableName,
      gateKey(tenant),
      { consistentRead: true },
    )
    // A previous run failed after closing: keep the generation it holds.
    if (gate?.active === false && gate?.mode === MIGRATION.mode) {
      return gate.generation
    }
    return this.moveGate(tenant, NORMAL, MIGRATION)
  }

  /**
   * Commands accepted before the gate closed are still being processed by the
   * stream pipeline. Migrating now would let them overwrite migrated data, so
   * the data row must be at the latest command and that command must be finished.
   */
  private async readDrained(tenant: string) {
    const key = configurationKey(tenant)
    const current = await this.readData(tenant)
    const version = current?.version ?? 0
    const commandAt = (at: number) =>
      this.db.getItem(
        this.commands.tableName,
        { pk: key.pk, sk: `${key.sk}@${at}` },
        { consistentRead: true },
      )
    const newer = await commandAt(version + 1)
    const latest = newer ?? (version > 0 ? await commandAt(version) : undefined)
    if (latest?.status?.endsWith(`:${CommandStatus.STATUS_FAILED}`)) {
      // Waiting will not help: see the recovery steps in the README.
      throw new Error(
        `Configuration command failed: ${key.pk}@${latest.version}`,
      )
    }
    if (newer || (current && latest?.status !== FINISHED)) {
      // A crashed writer leaves this state forever, so show what to inspect.
      throw new Error(
        `Configuration commands have not drained: ${key.pk}` +
          `@${latest?.version ?? version} status=${latest?.status}`,
      )
    }
    return current
  }

  private async verify(tenant: string, attributes: Attributes): Promise<void> {
    const stored = await this.readData(tenant)
    if (!sameStored(stored?.attributes, attributes)) {
      throw new Error(
        `Migrated configuration did not verify: ${configurationKey(tenant).pk}`,
      )
    }
  }

  private readData(tenant: string) {
    return this.db.getItem(this.data.tableName, configurationKey(tenant), {
      consistentRead: true,
    })
  }

  // Every move advances the generation, which rejects requests holding an older one.
  private async moveGate(
    tenant: string,
    from: GateState,
    to: GateState,
    held?: number,
  ): Promise<number> {
    const key = gateKey(tenant)
    const command = new UpdateItemCommand({
      TableName: this.admission.tableName,
      Key: { pk: { S: key.pk }, sk: { S: key.sk } },
      UpdateExpression:
        'SET #active = :toActive, #mode = :toMode ADD #generation :one',
      ConditionExpression:
        '#active = :fromActive AND #mode = :fromMode' +
        (held === undefined ? '' : ' AND #generation = :held'),
      ExpressionAttributeNames: {
        '#active': 'active',
        '#mode': 'mode',
        '#generation': 'generation',
      },
      ExpressionAttributeValues: {
        ':fromActive': { BOOL: from.active },
        ':fromMode': { S: from.mode },
        ':toActive': { BOOL: to.active },
        ':toMode': { S: to.mode },
        ':one': { N: '1' },
        ...(held === undefined ? {} : { ':held': { N: String(held) } }),
      },
      ReturnValues: 'UPDATED_NEW',
    })
    for (let attempt = 1; ; attempt++) {
      try {
        const { Attributes } = await this.db.client.send(command)
        return Number(Attributes.generation.N)
      } catch (error) {
        // In-flight admission transactions that check this gate can block the
        // update, and the rejected update had no effect, so it is safe to retry.
        const retryable =
          error instanceof TransactionConflictException &&
          attempt < MAX_ATTEMPTS
        if (!retryable) {
          if (
            error instanceof ConditionalCheckFailedException ||
            error instanceof TransactionConflictException
          ) {
            // A lost response can also end here, so the move may have applied.
            throw Object.assign(
              new Error(
                `Could not move configuration gate from ${from.mode}` +
                  (held === undefined ? '' : ` at generation ${held}`) +
                  ` to ${to.mode}: ${key.pk}. Read the gate before acting.`,
              ),
              { cause: error },
            )
          }
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt))
      }
    }
  }
}
