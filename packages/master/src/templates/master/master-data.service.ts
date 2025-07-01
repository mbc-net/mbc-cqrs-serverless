import {
  DataService,
  DetailDto,
  getUserContext,
  IInvoke,
  UserContext,
} from '@mbc-cqrs-serverless/core'
import { MasterDataService } from '@mbc-cqrs-serverless/master'
import { Injectable, NotFoundException, Param } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/prisma'
import { ulid } from 'ulid'

import { MasterDataCreateDto } from './dto/master-data-create.dto'
import { MasterDataSearchDto } from './dto/master-data-search.dto'
import { MasterDataUpdateDto } from './dto/master-data-update.dto'
import { MasterRdsEntity } from './dto/master-rds.entity'
import { MasterRdsListEntity } from './dto/master-rds-list.entity'
import { DATA_SK_PREFIX, getOrderBys, SETTING_SK_PREFIX } from './helpers'

@Injectable()
export class CustomMasterDataService {
  constructor(
    private readonly masterDataService: MasterDataService,
    private readonly prismaService: PrismaService,
    private readonly dataService: DataService,
  ) {}

  async list(searchDto: MasterDataSearchDto, invokeContext: IInvoke) {
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

    const where: Prisma.MasterWhereInput = {
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

    const andConditions: Prisma.MasterWhereInput[] = []

    if (searchDto.keyword?.trim()) {
      andConditions.push({
        name: { contains: searchDto.keyword.trim() },
      })
    }

    if (searchDto.code?.trim()) {
      andConditions.push({
        masterCode: { contains: searchDto.code.trim() },
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
        orderBy: getOrderBys<Prisma.MasterOrderByWithRelationInput>(orderBys),
      }),
    ])

    return new MasterRdsListEntity({
      total,
      items: items.map((item) => new MasterRdsEntity(item)),
    })
  }

  async getDetail(@Param() key: DetailDto) {
    const data = await this.dataService.getItem(key)

    if (!data) throw new NotFoundException()

    return new MasterRdsEntity(data)
  }

  async create(createDto: MasterDataCreateDto, invokeContext: IInvoke) {
    const userContext = getUserContext(invokeContext)
    let seq = createDto?.seq
    if (!seq) {
      const maxSeq = await this.prismaService.master.aggregate({
        _max: {
          seq: true,
        },
        where: {
          tenantCode: userContext.tenantCode,
          masterType: DATA_SK_PREFIX,
          masterTypeCode: createDto.settingCode,
        },
      })
      seq = (maxSeq._max.seq ?? 0) + 1
      createDto.attributes['seq'] = seq
    }

    return await this.masterDataService.create(
      {
        code: createDto.code ?? ulid(),
        tenantCode: userContext.tenantCode,
        name: createDto.name,
        settingCode: createDto.settingCode,
        attributes: createDto.attributes ?? {},
        seq,
      },
      { invokeContext },
    )
  }

  async update(
    key: DetailDto,
    updateDto: MasterDataUpdateDto,
    invokeContext: IInvoke,
  ) {
    return await this.masterDataService.update(
      key,
      {
        ...updateDto,
      },
      { invokeContext },
    )
  }

  async delete(key: DetailDto, invokeContext: IInvoke) {
    return this.masterDataService.delete(key, { invokeContext })
  }

  async checkExistCode(
    settingCode: string,
    code: string,
    invokeContext: IInvoke,
  ) {
    const userContext = getUserContext(invokeContext)

    return this.masterDataService.checkExistCode(
      userContext.tenantCode,
      settingCode,
      code,
    )
  }

  private getTenantCode(userContext: UserContext): string {
    return userContext.tenantCode
  }
}
