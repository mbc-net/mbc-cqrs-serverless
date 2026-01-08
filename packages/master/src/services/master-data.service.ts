import {
  CommandService,
  DataService,
  DetailDto,
  generateId,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  UserContext,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ulid } from 'ulid'

import {
  DATA_SK_PREFIX,
  MASTER_PK_PREFIX,
  SETTING_SK_PREFIX,
} from '../constants'
import {
  CreateMasterDataDto,
  CustomMasterDataSearchDto,
  MasterDataCreateDto,
  MasterDataSearchDto,
  MasterDataUpdateDto,
  MasterRdsEntity,
  MasterRdsListEntity,
  UpdateDataSettingDto,
} from '../dto'
import { MasterDataCreateBulkDto } from '../dto/master-copy/master-data-create-bulk.dto'
import { MasterDataEntity, MasterDataListEntity } from '../entities'
import { generateMasterDataSk, generateMasterPk } from '../helpers'
import { getOrderBys } from '../helpers/rds'
import { IMasterDataService } from '../interfaces'
import { PRISMA_SERVICE } from '../master.module-definition'

@Injectable()
export class MasterDataService implements IMasterDataService {
  private readonly logger = new Logger(MasterDataService.name)

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prismaService: any,
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  /**
   * List master data by RDS
   * @param searchDto - Search criteria for master data
   * @param context - Context containing invoke information
   * @returns A promise that resolves to the search results
   */
  async listByRds(
    searchDto: CustomMasterDataSearchDto,
    context: { invokeContext: IInvoke },
  ) {
    const { invokeContext } = context
    const userContext = getUserContext(invokeContext)
    const deletedSettingData = await this.prismaService.master.findMany({
      where: {
        tenantCode: this.getTenantCode(userContext),
        isDeleted: true,
        masterType: SETTING_SK_PREFIX,
      },
      select: {
        masterCode: true,
      },
    })

    const deletedSettingCode = deletedSettingData.map(
      (setting) => setting.masterCode,
    )

    const where: any = {
      tenantCode: this.getTenantCode(userContext),
      masterType: DATA_SK_PREFIX,
    }

    if (deletedSettingCode.length > 0) {
      where.masterTypeCode = {
        notIn: deletedSettingCode,
      }
    }

    if (searchDto.isDeleted === false || searchDto.isDeleted === undefined) {
      where.isDeleted = false
    }

    const andConditions: any[] = []

    if (searchDto.keyword?.trim()) {
      andConditions.push({
        name: { contains: searchDto.keyword.trim(), mode: 'insensitive' },
      })
    }

    if (searchDto.code?.trim()) {
      andConditions.push({
        masterCode: { contains: searchDto.code.trim(), mode: 'insensitive' },
      })
    }

    if (searchDto.settingCode?.trim()) {
      andConditions.push({
        masterTypeCode: searchDto.settingCode.trim(),
      })
    }

    if (andConditions.length) {
      where.AND = andConditions
    }

    const {
      pageSize = 10,
      page = 1,
      orderBys = ['seq', 'masterCode'],
    } = searchDto

    const [total, items] = await Promise.all([
      this.prismaService.master.count({ where }),
      this.prismaService.master.findMany({
        where,
        take: pageSize,
        skip: pageSize * (page - 1),
        orderBy: getOrderBys(orderBys),
      }),
    ])

    return new MasterRdsListEntity({
      total,
      items: items.map((item) => new MasterRdsEntity(item)),
    })
  }

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
      throw new BadRequestException('Master data already exists')
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
      throw new NotFoundException('Master data not found')
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
      throw new NotFoundException('Master data not found')
    }

    if (data.isDeleted) {
      throw new BadRequestException('This master data is already deleted')
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

  private getTenantCode(userContext: UserContext): string {
    return userContext.tenantCode
  }

  async getDetail(key: DetailDto) {
    const data = await this.dataService.getItem(key)

    if (!data) throw new NotFoundException('Master data not found')

    return new MasterRdsEntity(data)
  }

  async createSetting(createDto: MasterDataCreateDto, invokeContext: IInvoke) {
    const userContext = getUserContext(invokeContext)
    let seq = createDto?.seq
    if (!seq) {
      const maxSeq = await this.prismaService.master.aggregate({
        _max: {
          seq: true,
        },
        where: {
          tenantCode: createDto.tenantCode ?? userContext.tenantCode,
          masterType: DATA_SK_PREFIX,
          masterTypeCode: createDto.settingCode,
        },
      })
      seq = (maxSeq._max.seq ?? 0) + 1
      createDto.attributes['seq'] = seq
    }

    return await this.create(
      {
        code: createDto.code ?? ulid(),
        tenantCode: createDto.tenantCode ?? userContext.tenantCode,
        name: createDto.name,
        settingCode: createDto.settingCode,
        attributes: createDto.attributes ?? {},
        seq,
      },
      { invokeContext },
    )
  }

  async createBulk(createDto: MasterDataCreateBulkDto, invokeContext: IInvoke) {
    return Promise.all(
      createDto.items.map((item) => this.createSetting(item, invokeContext)),
    )
  }

  async updateSetting(
    key: DetailDto,
    updateDto: MasterDataUpdateDto,
    invokeContext: IInvoke,
  ) {
    return await this.update(
      key,
      {
        ...updateDto,
      },
      { invokeContext },
    )
  }

  async deleteSetting(key: DetailDto, invokeContext: IInvoke) {
    return this.delete(key, { invokeContext })
  }
}
