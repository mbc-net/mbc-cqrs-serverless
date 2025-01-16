import {
  CommandPartialInputModel,
  CommandService,
  DataService,
  DetailDto,
  generateId,
  getUserContext,
  IInvoke,
  toISOStringWithTimezone,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { getOrderBys, parsePk } from 'src/helpers'
import { PrismaService } from 'src/prisma'
import { ulid } from 'ulid'

import { <%= classify(name) %>CommandDto } from './dto/<%= dasherize(name) %>-command.dto'
import { <%= classify(name) %>CreateDto } from './dto/<%= dasherize(name) %>-create.dto'
import { <%= classify(name) %>SearchDto } from './dto/<%= dasherize(name) %>-search.dto'
import { <%= classify(name) %>UpdateDto } from './dto/<%= dasherize(name) %>-update.dto'
import { <%= classify(name) %>DataEntity } from './entity/<%= dasherize(name) %>-data.entity'
import { <%= classify(name) %>DataListEntity } from './entity/<%= dasherize(name) %>-data-list.entity'

@Injectable()
export class <%= classify(name) %>Service {
  private readonly logger = new Logger(<%= classify(name) %>Service.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
    <% if (schema) { %>private readonly prismaService: PrismaService,<% } %>
  ) {}

  async create(
    createDto: <%= classify(name) %>CreateDto,
    opts: { invokeContext: IInvoke },
  ): Promise<<%= classify(name) %>DataEntity> {
    const { tenantCode } = getUserContext(opts.invokeContext)
    const pk = `<%= name.toUpperCase() %>${KEY_SEPARATOR}${tenantCode}`
    const sk = ulid()
    const <%= camelize(name) %> = new <%= classify(name) %>CommandDto({
      pk,
      sk,
      id: generateId(pk, sk),
      tenantCode,
      code: sk,
      type: '<%= name.toUpperCase() %>',
      version: VERSION_FIRST,
      name: createDto.name,
      attributes: createDto.attributes,
    })
    const item = await this.commandService.publishAsync(<%= camelize(name) %>, opts)
    return new <%= classify(name) %>DataEntity(item as <%= classify(name) %>DataEntity)
  }

  async findOne(detailDto: DetailDto): Promise<<%= classify(name) %>DataEntity> {
    const item = await this.dataService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException('<%= classify(name) %> not found!')
    }
    this.logger.debug('item:', item)
    return new <%= classify(name) %>DataEntity(item as <%= classify(name) %>DataEntity)
  }

  <% if (schema) { %>async findAll(
    tenantCode: string,
    searchDto: <%= classify(name) %>SearchDto,
  ): Promise<<%= classify(name) %>DataListEntity> {
    const where: Prisma.<%= classify(name) %>WhereInput = {
      isDeleted: false,
      tenantCode,
    }

    const { pageSize = 10, page = 1, orderBys = ['-createdAt'] } = searchDto

    const [total, items] = await Promise.all([
      this.prismaService.<%= camelize(name) %>.count({ where }),
      this.prismaService.<%= camelize(name) %>.findMany({
        where,
        take: pageSize,
        skip: pageSize * (page - 1),
        orderBy: getOrderBys<Prisma.<%= classify(name) %>OrderByWithRelationInput>(orderBys),
      }),
    ])

    return new <%= classify(name) %>DataListEntity({
      total,
      items: items.map(
        (item) =>
          new <%= classify(name) %>DataEntity({
            ...item,
            attributes: {
              value: item.attributes as object,
            },
          }),
      ),
    })
  }<% } %>

  async update(
    detailDto: DetailDto,
    updateDto: <%= classify(name) %>UpdateDto,
    opts: { invokeContext: IInvoke },
  ): Promise<<%= classify(name) %>DataEntity> {
    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode } = parsePk(detailDto.pk)
    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    const data = (await this.dataService.getItem(detailDto)) as <%= classify(name) %>DataEntity
    if (!data) {
      throw new NotFoundException('<%= classify(name) %> not found!')
    }
    const commandDto = new <%= classify(name) %>CommandDto({
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      name: updateDto.name ?? data.name,
      isDeleted: updateDto.isDeleted ?? data.isDeleted,
      attributes: {
        ...data.attributes,
        ...updateDto.attributes,
      },
    })
    const item = await this.commandService.publishPartialUpdateAsync(
      commandDto,
      opts,
    )
    return new <%= classify(name) %>DataEntity(item as <%= classify(name) %>DataEntity)
  }

  async remove(key: DetailDto, opts: { invokeContext: IInvoke }) {
    const userContext = getUserContext(opts.invokeContext)
    const { tenantCode } = parsePk(key.pk)

    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }

    const data = (await this.dataService.getItem(key)) as <%= classify(name) %>DataEntity
    if (!data) {
      throw new NotFoundException()
    }
    const commandDto: CommandPartialInputModel = {
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      isDeleted: true,
    }
    const item = await this.commandService.publishPartialUpdateAsync(
      commandDto,
      opts,
    )

    return new <%= classify(name) %>DataEntity(item as any)
  }
}
