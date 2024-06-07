import { SearchDto } from '@mbc-cqrs-severless/core'
import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { getOrderBys } from 'src/helpers'
import { PrismaService } from 'src/prisma'

import { MasterDataEntity } from './entity/master-data.entity'
import { MasterDataListEntity } from './entity/master-data-list.entity'

@Injectable()
export class MasterService {
  private readonly logger = new Logger(MasterService.name)

  constructor(private readonly prismaService: PrismaService) {}

  async searchData(searchDto: SearchDto): Promise<MasterDataListEntity> {
    const where: Prisma.MasterWhereInput = {
      isDeleted: false,
    }
    if (searchDto.keyword?.trim()) {
      where.name = { contains: searchDto.keyword.trim() }
    }
    if (searchDto.id) {
      where.id = searchDto.id
    }
    if (searchDto.pk) {
      where.pk = searchDto.pk
    }
    if (searchDto.sk) {
      where.sk = searchDto.sk
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

    return new MasterDataListEntity({
      total,
      items: items.map(
        (item) =>
          new MasterDataEntity({
            ...item,
            attributes: {
              master: item.atttributesMaster as object,
            },
          }),
      ),
    })
  }
}
