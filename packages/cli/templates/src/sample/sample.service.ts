import { SearchDto } from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { getOrderBys } from 'src/helpers'
import { PrismaService } from 'src/prisma'

import { SampleDataEntity } from './entity/sample-data.entity'
import { SampleDataListEntity } from './entity/sample-data-list.entity'

@Injectable()
export class SampleService {
  private readonly logger = new Logger(SampleService.name)

  constructor(private readonly prismaService: PrismaService) {}

  async searchData(searchDto: SearchDto): Promise<SampleDataListEntity> {
    const where: Prisma.SampleWhereInput = {
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
      this.prismaService.sample.count({ where }),
      this.prismaService.sample.findMany({
        where,
        take: pageSize,
        skip: pageSize * (page - 1),
        orderBy: getOrderBys<Prisma.SampleOrderByWithRelationInput>(orderBys),
      }),
    ])

    return new SampleDataListEntity({
      total,
      items: items.map(
        (item) =>
          new SampleDataEntity({
            ...item,
            attributes: {
              value: item.attributes as object,
            },
          }),
      ),
    })
  }
}
