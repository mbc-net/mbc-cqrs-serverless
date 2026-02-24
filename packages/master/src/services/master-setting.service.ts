import {
  CommandDto,
  CommandModel,
  CommandService,
  DataService,
  DetailDto,
  DetailKey,
  DynamoDbService,
  generateId,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  SearchDto,
  TableType,
  UserContext,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { TaskService } from '@mbc-cqrs-serverless/task'
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import {
  MASTER_COPY_SK_PREFIX,
  MASTER_PK_PREFIX,
  SETTING_SK_PREFIX,
  SETTING_TENANT_PREFIX,
  TENANT_SYSTEM_PREFIX,
} from '../constants'
import {
  CommonSettingDto,
  DataCopyMode,
  GetSettingDto,
  GroupSettingDto,
  MasterCopyDto,
  MasterRdsEntity,
  MasterRdsListEntity,
  MasterSettingSearchDto,
  MasterSettingUpdateDto,
  TenantSettingDto,
  UpdateSettingDto,
  UserSettingDto,
} from '../dto'
import { CommonSettingBulkDto } from '../dto/master-setting/common-setting-create-bulk.dto'
import { MasterSettingEntity } from '../entities'
import { SettingTypeEnum } from '../enums'
import { generateMasterPk, generateMasterSettingSk, parseId } from '../helpers'
import { getOrderBys } from '../helpers/rds'
import { IMasterSettingService } from '../interfaces'
import { PRISMA_SERVICE } from '../master.module-definition'
@Injectable()
export class MasterSettingService implements IMasterSettingService {
  private readonly logger = new Logger(MasterSettingService.name)
  private tenantTableName: string

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prismaService: any,
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
    private readonly dynamoDbService: DynamoDbService,
    private readonly taskService: TaskService,
  ) {
    this.tenantTableName = dynamoDbService.getTableName(
      'tenant',
      TableType.DATA,
    )
    this.logger.debug('tableName: ' + this.tenantTableName)
  }

  private async fetchSetting(
    pk: string,
    skPrefix: string,
    code: string,
  ): Promise<any> {
    const sk = `${skPrefix}${code}`
    return this.dataService.getItem({ pk, sk })
  }

  private async fetchGroupSetting(
    groups: string[],
    tenantCode: string,
    code: string,
  ): Promise<any> {
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    for (const group of groups) {
      const skPrefix = `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${group}${KEY_SEPARATOR}`
      const result = await this.fetchSetting(pk, skPrefix, code)
      if (result) return result
    }
    return null
  }

  /**
   * List master setting by RDS
   * @param searchDto - Search criteria for master data
   * @param context - Context containing invoke information
   * @returns A promise that resolves to the search results
   */
  async listSettingByRds(
    searchDto: SearchDto,
    context: { invokeContext: IInvoke },
  ) {
    // TODO: Implement RDS logic here
    return { searchDto, context }
  }

  async getSetting(
    dto: GetSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<MasterSettingEntity> {
    const { tenantCode, tenantRole, userId } = getUserContext(
      options.invokeContext,
    )
    const { code } = dto
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    // Fetch user-level setting
    let setting = await this.fetchSetting(
      pk,
      `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}`,
      code,
    )

    if (setting) {
      return new MasterSettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    // Fetch tenant-level group settings

    try {
      const tenant = await this.dynamoDbService.getItem(this.tenantTableName, {
        pk: `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`,
        sk: SETTING_TENANT_PREFIX,
      })

      if (tenant?.attributes?.setting) {
        const groupSettingByRole = tenant.attributes.setting.find(
          (i) => i.tenantRole === tenantRole,
        )

        if (groupSettingByRole) {
          setting = await this.fetchGroupSetting(
            groupSettingByRole.setting_groups,
            tenantCode,
            code,
          )
          if (setting) {
            return new MasterSettingEntity({
              id: setting.id,
              settingValue: setting.attributes,
            })
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error fetching group setting: ${error}`)
    }

    // Fallback to common tenant-level settings
    setting = await this.fetchSetting(
      pk,
      `${SETTING_SK_PREFIX}${KEY_SEPARATOR}`,
      code,
    )
    if (setting) {
      return new MasterSettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    setting = await this.fetchSetting(
      `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`,
      `${SETTING_SK_PREFIX}${KEY_SEPARATOR}`,
      code,
    )
    if (!setting) {
      this.logger.error(`Setting not found ${code}`)
      throw new BadRequestException(`Setting not found with code: ${code}`)
    }

    return new MasterSettingEntity({
      id: setting.id,
      settingValue: setting.attributes,
    })
  }

  async createCommonTenantSetting(
    dto: CommonSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, settingValue, code } = dto

    const pk = generateMasterPk(SettingTypeEnum.TENANT_COMMON)
    const sk = generateMasterSettingSk(code)
    const setting = await this.dataService.getItem({ pk, sk })
    if (setting && setting.isDeleted === false) {
      throw new BadRequestException(`Setting already exists: ${code}`)
    }
    const command: CommandDto = {
      sk,
      pk,
      code: code,
      name: name,
      id: generateId(pk, sk),
      tenantCode: SettingTypeEnum.TENANT_COMMON,
      type: MASTER_PK_PREFIX,
      version: setting?.version ?? VERSION_FIRST,
      isDeleted: false,
      attributes: settingValue,
    }
    return await this.commandService.publishAsync(command, options)
  }
  async createTenantSetting(
    dto: TenantSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    return this.createOrUpsertTenantSetting(dto, options, {
      throwIfExists: true,
    })
  }

  async createGroupSetting(
    dto: GroupSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, groupId } = dto

    const pk = generateMasterPk(tenantCode)

    const sk = `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${groupId}${KEY_SEPARATOR}${code}`

    const setting = await this.dataService.getItem({ pk, sk })
    if (setting && setting.isDeleted === false) {
      throw new BadRequestException(`Setting already exists: ${code}`)
    }

    const command: CommandDto = {
      sk,
      pk,
      code: code,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: MASTER_PK_PREFIX,
      version: setting?.version ?? VERSION_FIRST,
      isDeleted: false,
      attributes: settingValue,
    }
    return await this.commandService.publishAsync(command, options)
  }
  async createUserSetting(
    dto: UserSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, userId } = dto

    const pk = generateMasterPk(tenantCode)

    const sk = `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}${code}`

    const setting = await this.dataService.getItem({ pk, sk })
    if (setting && setting.isDeleted === false) {
      throw new BadRequestException(`Setting already exists: ${code}`)
    }

    const command: CommandDto = {
      sk,
      pk,
      code: code,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: MASTER_PK_PREFIX,
      version: setting?.version ?? VERSION_FIRST,
      isDeleted: false,
      attributes: settingValue,
    }
    return await this.commandService.publishAsync(command, options)
  }

  async updateSetting(
    key: DetailKey,
    dto: UpdateSettingDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { pk, sk } = key
    const data = await this.dataService.getItem(key)
    if (!data) {
      throw new BadRequestException("Setting doesn't exist")
    }
    const item = await this.commandService.publishPartialUpdateAsync(
      {
        pk,
        sk,
        name: dto.name,
        attributes: dto.settingValue,
        version: data.version,
      },
      context,
    )
    return item
  }

  async deleteSetting(
    key: DetailKey,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { pk, sk } = key
    const data = await this.dataService.getItem(key)
    if (!data) {
      throw new BadRequestException("Setting doesn't exist")
    }
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

  async getDetail(key: DetailDto) {
    const data = await this.dataService.getItem(key)

    if (!data) throw new NotFoundException('Master setting not found')

    return new MasterRdsEntity(data)
  }

  async create(createDto: CommonSettingDto, invokeContext: IInvoke) {
    const userContext = getUserContext(invokeContext)
    return await this.createTenantSetting(
      {
        ...createDto,
        tenantCode: createDto.tenantCode ?? userContext.tenantCode,
      },
      { invokeContext },
    )
  }

  async createBulk(createDto: CommonSettingBulkDto, invokeContext: IInvoke) {
    return Promise.all(
      createDto.items.map((item) => this.create(item, invokeContext)),
    )
  }

  async upsertTenantSetting(
    dto: TenantSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    return this.createOrUpsertTenantSetting(dto, options, {
      throwIfExists: false,
    })
  }

  private async createOrUpsertTenantSetting(
    dto: TenantSettingDto,
    options: { invokeContext: IInvoke },
    { throwIfExists }: { throwIfExists: boolean },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code } = dto

    const pk = generateMasterPk(tenantCode)
    const sk = generateMasterSettingSk(code)

    const setting = await this.dataService.getItem({ pk, sk })

    if (throwIfExists && setting && setting.isDeleted === false) {
      throw new BadRequestException(`Setting already exists: ${code}`)
    }

    const command: CommandDto = {
      sk,
      pk,
      code: code,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: MASTER_PK_PREFIX,
      version: setting?.version ?? VERSION_FIRST,
      isDeleted: false,
      attributes: settingValue,
    }

    const item = await this.commandService.publishAsync(command, options)

    if (!item) {
      // No changes detected - return existing data without requestId
      // to indicate that no new command was created
      if (!setting) {
        throw new BadRequestException('Setting not found')
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { requestId, ...rest } = setting
      return rest as CommandModel
    }

    return item
  }

  async upsertSetting(createDto: CommonSettingDto, invokeContext: IInvoke) {
    const userContext = getUserContext(invokeContext)
    return await this.upsertTenantSetting(
      {
        ...createDto,
        tenantCode: createDto.tenantCode ?? userContext.tenantCode,
      },
      { invokeContext },
    )
  }

  async upsertBulk(createDto: CommonSettingBulkDto, invokeContext: IInvoke) {
    return Promise.all(
      createDto.items.map((item) => this.upsertSetting(item, invokeContext)),
    )
  }

  async update(
    key: DetailDto,
    updateDto: MasterSettingUpdateDto,
    invokeContext: IInvoke,
  ) {
    const code = key.sk.split('#')[1]
    const userContext = getUserContext(invokeContext)

    return await this.updateSetting(
      key,
      {
        code,
        tenantCode: updateDto.tenantCode ?? userContext.tenantCode,
        name: updateDto.name,
        settingValue: updateDto.attributes,
      },
      {
        invokeContext,
      },
    )
  }

  async delete(key: DetailDto, invokeContext: IInvoke) {
    return this.deleteSetting(key, { invokeContext })
  }

  async checkExistCode(code: string, invokeContext: IInvoke) {
    const userContext = getUserContext(invokeContext)

    const item = await this.prismaService.master.findFirst({
      where: {
        tenantCode: userContext.tenantCode,
        masterType: SETTING_SK_PREFIX,
        masterCode: code,
      },
    })

    return !!item && !item.isDeleted
  }

  async list(searchDto: MasterSettingSearchDto, invokeContext: IInvoke) {
    const userContext = getUserContext(invokeContext)

    const where: any = {
      tenantCode: this.getUserTenantCode(userContext),
      masterType: SETTING_SK_PREFIX,
    }

    if (searchDto.isDeleted === false || searchDto.isDeleted === undefined) {
      where.isDeleted = false
    }

    const andConditions = []

    if (searchDto.name?.trim()) {
      andConditions.push({
        name: { contains: searchDto.name.trim(), mode: 'insensitive' },
      })
    }

    if (searchDto.keyword?.trim()) {
      andConditions.push({
        attributes: {
          path: 'description',
          string_contains: searchDto.keyword.trim(),
        },
      })
    }

    if (searchDto.code?.trim()) {
      andConditions.push({
        masterCode: { contains: searchDto.code.trim(), mode: 'insensitive' },
      })
    }

    if (andConditions.length) {
      where.AND = andConditions
    }

    const { pageSize = 10, page = 1, orderBys = ['-createdAt'] } = searchDto

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

  async copy(
    masterCopyDto: MasterCopyDto,
    opts: { invokeContext: IInvoke },
  ): Promise<any> {
    this.logger.debug('cmd:', JSON.stringify(masterCopyDto))

    const userContext = getUserContext(opts.invokeContext)

    const { masterSettingId, targetTenants, dataCopyOption } = masterCopyDto

    if (dataCopyOption?.mode === DataCopyMode.PARTIAL) {
      if (!dataCopyOption.id?.length) {
        throw new BadRequestException('Must provide ID when mode is PARTIAL.')
      }
    }

    const setting = await this.dataService.getItem(parseId(masterSettingId))

    if (!setting || setting.isDeleted) {
      throw new BadRequestException('Master setting does not exist')
    }

    const item = targetTenants.map((tenant) => ({
      ...masterCopyDto,
      targetTenants: [tenant],
    }))

    const taskItem = await this.taskService.createStepFunctionTask(
      {
        input: item,
        taskType: `${MASTER_COPY_SK_PREFIX}_${masterSettingId.split('#').at(-1)}`,
        tenantCode: userContext.tenantCode,
      },
      opts,
    )

    return taskItem
  }

  private getUserTenantCode(userContext: UserContext): string {
    return userContext.tenantCode
  }
}
