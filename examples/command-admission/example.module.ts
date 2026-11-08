import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common'

import { configurationCommandModule } from './admission'
import { ConfigurationApplication } from './application'
import { ConfigurationMigration } from './migration'

@Module({})
export class ConfigurationExampleModule {
  static register(options: {
    tableName: string
    witnessTableName: string
    infrastructureImports?: ModuleMetadata['imports']
  }): DynamicModule {
    return {
      module: ConfigurationExampleModule,
      imports: [
        configurationCommandModule(
          options.tableName,
          options.witnessTableName,
          options.infrastructureImports,
        ),
        // ConfigurationMigration needs DynamoDbService in this module as well.
        ...(options.infrastructureImports ?? []),
      ],
      providers: [ConfigurationApplication, ConfigurationMigration],
      exports: [ConfigurationApplication, ConfigurationMigration],
    }
  }
}
