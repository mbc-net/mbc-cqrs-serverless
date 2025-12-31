import {
  CommandService,
  DataService,
  DetailDto,
  IInvoke,
  INVOKE_CONTEXT,
  SearchDto,
} from '@mbc-cqrs-serverless/core'
import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { SampleCommandDto } from './dto/sample-command.dto'
import { SampleCommandEntity } from './entity/sample-command.entity'
import { SampleDataEntity } from './entity/sample-data.entity'
import { SampleDataListEntity } from './entity/sample-data-list.entity'
import { SampleService } from './sample.service'

@Controller('api/sample')
@ApiTags('sample')
export class SampleController {
  private readonly logger = new Logger(SampleController.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
    private readonly sampleService: SampleService,
  ) {}

  @Post('/')
  async publishCommand(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() sampleDto: SampleCommandDto,
  ): Promise<SampleDataEntity> {
    this.logger.debug('cmd:', sampleDto)
    this.logger.debug('commandService:' + this.commandService.tableName)
    const item = await this.commandService.publishAsync(sampleDto, {
      invokeContext,
    })
    return new SampleDataEntity(item as SampleDataEntity)
  }

  @Get('command/:pk/:sk')
  async getCommand(
    @Param() detailDto: DetailDto,
  ): Promise<SampleCommandEntity> {
    this.logger.debug('commandService:' + this.commandService.tableName)
    const item = await this.commandService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException('Sample command not found')
    }
    this.logger.debug('item:', item)
    return new SampleCommandEntity(item as SampleCommandEntity)
  }

  @Get('data/:pk/:sk')
  async getData(@Param() detailDto: DetailDto): Promise<SampleDataEntity> {
    this.logger.debug('dataService:' + this.dataService.tableName)
    const item = await this.dataService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException('Sample data not found')
    }
    this.logger.debug('item:', item)
    return new SampleDataEntity(item as SampleDataEntity)
  }

  @Get('data/:pk')
  async listDataByPk(@Param('pk') pk: string): Promise<SampleDataListEntity> {
    const res = await this.dataService.listItemsByPk(pk)
    return new SampleDataListEntity(res as SampleDataListEntity)
  }

  @Get('data')
  async searchData(@Query() searchDto: SearchDto) {
    return await this.sampleService.searchData(searchDto)
  }
}
