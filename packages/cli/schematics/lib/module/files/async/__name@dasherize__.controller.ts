import {
  DetailDto,
  getUserContext,
  IInvoke,
  INVOKE_CONTEXT,
  SearchDto,
} from '@mbc-cqrs-serverless/core'
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { <%= classify(name) %>Service } from './<%= dasherize(name) %>.service'
import { <%= classify(name) %>CreateDto } from './dto/<%= dasherize(name) %>-create.dto'
import { <%= classify(name) %>UpdateDto } from './dto/<%= dasherize(name) %>-update.dto'
import { <%= classify(name) %>DataEntity } from './entity/<%= dasherize(name) %>-data.entity'

@Controller('api/<%= dasherize(name) %>')
@ApiTags('<%= dasherize(name) %>')
export class <%= classify(name) %>Controller {
  private readonly logger = new Logger(<%= classify(name) %>Controller.name)

  constructor(private readonly <%= camelize(name) %>Service: <%= classify(name) %>Service) {}

  @Post('/')
  async create(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() createDto: <%= classify(name) %>CreateDto,
  ): Promise<<%= classify(name) %>DataEntity> {
    this.logger.debug('createDto:', createDto)
    return this.<%= camelize(name) %>Service.create(createDto, { invokeContext })
  }

  <% if (schema) { %>@Get('/')
  async findAll(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Query() searchDto: SearchDto,
  ) {
    this.logger.debug('searchDto:', searchDto)
    const { tenantCode } = getUserContext(invokeContext)
    return await this.<%= camelize(name) %>Service.findAll(tenantCode, searchDto)
  }<% } %>

  @Get('/:pk/:sk')
  async findOne(@Param() detailDto: DetailDto): Promise<<%= classify(name) %>DataEntity> {
    return this.<%= camelize(name) %>Service.findOne(detailDto)
  }

  @Patch('/:pk/:sk')
  async update(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() detailDto: DetailDto,
    @Body() updateDto: <%= classify(name) %>UpdateDto,
  ) {
    this.logger.debug('updateDto:', updateDto)
    return this.<%= camelize(name) %>Service.update(detailDto, updateDto, { invokeContext })
  }

  @Delete('/:pk/:sk')
  async remove(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param() detailDto: DetailDto,
  ) {
    return this.<%= camelize(name) %>Service.remove(detailDto, { invokeContext })
  }
}
