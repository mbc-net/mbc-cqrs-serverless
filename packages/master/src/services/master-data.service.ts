import {
  CommandService,
  DataService,
  DetailDto,
  generateId,
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

import { MASTER_PK_PREFIX } from '../constants'
import {
  CreateMasterDataDto,
  MasterDataSearchDto,
  UpdateDataSettingDto,
} from '../dto'
import { MasterDataEntity, MasterDataListEntity } from '../entities'
import { generateMasterDataSk, generateMasterPk } from '../helpers'
import { IMasterDataService } from '../interfaces'

@Injectable()
export class MasterDataService implements IMasterDataService {
  private readonly logger = new Logger(MasterDataService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async list(searchDto: MasterDataSearchDto) {
    const { tenantCode, settingCode } = searchDto
    let pk
    if (tenantCode) {
      pk = generateMasterPk(tenantCode)
    } else {
      pk = generateMasterPk('COMMON')
    }
    const query = { sk: undefined }

    query.sk = {
      skExpession: 'begins_with(sk, :settingCode)',
      skAttributeValues: {
        ':settingCode': `${settingCode}${KEY_SEPARATOR}`,
      },
    }
    const res = await this.dataService.listItemsByPk(pk, query)
    return new MasterDataListEntity(res)
  }

  async get(key: DetailDto) {
    const res = await this.dataService.getItem(key)
    return new MasterDataEntity(res)
  }

  async create(
    createDto: CreateMasterDataDto,
    opts: { invokeContext: IInvoke },
  ) {
    const { settingCode, code, tenantCode } = createDto
    const pk = generateMasterPk(tenantCode)
    const sk = generateMasterDataSk(settingCode, code)
    const id = generateId(pk, sk)

    const dataSetting = await this.dataService.getItem({ pk, sk })

    if (dataSetting && dataSetting.isDeleted == false) {
      throw new BadRequestException('Data setting is exist!')
    }

    const createCmd = {
      id,
      pk,
      sk,
      version: dataSetting?.version ?? VERSION_FIRST,
      type: MASTER_PK_PREFIX,
      tenantCode,
      isDeleted: false,
      ...createDto,
    }

    const item = await this.commandService.publishAsync(createCmd, {
      invokeContext: opts.invokeContext,
    })

    return new MasterDataEntity(item)
  }

  async update(
    key: DetailDto,
    updateDto: UpdateDataSettingDto,
    opts: { invokeContext: IInvoke },
  ) {
    const data = (await this.dataService.getItem(key)) as MasterDataEntity

    if (!data) {
      throw new NotFoundException()
    }

    const updateCmd = {
      id: data.id,
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      code: data.code,
      name: updateDto.name ?? data.name,
      seq: updateDto.seq,
      type: data.type,
      tenantCode: data.tenantCode,
      isDeleted: updateDto.isDeleted ?? data.isDeleted,
      attributes: updateDto.attributes ?? data.attributes,
    }

    const item = await this.commandService.publishPartialUpdateAsync(
      updateCmd,
      {
        invokeContext: opts.invokeContext,
      },
    )

    return new MasterDataEntity(item)
  }

  async delete(key: DetailDto, opts: { invokeContext: IInvoke }) {
    const data = (await this.dataService.getItem(key)) as MasterDataEntity

    if (!data) {
      throw new NotFoundException()
    }

    if (data.isDeleted) {
      throw new BadRequestException('This setting is already delete!')
    }

    const deleteCmd = {
      ...data,
      isDeleted: true,
    }

    const item = await this.commandService.publishPartialUpdateAsync(
      deleteCmd,
      {
        invokeContext: opts.invokeContext,
      },
    )

    return new MasterDataEntity(item)
  }

  async checkExistCode(tenantCode: string, type: string, code: string) {
    const pk = generateMasterPk(tenantCode)
    const sk = generateMasterDataSk(type, code)
    const item = (await this.dataService.getItem({
      pk,
      sk,
    })) as MasterDataEntity

    return !!item && !item.isDeleted
  }
}
