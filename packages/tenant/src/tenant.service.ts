import {
  CommandDto,
  CommandModel,
  CommandService,
  DataModel,
  DataService,
  DetailKey,
  generateId,
  IInvoke,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'

import { SETTING_TENANT_PREFIX, TENANT_SYSTEM_PREFIX } from './constants/tenant.constant'
import { CreateTenantDto } from './dto/tenant/create.tenant.dto'
import { ITenantService } from './interfaces/tenant.service.interface'

@Injectable()
export class TenantService implements ITenantService {
  private readonly logger = new Logger(TenantService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) { }
  async getTenant(key: DetailKey): Promise<DataModel> {
    return await this.dataService.getItem(key)
  }

  async createTenant(
    dto: CreateTenantDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, code, description } = dto
    const pk = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${code}`
    const sk = SETTING_TENANT_PREFIX

    const command: CommandDto = {
      pk: pk,
      sk: sk,
      code: sk,
      id: generateId(pk, sk),
      name: name,
      tenantCode: code,
      type: code,
      version: VERSION_FIRST,
      attributes: {
        description: description,
      },
    }

    return await this.commandService.publishAsync(command, options)
  }

  updateTenant(): Promise<CommandModel> {
    throw new Error('Method not implemented.')
  }
  async deleteTenant(
    key: DetailKey,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const data = await this.dataService.getItem(key)
    if (!data) {
      throw new NotFoundException()
    }
    const { pk, sk } = key

    const item = await this.commandService.publishPartialUpdateAsync(
      {
        pk,
        sk,
        version: data.version,
        isDeleted: true,
      },
      options,
    )

    return item
  }
}
