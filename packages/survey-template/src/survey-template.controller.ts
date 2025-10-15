import {
  DetailDto,
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
  SearchDto,
} from '@mbc-cqrs-serverless/core'
import { DetailKeys } from '@mbc-cqrs-serverless/master'
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { SurveyTemplateCreateDto } from './dto/survey-template-create.dto'
import { SurveyTemplateUpdateDto } from './dto/survey-template-update.dto'
import { SurveyTemplateDataEntity } from './entity/survey-template-data.entity'
import { SurveyTemplateService } from './survey-template.service'

@Controller('api/survey-template')
@ApiTags('survey-template')
export class SurveyTemplateController {
  private readonly logger = new Logger(SurveyTemplateController.name)

  constructor(private readonly surveyTemplateService: SurveyTemplateService) {}

  @Get('/')
  async searchData(
    @Query() searchDto: SearchDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    const { tenantCode } = getUserContext(invokeContext)
    return await this.surveyTemplateService.searchData(tenantCode, searchDto)
  }

  @Post('/')
  async create(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createDto: SurveyTemplateCreateDto,
  ): Promise<SurveyTemplateDataEntity> {
    this.logger.debug('createDto:', createDto)

    return await this.surveyTemplateService.create(createDto, { invokeContext })
  }

  @Get('/:id')
  async getData(
    @DetailKeys() detailDto: DetailDto,
  ): Promise<SurveyTemplateDataEntity> {
    return await this.surveyTemplateService.findOne(detailDto)
  }

  @Put('/:id')
  async updateData(
    @DetailKeys() detailDto: DetailDto,
    @Body() updateDto: SurveyTemplateUpdateDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    this.logger.debug('updateDto:', updateDto)
    return await this.surveyTemplateService.update(detailDto, updateDto, {
      invokeContext,
    })
  }

  @Delete('/:id')
  async deleteData(
    @DetailKeys() detailDto: DetailDto,
    @INVOKE_CONTEXT() invokeContext: IInvoke,
  ) {
    return await this.surveyTemplateService.remove(detailDto, { invokeContext })
  }
}
