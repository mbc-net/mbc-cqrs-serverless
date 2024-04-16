import {
  CommandService,
  DataService,
  DetailDto,
  generateId,
  getCommandSource,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-severless/core'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Param,
} from '@nestjs/common'
import { basename } from 'path'

import { DataSettingCommandDto } from '../dto/data-setting-command.dto'
import { CreateDataSettingDto } from '../dto/data-setting-create.dto'
import { DataSettingSearchDto } from '../dto/data-setting-search.dto'
import { UpdateDataSettingDto } from '../dto/data-setting-update.dto'
import { SettingAttrFields } from '../dto/setting-attributes.dto'
import { DataSettingDataEntity } from '../entities/data-setting-data.entity'
import { DataSettingDataListEntity } from '../entities/data-setting-data-list.entity'
import { SettingDataEntity } from '../entities/setting-data.entity'
import {
  generateDataSettingSk,
  generateSettingPk,
  generateSettingSk,
  MASTER_PK_PREFIX,
  parseDataSettingSk,
} from '../helpers'

@Injectable()
export class DataSettingService {
  private readonly logger = new Logger(DataSettingService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async get(tenantCode: string, searchDto: DataSettingSearchDto) {
    const pk = generateSettingPk(tenantCode)
    const query = {
      sk: {
        skExpession: 'begins_with(sk, :settingCode)',
        skAttributeValues: {
          ':settingCode': `${searchDto.settingCode}${KEY_SEPARATOR}`,
        },
      },
    }
    const res = await this.dataService.listItemsByPk(pk, query)
    return new DataSettingDataListEntity(res as DataSettingDataListEntity)
  }

  async create(tenantCode: string, createDto: CreateDataSettingDto) {
    const { settingCode, code } = createDto
    const pk = generateSettingPk(tenantCode)
    const sk = generateDataSettingSk(settingCode, code)
    const id = generateId(pk, sk)

    const dataSetting = await this.dataService.getItem({ pk, sk } as DetailDto)

    if (dataSetting && dataSetting.isDeleted == false) {
      throw new BadRequestException('Data setting is exist!')
    }

    const settingSk = generateSettingSk(settingCode)

    const setting = (await this.dataService.getItem({
      pk,
      sk: settingSk,
    } as DetailDto)) as SettingDataEntity

    if (!setting || setting.isDeleted) {
      throw new NotFoundException('Setting code is not exist!')
    }

    const isValid = this.isValidAttributes(
      setting.attributes.fields,
      createDto.attributes,
    )

    if (!isValid) {
      throw new BadRequestException('Data field is not mat with setting')
    }

    const createCmd: DataSettingCommandDto = {
      id,
      pk,
      sk,
      version: dataSetting?.version ?? VERSION_FIRST,
      code,
      name: createDto.name,
      type: MASTER_PK_PREFIX,
      tenantCode,
      isDeleted: false,
      attributes: createDto.attributes,
    }

    const item = await this.commandService.publish(createCmd, {
      source: getCommandSource(
        basename(__dirname),
        this.constructor.name,
        'createDataSetting',
      ),
    })

    return new DataSettingDataEntity(item as DataSettingDataEntity)
  }

  async update(key: DetailDto, updateDto: UpdateDataSettingDto) {
    const data = (await this.dataService.getItem(
      key as DetailDto,
    )) as DataSettingDataEntity

    if (!data) {
      throw new NotFoundException()
    }

    if (updateDto.attributes) {
      const { settingCode } = parseDataSettingSk(data.sk)
      const settingSk = generateSettingSk(settingCode)

      const setting = (await this.dataService.getItem({
        pk: key.pk,
        sk: settingSk,
      } as DetailDto)) as SettingDataEntity

      if (!setting || setting.isDeleted) {
        throw new NotFoundException('Setting code is not exist!')
      }

      const isValid = this.isValidAttributes(
        setting.attributes.fields,
        updateDto.attributes,
      )

      if (!isValid) {
        throw new BadRequestException('Data field is not mat with setting')
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
    })

    return new DataSettingDataEntity(item as DataSettingDataEntity)
  }

  async delete(@Param() key: DetailDto) {
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
    })

    return new DataSettingDataEntity(item as DataSettingDataEntity)
  }

  async checkExistCode(tenantCode: string, settingCode: string, code: string) {
    const pk = generateSettingPk(tenantCode)
    const sk = generateDataSettingSk(settingCode, code)
    const item = (await this.dataService.getItem({
      pk,
      sk,
    } as DetailDto)) as DataSettingDataEntity

    return !!item
  }

  // Check all required physicalName in setting is existed in data setting key
  private isValidAttributes(
    fields: SettingAttrFields[],
    dataAttr: object = {},
  ) {
    const settingFieldName = []
    fields.map((field) => {
      if (field.isRequired) settingFieldName.push(field.physicalName)
    })

    const dataFieldName = new Set()
    Object.keys(dataAttr).map((key) => dataFieldName.add(key))

    return settingFieldName.every((name) => dataFieldName.has(name))
  }
}
