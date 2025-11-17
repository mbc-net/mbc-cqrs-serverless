import {
  CommandModel,
  IDataSyncHandler,
  removeSortKeyVersion,
} from '@mbc-cqrs-serverless/core'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { SURVEY_TEMPLATE_SK_PREFIX } from '../keys'
import { PRISMA_SERVICE } from '../survey-template.module-definition'

@Injectable()
export class SurveyTemplateDataSyncRdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(SurveyTemplateDataSyncRdsHandler.name)

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prismaService: any,
  ) {}

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
    if (!cmd.sk.startsWith(SURVEY_TEMPLATE_SK_PREFIX)) return
    const sk = removeSortKeyVersion(cmd.sk)
    await this.prismaService.surveyTemplate.upsert({
      where: {
        id: cmd.id,
      },
      update: {
        csk: cmd.sk,
        name: cmd.name,
        version: cmd.version,
        seq: cmd.seq,
        description: cmd.attributes?.description,
        surveyTemplate: cmd.attributes?.surveyTemplate,
        additionalProperties: cmd.attributes?.additionalProperties || {},
        isDeleted: cmd.isDeleted || false,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
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
        description: cmd.attributes?.description,
        surveyTemplate: cmd.attributes?.surveyTemplate,
        additionalProperties: cmd.attributes?.additionalProperties || {},
        createdAt: cmd.createdAt,
        createdBy: cmd.createdBy,
        createdIp: cmd.createdIp,
        updatedAt: cmd.updatedAt,
        updatedBy: cmd.updatedBy,
        updatedIp: cmd.updatedIp,
      },
    })
  }
  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
  }
}
