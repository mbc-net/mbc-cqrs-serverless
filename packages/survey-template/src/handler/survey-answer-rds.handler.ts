import {
  CommandModel,
  IDataSyncHandler,
  KEY_SEPARATOR,
  removeSortKeyVersion,
} from '@mbc-cqrs-serverless/core'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { SurveyAnswerAttributes } from '../dto/survey-answer-attributes.dto'
import { SURVEY_ANSWER_SK_PREFIX } from '../keys'
import { PRISMA_SERVICE } from '../survey-template.module-definition'

@Injectable()
export class SurveyAnswerDataSyncRdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(SurveyAnswerDataSyncRdsHandler.name)

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prismaService: any,
  ) {}

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
    if (!cmd.sk.startsWith(`${SURVEY_ANSWER_SK_PREFIX}${KEY_SEPARATOR}`)) return
    const sk = removeSortKeyVersion(cmd.sk)
    const attrs = cmd.attributes as SurveyAnswerAttributes
    await this.prismaService.surveyAnswer.upsert({
      where: {
        id: cmd.id,
      },
      update: {
        csk: cmd.sk,
        name: cmd.name,
        version: cmd.version,
        seq: cmd.seq,
        isDeleted: cmd.isDeleted || false,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
        attributes: attrs.answer,
        surveyId: attrs.surveyId,
      },
      create: {
        id: cmd.id,
        cpk: cmd.pk,
        csk: cmd.sk,
        pk: cmd.pk,
        sk,
        code: sk,
        name: cmd.name,
        version: cmd.version,
        tenantCode: cmd.tenantCode,
        seq: cmd.seq,
        createdAt: cmd.createdAt,
        createdBy: cmd.createdBy,
        createdIp: cmd.createdIp,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,

        attributes: attrs.answer,
        surveyId: attrs.surveyId,
        email: attrs.email,
      },
    })
  }
  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
  }
}
