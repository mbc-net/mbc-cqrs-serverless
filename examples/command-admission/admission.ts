import { AsyncLocalStorage } from 'node:async_hooks'

import { ConditionCheck } from '@aws-sdk/client-dynamodb'
import {
  CommandModel,
  CommandModule,
  CommandService,
  DynamoDbService,
} from '@mbc-cqrs-serverless/core'
import { Inject, Injectable, ModuleMetadata } from '@nestjs/common'

const WITNESS_TABLE = Symbol('configuration witness table')
interface Witness {
  readonly tenant: string
  readonly generation: number
}

export const configurationKey = (tenant: string) => ({
  pk: `TENANT#${tenant}`,
  sk: 'CONFIG#main',
})
export const gateKey = (tenant: string) => ({
  pk: `TENANT#${tenant}`,
  sk: 'CONFIGURATION_ADMISSION',
})

// Internal server provider: never bind this context to a request DTO or header.
@Injectable()
export class ConfigurationAdmission {
  private readonly storage = new AsyncLocalStorage<Readonly<Witness>>()

  constructor(
    private readonly db: DynamoDbService,
    @Inject(WITNESS_TABLE) readonly tableName: string,
  ) {}

  async capture<T>(tenant: string, work: () => Promise<T>): Promise<T> {
    const gate = await this.db.getItem(this.tableName, gateKey(tenant), {
      consistentRead: true,
    })
    if (
      gate?.active !== true ||
      gate?.mode !== 'normal' ||
      !Number.isSafeInteger(gate?.generation) ||
      gate.generation < 0
    ) {
      throw new Error('Configuration updates are unavailable')
    }
    return this.storage.run(
      Object.freeze({ tenant, generation: gate.generation }),
      work,
    )
  }

  get witness(): Readonly<Witness> | undefined {
    return this.storage.getStore()
  }
}

@Injectable()
export class ConfigurationCommands extends CommandService {
  @Inject(ConfigurationAdmission)
  private readonly admission: ConfigurationAdmission

  protected async getCommandAdmissionConditions(
    command: Readonly<CommandModel>,
  ): Promise<ConditionCheck[]> {
    // Classify by the server-owned resource key, never a client-supplied flag.
    // The hook sees versioned keys, for example CONFIG#main@13.
    if (!command.sk.startsWith('CONFIG#')) return []
    const witness = this.admission.witness
    if (!witness) throw new Error('Missing server admission witness')
    if (
      command.pk !== `TENANT#${witness.tenant}` ||
      command.tenantCode !== witness.tenant
    ) {
      throw new Error('Admission witness tenant mismatch')
    }
    // No reads here: refreshing the generation would reauthorize old work.
    return [
      {
        TableName: this.admission.tableName,
        Key: {
          pk: { S: gateKey(witness.tenant).pk },
          sk: { S: gateKey(witness.tenant).sk },
        },
        ConditionExpression:
          '#active = :active AND #mode = :normal AND #generation = :generation',
        ExpressionAttributeNames: {
          '#active': 'active',
          '#mode': 'mode',
          '#generation': 'generation',
        },
        ExpressionAttributeValues: {
          ':active': { BOOL: true },
          ':normal': { S: 'normal' },
          ':generation': { N: String(witness.generation) },
        },
      },
    ]
  }
}

// Extend the SAME dynamic module so its event handler and Repository resolve
// this replacement too. Nest inherits the base constructor injection metadata.
export function configurationCommandModule(
  tableName: string,
  witnessTableName: string,
  infrastructureImports: NonNullable<ModuleMetadata['imports']> = [],
) {
  const registered = CommandModule.register({ tableName })
  return {
    ...registered,
    imports: [...(registered.imports ?? []), ...infrastructureImports],
    providers: [
      ...(registered.providers ?? []),
      { provide: WITNESS_TABLE, useValue: witnessTableName },
      ConfigurationAdmission,
      { provide: CommandService, useClass: ConfigurationCommands },
    ],
    exports: [...(registered.exports ?? []), ConfigurationAdmission],
  }
}
