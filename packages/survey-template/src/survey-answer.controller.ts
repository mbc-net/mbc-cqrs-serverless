import { INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import { IInvoke } from '@mbc-cqrs-serverless/core'
import { Controller, Logger, Post } from '@nestjs/common'
import { Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { SurveyAnswerCreateDto } from './dto/survey-answer-create.dto'
import { SurveyAnswerDataEntity } from './entity/survey-answer-data.entity'
import { SurveyAnswerService } from './survey-answer.service'

@ApiTags('survey-answer')
@Controller('api/survey-answer')
export class SurveyAnswerController {
  private readonly logger = new Logger(SurveyAnswerController.name)

  constructor(private readonly surveyAnswerService: SurveyAnswerService) {}

  @Post('/')
  async create(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createDto: SurveyAnswerCreateDto,
  ): Promise<SurveyAnswerDataEntity> {
    this.logger.debug('createDto:', createDto)
    return await this.surveyAnswerService.create(createDto, { invokeContext })
  }
}
