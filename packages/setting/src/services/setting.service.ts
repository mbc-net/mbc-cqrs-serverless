import {
  CommandService,
  DataService,
  DetailDto,
  generateId,
  getCommandSource,
  IInvoke,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { basename } from 'path'

import { SettingAttrFields } from '../dto/setting-attributes.dto'
import { SettingCommandDto } from '../dto/setting-command.dto'
import { CreateSettingDto } from '../dto/setting-create.dto'
import { UpdateSettingDto } from '../dto/setting-update.dto'
import { SettingDataEntity } from '../entities/setting-data.entity'
import { SettingDataListEntity } from '../entities/setting-data-list.entity'
import {
  generateSettingPk,
  generateSettingSk,
  MASTER_PK_PREFIX,
  SETTING_SK_PREFIX,
} from '../helpers'

@Injectable()
export class SettingService {
  private readonly logger = new Logger(SettingService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async list(tenantCode: string) {
    const pk = generateSettingPk(tenantCode)
    const query = {
      sk: {
        skExpession: 'begins_with(sk, :settingPrefix)',
        skAttributeValues: {
          ':settingPrefix': `${SETTING_SK_PREFIX}${KEY_SEPARATOR}`,
        },
      },
      limit: 100,
    }
    const res = await this.dataService.listItemsByPk(pk, query)
    return new SettingDataListEntity(res as SettingDataListEntity)
  }

  async get(key: DetailDto) {
    const res = await this.dataService.getItem(key)
    return new SettingDataEntity(res as SettingDataEntity)
  }

  async create(
    tenantCode: string,
    createDto: CreateSettingDto,
    opts: { invokeContext: IInvoke },
  ) {
    const validField = this.isValidFields(createDto.attributes.fields)
    if (!validField) {
      throw new BadRequestException(
        'Physical name of fields must not duplicate',
      )
    }

    const pk = generateSettingPk(tenantCode)
    const sk = generateSettingSk(createDto.code)

    const setting = await this.dataService.getItem({ pk, sk })

    if (setting && setting.isDeleted == false) {
      throw new BadRequestException('Setting code is exist!')
    }

    const id = generateId(pk, sk)

    const createCmd: SettingCommandDto = new SettingCommandDto({
      id,
      pk,
      sk,
      version: setting?.version ?? VERSION_FIRST,
      type: MASTER_PK_PREFIX,
      tenantCode,
      isDeleted: false,
      ...createDto,
    })

    const item = await this.commandService.publish(createCmd, {
      source: getCommandSource(
        basename(__dirname),
        this.constructor.name,
        'createSetting',
      ),
      invokeContext: opts.invokeContext,
    })
    return new SettingDataEntity(item as SettingDataEntity)
  }

  async update(
    key: DetailDto,
    updateDto: UpdateSettingDto,
    opts: { invokeContext: IInvoke },
  ) {
    const data = (await this.dataService.getItem(key)) as SettingDataEntity

    if (!data) {
      throw new NotFoundException()
    }

    const validField = this.isValidFields(updateDto?.attributes?.fields ?? [])
    if (!validField) {
      throw new BadRequestException(
        'Physical name of fields must not duplicate',
      )
    }

    const updateCmd: SettingCommandDto = {
      id: data.id,
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      code: data.code,
      type: data.type,
      tenantCode: data.tenantCode,
      name: updateDto.name ?? data.name,
      isDeleted: updateDto.isDelete ?? data.isDeleted,
      attributes: {
        fields: updateDto?.attributes?.fields ?? data.attributes.fields,
        description:
          updateDto?.attributes?.description ?? data.attributes.description,
      },
    }

    const item = await this.commandService.publish(updateCmd, {
      source: getCommandSource(
        basename(__dirname),
        this.constructor.name,
        'updateSetting',
      ),
      invokeContext: opts.invokeContext,
    })
    return new SettingDataEntity(item as SettingDataEntity)
  }

  async delete(key: DetailDto, opts: { invokeContext: IInvoke }) {
    const data = (await this.dataService.getItem(key)) as SettingDataEntity

    if (!data) {
      throw new NotFoundException()
    }

    if (data.isDeleted) {
      throw new BadRequestException('This setting is already delete!')
    }

    const deleteCmd: SettingCommandDto = {
      ...data,
      isDeleted: true,
    }

    const item = await this.commandService.publish(deleteCmd, {
      source: getCommandSource(
        basename(__dirname),
        this.constructor.name,
        'deleteSetting',
      ),
      invokeContext: opts.invokeContext,
    })

    return new SettingDataEntity(item as SettingDataEntity)
  }

  async checkExistSettingCode(tenantCode: string, code: string) {
    const pk = generateSettingPk(tenantCode)
    const sk = generateSettingSk(code)
    const item = (await this.dataService.getItem({
      pk,
      sk,
    })) as SettingDataEntity

    return !!item && !item.isDeleted
  }

  private isValidFields(fields: SettingAttrFields[]) {
    const set = new Set()
    fields.forEach((field) => set.add(field.physicalName))
    return set.size === fields.length
  }
}
