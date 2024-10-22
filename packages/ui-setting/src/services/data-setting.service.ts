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

import { DataSettingCommandDto } from '../dto/data-setting-command.dto'
import { CreateDataSettingDto } from '../dto/data-setting-create.dto'
import { DataSettingSearchDto } from '../dto/data-setting-search.dto'
import { UpdateDataSettingDto } from '../dto/data-setting-update.dto'
import { DataSettingDataEntity } from '../entities/data-setting-data.entity'
import { DataSettingDataListEntity } from '../entities/data-setting-data-list.entity'
import { SettingDataEntity } from '../entities/setting-data.entity'
import {
  generateDataSettingSk,
  generateSettingPk,
  generateSettingSk,
  MASTER_PK_PREFIX,
  parseDataSettingSk,
  SETTING_SK_PREFIX,
} from '../helpers'

@Injectable()
export class DataSettingService {
  private readonly logger = new Logger(DataSettingService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async list(tenantCode: string, searchDto: DataSettingSearchDto) {
    const pk = generateSettingPk(tenantCode)
    const query = { sk: undefined, limit: 100 }
    if (searchDto.settingCode) {
      query.sk = {
        skExpession: 'begins_with(sk, :settingCode)',
        skAttributeValues: {
          ':settingCode': `${searchDto.settingCode}${KEY_SEPARATOR}`,
        },
      }
    }
    const res = (await this.dataService.listItemsByPk(
      pk,
      query,
    )) as DataSettingDataListEntity

    if (res?.items) {
      res.items = res.items.filter(
        (item) => !item.sk.startsWith(`${SETTING_SK_PREFIX}${KEY_SEPARATOR}`),
      )
    }

    return new DataSettingDataListEntity(res as DataSettingDataListEntity)
  }

  async get(key: DetailDto) {
    const res = await this.dataService.getItem(key)
    return new DataSettingDataEntity(res as DataSettingDataEntity)
  }

  async create(
    tenantCode: string,
    createDto: CreateDataSettingDto,
    opts: { invokeContext: IInvoke },
  ) {
    const { settingCode, code } = createDto
    const pk = generateSettingPk(tenantCode)
    const sk = generateDataSettingSk(settingCode, code)
    const id = generateId(pk, sk)

    const dataSetting = await this.dataService.getItem({ pk, sk })

    if (dataSetting && dataSetting.isDeleted == false) {
      throw new BadRequestException('Data setting is exist!')
    }

    const settingSk = generateSettingSk(settingCode)

    const setting = (await this.dataService.getItem({
      pk,
      sk: settingSk,
    })) as SettingDataEntity

    if (!setting || setting.isDeleted) {
      throw new NotFoundException('Setting code is not exist!')
    }

    const createCmd: DataSettingCommandDto = {
      id,
      pk,
      sk,
      version: dataSetting?.version ?? VERSION_FIRST,
      type: MASTER_PK_PREFIX,
      tenantCode,
      isDeleted: false,
      ...createDto,
    }

    const item = await this.commandService.publish(createCmd, {
      source: getCommandSource(
        basename(__dirname),
        this.constructor.name,
        'createDataSetting',
      ),
      invokeContext: opts.invokeContext,
    })

    return new DataSettingDataEntity(item as DataSettingDataEntity)
  }

  async update(
    key: DetailDto,
    updateDto: UpdateDataSettingDto,
    opts: { invokeContext: IInvoke },
  ) {
    const data = (await this.dataService.getItem(key)) as DataSettingDataEntity

    if (!data) {
      throw new NotFoundException()
    }

    if (updateDto.attributes) {
      const { settingCode } = parseDataSettingSk(data.sk)
      const settingSk = generateSettingSk(settingCode)

      const setting = (await this.dataService.getItem({
        pk: key.pk,
        sk: settingSk,
      })) as SettingDataEntity

      if (!setting || setting.isDeleted) {
        throw new NotFoundException('Setting code is not exist!')
      }
    }

    const updateCmd: DataSettingCommandDto = {
      id: data.id,
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      code: data.code,
      name: updateDto.name ?? data.name,
      type: data.type,
      tenantCode: data.tenantCode,
      isDeleted: updateDto.isDeleted ?? data.isDeleted,
      attributes: updateDto.attributes ?? data.attributes,
    }

    const item = await this.commandService.publish(updateCmd, {
      source: getCommandSource(
        basename(__dirname),
        this.constructor.name,
        'updateDataSetting',
      ),
      invokeContext: opts.invokeContext,
    })

    return new DataSettingDataEntity(item as DataSettingDataEntity)
  }

  async delete(key: DetailDto, opts: { invokeContext: IInvoke }) {
    const data = (await this.dataService.getItem(key)) as DataSettingDataEntity

    if (!data) {
      throw new NotFoundException()
    }

    if (data.isDeleted) {
      throw new BadRequestException('This setting is already delete!')
    }

    const deleteCmd: DataSettingCommandDto = {
      ...data,
      isDeleted: true,
    }

    const item = await this.commandService.publish(deleteCmd, {
      source: getCommandSource(
        basename(__dirname),
        this.constructor.name,
        'deleteDataSetting',
      ),
      invokeContext: opts.invokeContext,
    })

    return new DataSettingDataEntity(item as DataSettingDataEntity)
  }

  async checkExistCode(tenantCode: string, settingCode: string, code: string) {
    const pk = generateSettingPk(tenantCode)
    const sk = generateDataSettingSk(settingCode, code)
    const item = (await this.dataService.getItem({
      pk,
      sk,
    })) as DataSettingDataEntity

    return !!item && !item.isDeleted
  }
}
