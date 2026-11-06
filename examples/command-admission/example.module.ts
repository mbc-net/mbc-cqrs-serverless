import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common'

import { configurationCommandModule } from './admission'
import { ConfigurationApplication } from './application'

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
      ],
      providers: [ConfigurationApplication],
      exports: [ConfigurationApplication],
    }
  }
}
