import {
  DataService,
  DetailDto,
  getUserContext,
  IInvoke,
  UserContext,
} from '@mbc-cqrs-serverless/core'
import { MasterSettingService } from '@mbc-cqrs-serverless/master'
import { CommonSettingDto } from '@mbc-cqrs-serverless/master/dist/dto'
import { TaskService } from '@mbc-cqrs-serverless/task'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/prisma'

import { DataCopyMode, MasterCopyDto } from './dto/master-copy.dto'
import { MasterRdsEntity } from './dto/master-rds.entity'
import { MasterRdsListEntity } from './dto/master-rds-list.entity'
import { MasterSettingSearchDto } from './dto/master-setting-search.dto'
import { MasterSettingUpdateDto } from './dto/master-setting-update.dto'
import {
  getOrderBys,
  MASTER_COPY_SK_PREFIX,
  parseId,
  SETTING_SK_PREFIX,
} from './helpers'

@Injectable()
export class CustomMasterSettingService {
  private readonly logger = new Logger(CustomMasterSettingService.name)

  constructor(
    private readonly masterSettingService: MasterSettingService,
    private readonly prismaService: PrismaService,
    private readonly dataService: DataService,
    private readonly taskService: TaskService,
  ) {}

  async list(searchDto: MasterSettingSearchDto, invokeContext: IInvoke) {
    const userContext = getUserContext(invokeContext)

    const where: Prisma.MasterWhereInput = {
      tenantCode: this.getUserTenantCode(userContext),
      masterType: SETTING_SK_PREFIX,
    }

    if (searchDto.isDeleted === false || searchDto.isDeleted === undefined) {
      where.isDeleted = false
    }

    const andConditions: Prisma.MasterWhereInput[] = []

    if (searchDto.name?.trim()) {
      andConditions.push({
        name: { contains: searchDto.name.trim() },
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
        masterCode: { contains: searchDto.code.trim() },
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
        orderBy: getOrderBys<Prisma.MasterOrderByWithRelationInput>(orderBys),
      }),
    ])

    return new MasterRdsListEntity({
      total,
      items: items.map((item) => new MasterRdsEntity(item)),
    })
  }

  async getDetail(key: DetailDto) {
    const data = await this.dataService.getItem(key)

    if (!data) throw new NotFoundException()

    return new MasterRdsEntity(data)
  }

  async create(createDto: CommonSettingDto, invokeContext: IInvoke) {
    const userContext = getUserContext(invokeContext)
    return await this.masterSettingService.createTenantSetting(
      {
        ...createDto,
        tenantCode: userContext.tenantCode,
      },
      { invokeContext },
    )
  }

  async update(
    key: DetailDto,
    updateDto: MasterSettingUpdateDto,
    invokeContext: IInvoke,
  ) {
    const code = key.sk.split('#')[1]
    const userContext = getUserContext(invokeContext)

    return await this.masterSettingService.updateSetting(
      key,
      {
        code,
        tenantCode: userContext.tenantCode,
        name: updateDto.name,
        settingValue: updateDto.attributes,
      },
      {
        invokeContext,
      },
    )
  }

  async delete(key: DetailDto, invokeContext: IInvoke) {
    return this.masterSettingService.deleteSetting(key, { invokeContext })
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
