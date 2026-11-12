import {
  CommandService,
  DataModel,
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
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { ulid } from 'ulid'

import {
  MasterAccessOptions,
  MasterWriteOptions,
} from '../access/master-access.interface'
import { MasterAccessService } from '../access/master-access.service'
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
import { SettingTypeEnum } from '../enums'
import {
  generateMasterDataSk,
  generateMasterPk,
  getSettingCodeFromSk,
  getSystemId,
  stripSystemAttribute,
  toPublicRow,
  withSystemAttribute,
} from '../helpers'
import {
  containsInsensitive,
  DatabaseProvider,
  resolveDatabaseProvider,
} from '../helpers/database-provider'
import { buildTenantScope, getOrderBys } from '../helpers/rds'
import { IMasterDataService } from '../interfaces'
import {
  MasterModuleOptions,
  MODULE_OPTIONS_TOKEN,
  PRISMA_SERVICE,
} from '../master.module-definition'

@Injectable()
export class MasterDataService implements IMasterDataService {
  private readonly logger = new Logger(MasterDataService.name)

  @Optional()
  @Inject(MODULE_OPTIONS_TOKEN)
  private readonly moduleOptions?: MasterModuleOptions

  @Optional()
  @Inject(MasterAccessService)
  private readonly access?: MasterAccessService

  private get commonTenantCode(): string {
    return this.moduleOptions?.commonTenantCode ?? SettingTypeEnum.TENANT_COMMON
  }

  private resolvedProvider?: DatabaseProvider

  private get databaseProvider(): DatabaseProvider {
    return (this.resolvedProvider ??= resolveDatabaseProvider(
      this.prismaService,
      this.moduleOptions?.databaseProvider,
    ))
  }

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
    context: MasterWriteOptions,
  ) {
    const { invokeContext } = context
    const userContext = getUserContext(invokeContext)
    const enabled = !!this.access?.isEnabled()
    const tenantCode = enabled
      ? this.access.callerTenant(context)
      : this.getTenantCode(userContext)
    if (enabled) {
      await this.access.assertTenant(tenantCode, 'read', context)
    }
    const where: any = {
      ...(await buildTenantScope(this.prismaService, {
        tenantCode,
        commonTenantCode: this.commonTenantCode,
        masterType: DATA_SK_PREFIX,
        masterTypeCode: searchDto.settingCode?.trim() || undefined,
        includeCommon: searchDto.includeCommon,
        hideDeletedSettings: true,
      })),
      masterType: DATA_SK_PREFIX,
    }

    if (searchDto.isDeleted === false || searchDto.isDeleted === undefined) {
      where.isDeleted = false
    }

    const andConditions: any[] = []

    const provider = this.databaseProvider
    if (searchDto.keyword?.trim()) {
      andConditions.push({
        name: containsInsensitive(searchDto.keyword.trim(), provider),
      })
    }

    if (searchDto.code?.trim()) {
      andConditions.push({
        masterCode: containsInsensitive(searchDto.code.trim(), provider),
      })
    }

    if (searchDto.settingCode?.trim()) {
      andConditions.push({
        masterTypeCode: searchDto.settingCode.trim(),
      })
    }

    const accessFilter = await this.access?.buildListFilter(
      'data',
      context,
      searchDto.systemId,
    )
    if (accessFilter) {
      andConditions.push(accessFilter)
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
      items: items.map((item) => new MasterRdsEntity(toPublicRow(item))),
    })
  }

  async list(searchDto: MasterDataSearchDto, options?: MasterAccessOptions) {
    const { tenantCode, settingCode } = searchDto
    if (
      settingCode === SETTING_SK_PREFIX ||
      settingCode.includes(KEY_SEPARATOR)
    ) {
      throw new BadRequestException(`Invalid settingCode: ${settingCode}`)
    }
    const pkTenant = tenantCode || this.commonTenantCode
    const pk = generateMasterPk(pkTenant)
    if (this.access?.isEnabled()) {
      const setting = await this.access.getEffectiveSetting(
        pkTenant,
        settingCode,
      )
      await this.access.assertAccess(
        { tenantCode: pkTenant, systemId: getSystemId(setting), settingCode },
        'read',
        options ?? {},
      )
    }
    const query = { sk: undefined }

    query.sk = {
      skExpression: 'begins_with(sk, :settingCode)',
      skAttributeValues: {
        ':settingCode': `${settingCode}${KEY_SEPARATOR}`,
      },
    }
    const res = await this.dataService.listItemsByPk(pk, query)
    let rows = res.items
    if (rows && this.access?.isEnabled()) {
      const readable = await Promise.all(
        rows.map((row) => this.canReadRow(row, options)),
      )
      rows = rows.filter((_, i) => readable[i])
    }
    return new MasterDataListEntity({
      ...res,
      items: rows?.map((item) => new MasterDataEntity(toPublicRow(item))),
    })
  }

  async get(key: DetailDto, options?: MasterAccessOptions) {
    const res = await this.dataService.getItem(key)
    await this.assertRowRead(res, options)
    return new MasterDataEntity(toPublicRow(res))
  }

  async create(createDto: CreateMasterDataDto, opts: MasterWriteOptions) {
    return this.createOrUpsert(createDto, opts, { throwIfExists: true })
  }

  async upsert(createDto: CreateMasterDataDto, opts: MasterWriteOptions) {
    return this.createOrUpsert(createDto, opts, { throwIfExists: false })
  }

  private async createOrUpsert(
    createDto: CreateMasterDataDto,
    opts: MasterWriteOptions,
    { throwIfExists }: { throwIfExists: boolean },
  ): Promise<MasterDataEntity> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { systemId: _clientSystemId, ...dto } =
      createDto as CreateMasterDataDto & {
        systemId?: unknown
      }
    const { settingCode, code, tenantCode } = dto
    const pk = generateMasterPk(tenantCode)
    const sk = generateMasterDataSk(settingCode, code)
    const id = generateId(pk, sk)

    const existingData = await this.dataService.getItem({ pk, sk })

    if (throwIfExists && existingData && existingData.isDeleted === false) {
      throw new BadRequestException('Master data already exists')
    }

    const systemId = await this.access?.prepareDataOwner(
      { tenantCode, settingCode, existing: existingData },
      opts,
    )

    const createCmd = {
      id,
      pk,
      sk,
      version: existingData?.version ?? VERSION_FIRST,
      type: MASTER_PK_PREFIX,
      tenantCode,
      isDeleted: false,
      ...dto,
      attributes: withSystemAttribute(
        stripSystemAttribute(dto.attributes),
        systemId,
      ),
    }

    const item = await this.commandService.publishAsync(createCmd, {
      invokeContext: opts.invokeContext,
    })

    if (!item) {
      // No changes detected - return existing data without requestId
      // to indicate that no new command was created
      if (!existingData) {
        throw new NotFoundException('Master data not found')
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { requestId, ...rest } = existingData
      return new MasterDataEntity(toPublicRow(rest))
    }

    return new MasterDataEntity(toPublicRow(item))
  }

  async update(
    key: DetailDto,
    updateDto: UpdateDataSettingDto,
    opts: MasterWriteOptions,
  ) {
    const data = (await this.dataService.getItem(key)) as MasterDataEntity

    if (!data) {
      throw new NotFoundException('Master data not found')
    }

    const systemId = await this.access?.prepareDataOwner(
      {
        tenantCode: data.tenantCode,
        settingCode: getSettingCodeFromSk(data.sk),
        existing: data,
      },
      opts,
    )

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
      attributes: withSystemAttribute(
        stripSystemAttribute(updateDto.attributes) ?? data.attributes,
        systemId,
      ),
    }

    const item = await this.commandService.publishPartialUpdateAsync(
      updateCmd,
      {
        invokeContext: opts.invokeContext,
      },
    )

    return new MasterDataEntity(toPublicRow(item))
  }

  async delete(key: DetailDto, opts: MasterWriteOptions) {
    const data = (await this.dataService.getItem(key)) as MasterDataEntity

    if (!data) {
      throw new NotFoundException('Master data not found')
    }

    if (data.isDeleted) {
      throw new BadRequestException('This master data is already deleted')
    }

    await this.access?.prepareDataOwner(
      {
        tenantCode: data.tenantCode,
        settingCode: getSettingCodeFromSk(data.sk),
        existing: data,
      },
      opts,
    )

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

    return new MasterDataEntity(toPublicRow(item))
  }

  async checkExistCode(
    tenantCode: string,
    type: string,
    code: string,
    options?: MasterAccessOptions,
  ) {
    await this.access?.assertTenant(tenantCode, 'read', options ?? {})
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

  /** Read access to a found row; a setting key works too, as the frontend loads settings here. */
  private async assertRowRead(
    row: DataModel | null | undefined,
    options?: MasterAccessOptions,
  ): Promise<void> {
    if (!row || !this.access?.isEnabled()) return
    await this.access.assertAccess(
      {
        tenantCode: row.tenantCode,
        systemId: await this.access.resolveRowOwner(row, row.tenantCode),
        settingCode: getSettingCodeFromSk(row.sk),
      },
      'read',
      options ?? {},
    )
  }

  private async canReadRow(
    row: DataModel,
    options?: MasterAccessOptions,
  ): Promise<boolean> {
    try {
      await this.assertRowRead(row, options)
      return true
    } catch (e) {
      if (e instanceof ForbiddenException) return false
      throw e
    }
  }

  async getDetail(key: DetailDto, options?: MasterAccessOptions) {
    const data = await this.dataService.getItem(key)

    if (!data) throw new NotFoundException('Master data not found')
    await this.assertRowRead(data, options)

    return new MasterRdsEntity(toPublicRow(data))
  }

  async createSetting(createDto: MasterDataCreateDto, invokeContext: IInvoke) {
    const prepared = await this.prepareSettingDto(createDto, invokeContext)
    return this.create(prepared, { invokeContext })
  }

  async createBulk(createDto: MasterDataCreateBulkDto, invokeContext: IInvoke) {
    return Promise.all(
      createDto.items.map((item) => this.createSetting(item, invokeContext)),
    )
  }

  async upsertSetting(createDto: MasterDataCreateDto, invokeContext: IInvoke) {
    const prepared = await this.prepareSettingDto(createDto, invokeContext)
    return this.upsert(prepared, { invokeContext })
  }

  private async prepareSettingDto(
    createDto: MasterDataCreateDto,
    invokeContext: IInvoke,
  ): Promise<CreateMasterDataDto> {
    const userContext = getUserContext(invokeContext)
    let seq = createDto?.seq
    const attributes = { ...(createDto.attributes ?? {}) }
    if (seq == null) {
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
      attributes['seq'] = seq
    }

    return {
      code: createDto.code ?? ulid(),
      tenantCode: createDto.tenantCode ?? userContext.tenantCode,
      name: createDto.name,
      settingCode: createDto.settingCode,
      attributes,
      seq,
    }
  }

  async upsertBulk(createDto: MasterDataCreateBulkDto, invokeContext: IInvoke) {
    if (this.access?.isEnabled()) {
      // Check every item first so a forbidden one leaves nothing half-written.
      const { tenantCode } = getUserContext(invokeContext)
      for (const item of createDto.items) {
        const tenant = item.tenantCode ?? tenantCode
        const existing = item.code
          ? await this.dataService.getItem({
              pk: generateMasterPk(tenant),
              sk: generateMasterDataSk(item.settingCode, item.code),
            })
          : null
        await this.access.prepareDataOwner(
          { tenantCode: tenant, settingCode: item.settingCode, existing },
          { invokeContext },
        )
      }
    }
    const results = []
    for (const item of createDto.items) {
      results.push(await this.upsertSetting(item, invokeContext))
    }
    return results
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
