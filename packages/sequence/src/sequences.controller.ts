import { DetailDto, IInvoke, INVOKE_CONTEXT } from '@mbc-cqrs-serverless/core'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { GenerateFormattedSequenceDto } from './dto/gen-sequence.dto'
import { SequencesService } from './sequences.service'
@ApiTags('sequence')
@Controller()
export class SequencesController {
  constructor(private readonly sequenceService: SequencesService) {}

  @Get('/:pk/:sk')
  async getSequence(@Param() dto: DetailDto) {
    return await this.sequenceService.getCurrentSequence(dto)
  }

  @Post('/')
  async genSequence(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: GenerateFormattedSequenceDto,
  ) {
    return await this.sequenceService.generateSequenceItem(dto, {
      invokeContext,
    })
  }
}
