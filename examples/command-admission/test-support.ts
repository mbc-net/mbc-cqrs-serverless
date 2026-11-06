import { createMock } from '@golevelup/ts-jest'
import {
  CommandService,
  DynamoDbService,
  SessionService,
} from '@mbc-cqrs-serverless/core'
import { TtlService } from '@mbc-cqrs-serverless/core/dist/commands/ttl.service'
import { Test } from '@nestjs/testing'

import { ConfigurationAdmission } from './admission'
import { ConfigurationApplication } from './application'
import { ConfigurationExampleModule } from './example.module'

// Only external infrastructure and TTL lookup are mocked. CommandModule,
// its event handler, inherited constructor and onModuleInit remain real.
export async function fixture(
  db: DynamoDbService,
  witnessTable = 'example-gates',
) {
  const session = createMock<SessionService>()
  const module = await Test.createTestingModule({
    imports: [
      ConfigurationExampleModule.register({
        tableName: 'settings',
        witnessTableName: witnessTable,
      }),
    ],
  })
    .overrideProvider(TtlService)
    .useValue({ calculateTtl: async () => null })
    .useMocker((token) => {
      if (token === DynamoDbService) return db
      if (token === SessionService) return session
      return createMock()
    })
    .compile()
  await module.init()
  return {
    module,
    session,
    commands: module.get(CommandService),
    admission: module.get(ConfigurationAdmission),
    application: module.get(ConfigurationApplication),
  }
}

export const input = {
  pk: 'TENANT#demo',
  sk: 'CONFIG#main',
  id: 'configuration',
  code: 'main',
  name: 'Configuration',
  type: 'configuration',
  tenantCode: 'demo',
  version: 12,
  attributes: { value: 'new' },
}
export const options = { invokeContext: {}, source: 'configuration-example' }
