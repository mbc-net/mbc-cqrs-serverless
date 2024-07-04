import {
  CommandService,
  DataService,
  DetailDto,
  IInvoke,
  INVOKE_CONTEXT,
  SearchDto,
} from '@mbc-cqrs-severless/core'
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

import { MasterCommandDto } from './dto/master-command.dto'
import { MasterCommandEntity } from './entity/master-command.entity'
import { MasterDataEntity } from './entity/master-data.entity'
import { MasterDataListEntity } from './entity/master-data-list.entity'
import { MasterService } from './master.service'

@Controller('api/master')
@ApiTags('master')
export class MasterController {
  private readonly logger = new Logger(MasterController.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
    private readonly masterService: MasterService,
  ) {}

  @Post('/')
  async publishCommand(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() masterDto: MasterCommandDto,
  ): Promise<MasterDataEntity> {
    this.logger.debug('cmd:', masterDto)
    this.logger.debug('commandService:' + this.commandService.tableName)
    const item = await this.commandService.publish(masterDto, { invokeContext })
    return new MasterDataEntity(item as MasterDataEntity)
  }

  @Get('command/:pk/:sk')
  async getCommand(
    @Param() detailDto: DetailDto,
  ): Promise<MasterCommandEntity> {
    this.logger.debug('commandService:' + this.commandService.tableName)
    const item = await this.commandService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException()
    }
    this.logger.debug('item:', item)
    return new MasterCommandEntity(item as MasterCommandEntity)
  }

  @Get('data/:pk/:sk')
  async getData(@Param() detailDto: DetailDto): Promise<MasterDataEntity> {
    this.logger.debug('dataService:' + this.dataService.tableName)
    const item = await this.dataService.getItem(detailDto)
    if (!item) {
      throw new NotFoundException()
    }
    this.logger.debug('item:', item)
    return new MasterDataEntity(item as MasterDataEntity)
  }

  @Get('data/:pk')
  async listDataByPk(@Param('pk') pk: string): Promise<MasterDataListEntity> {
    const res = await this.dataService.listItemsByPk(pk)
    return new MasterDataListEntity(res as MasterDataListEntity)
  }

  @Get('data')
  async searchData(@Query() searchDto: SearchDto) {
    return await this.masterService.searchData(searchDto)
  }
}
