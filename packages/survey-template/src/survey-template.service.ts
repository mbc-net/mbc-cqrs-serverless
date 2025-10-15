import {
  CommandService,
  DataService,
  DetailDto,
  generateId,
  getCommandSource,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  SearchDto,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { basename } from 'path'
import { ulid } from 'ulid'

import { SurveyTemplateCommandDto } from './dto/survey-template-command.dto'
import { SurveyTemplateCreateDto } from './dto/survey-template-create.dto'
import { SurveyTemplateUpdateDto } from './dto/survey-template-update.dto'
import { SurveyTemplateDataEntity } from './entity/survey-template-data.entity'
import { SurveyTemplateDataListEntity } from './entity/survey-template-data-list.entity'
import { SURVEY_TEMPLATE_SK_PREFIX } from './keys'
import { PRISMA_SERVICE } from './survey-template.module-definition'
import { getOrderBys, parsePk } from './utils'

@Injectable()
export class SurveyTemplateService {
  private readonly logger = new Logger(SurveyTemplateService.name)

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prismaService: any,
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async searchData(
    tenantCode: string,
    searchDto: SearchDto,
  ): Promise<SurveyTemplateDataListEntity> {
    const where: any = {
      isDeleted: false,
      tenantCode,
    }
    if (searchDto.keyword?.trim()) {
      where.OR = [
        { name: { contains: searchDto.keyword.trim(), mode: 'insensitive' } },
        {
          description: {
            contains: searchDto.keyword.trim(),
            mode: 'insensitive',
          },
        },
      ]
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
      this.prismaService.surveyTemplate.count({ where }),
      this.prismaService.surveyTemplate.findMany({
        where,
        take: pageSize,
        skip: pageSize * (page - 1),
        orderBy: getOrderBys(orderBys),
      }),
    ])

    return new SurveyTemplateDataListEntity({
      total,
      items: items.map(
        (item) =>
          new SurveyTemplateDataEntity({
            ...item,
            attributes: {
              surveyTemplate: item.surveyTemplate as object,
              description: item.description,
            },
          }),
      ),
    })
  }

  async create(
    createDto: SurveyTemplateCreateDto,
    options: { invokeContext: IInvoke },
  ): Promise<SurveyTemplateDataEntity> {
    const { tenantCode } = getUserContext(options.invokeContext)
    const pk = `SURVEY${KEY_SEPARATOR}${tenantCode}`
    const sk = `${SURVEY_TEMPLATE_SK_PREFIX}${KEY_SEPARATOR}${ulid()}`

    const commandDto: SurveyTemplateCommandDto = {
      pk,
      sk,
      id: generateId(pk, sk),
      tenantCode,
      code: sk,
      type: SURVEY_TEMPLATE_SK_PREFIX,
      version: VERSION_FIRST,
      name: createDto.name,
      attributes: createDto.attributes,
    }

    this.logger.debug('commandService:' + this.commandService.tableName)
    const item = await this.commandService.publishAsync(commandDto, {
      invokeContext: options.invokeContext,
      source: getCommandSource(
        basename(__dirname),
        this.constructor.name,
        'create',
      ),
    })
    return new SurveyTemplateDataEntity(item as SurveyTemplateDataEntity)
  }

  async findOne(detailDto: DetailDto): Promise<SurveyTemplateDataEntity> {
    const item = await this.dataService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException('Survey template not found!')
    }
    return new SurveyTemplateDataEntity(item as SurveyTemplateDataEntity)
  }

  async update(
    detailDto: DetailDto,
    updateDto: SurveyTemplateUpdateDto,
    options: { invokeContext: IInvoke },
  ): Promise<SurveyTemplateDataEntity> {
    const userContext = getUserContext(options.invokeContext)
    const { tenantCode } = parsePk(detailDto.pk)
    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    const data = (await this.dataService.getItem(
      detailDto,
    )) as SurveyTemplateDataEntity
    if (!data) {
      throw new NotFoundException('Survey template not found!')
    }
    const commandDto = new SurveyTemplateCommandDto({
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
      {
        invokeContext: options.invokeContext,
        source: getCommandSource(
          basename(__dirname),
          this.constructor.name,
          'update',
        ),
      },
    )
    return new SurveyTemplateDataEntity(item as SurveyTemplateDataEntity)
  }

  async remove(detailDto: DetailDto, options: { invokeContext: IInvoke }) {
    const userContext = getUserContext(options.invokeContext)
    const { tenantCode } = parsePk(detailDto.pk)
    if (userContext.tenantCode !== tenantCode) {
      throw new BadRequestException('Invalid tenant code')
    }
    const data = (await this.dataService.getItem(
      detailDto,
    )) as SurveyTemplateDataEntity
    if (!data) {
      throw new NotFoundException('Survey template not found!')
    }
    const commandDto = new SurveyTemplateCommandDto({
      pk: data.pk,
      sk: data.sk,
      version: data.version,
      isDeleted: true,
    })

    const item = await this.commandService.publishPartialUpdateAsync(
      commandDto,
      {
        invokeContext: options.invokeContext,
        source: getCommandSource(
          basename(__dirname),
          this.constructor.name,
          'remove',
        ),
      },
    )
    return new SurveyTemplateDataEntity(item as SurveyTemplateDataEntity)
  }
}
