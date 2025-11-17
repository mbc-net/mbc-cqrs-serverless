import {
  CommandService,
  DataService,
  generateId,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'
import { ulid } from 'ulid'

import { SurveyAnswerCommandDto } from './dto/survey-answer-command.dto'
import { SurveyAnswerCreateDto } from './dto/survey-answer-create.dto'
import { SurveyAnswerDataEntity } from './entity/survey-answer-data.entity'
import { SURVEY_ANSWER_SK_PREFIX } from './keys'

@Injectable()
export class SurveyAnswerService {
  private readonly logger = new Logger(SurveyAnswerService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async create(
    createDto: SurveyAnswerCreateDto,
    opts: { invokeContext: IInvoke },
  ): Promise<SurveyAnswerDataEntity> {
    this.logger.debug('createDto:', createDto)
    const { tenantCode } = getUserContext(opts.invokeContext)
    const pk = `SURVEY${KEY_SEPARATOR}${tenantCode}`
    const sk = `${SURVEY_ANSWER_SK_PREFIX}${KEY_SEPARATOR}${createDto.attributes.surveyId}${KEY_SEPARATOR}${ulid()}`
    const surveyAnswer = new SurveyAnswerCommandDto({
      pk,
      sk,
      id: generateId(pk, sk),
      tenantCode,
      name: '',
      code: sk,
      attributes: createDto.attributes,
    })
    const item = await this.commandService.publishAsync(surveyAnswer, opts)
    return new SurveyAnswerDataEntity(item as SurveyAnswerDataEntity)
  }
}
