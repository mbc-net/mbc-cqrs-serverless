import { CommandService, ICommandOptions } from '@mbc-cqrs-serverless/core'
import { Injectable } from '@nestjs/common'

import { ConfigurationAdmission, configurationKey } from './admission'

@Injectable()
export class ConfigurationApplication {
  constructor(
    private readonly admission: ConfigurationAdmission,
    private readonly commands: CommandService,
  ) {}

  // tenant comes from authenticated server context; value is validated input.
  update(tenant: string, value: string, options: ICommandOptions) {
    return this.admission.capture(tenant, async () => {
      // Capture FIRST, then read the command version and build a new payload.
      const key = configurationKey(tenant)
      const observed = await this.commands.getLatestItem(key)
      if (
        !observed ||
        observed.isDeleted ||
        !Number.isSafeInteger(observed.version) ||
        observed.version < 1
      ) {
        throw new Error('An existing configuration command is required')
      }
      return this.commands.publishAsync(
        {
          ...key,
          id: observed.id,
          code: observed.code,
          name: observed.name,
          type: observed.type,
          tenantCode: tenant,
          attributes: { ...observed.attributes, value },
          version: observed.version,
        },
        options,
      )
    })
  }
}
