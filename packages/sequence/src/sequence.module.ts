import { Module } from '@nestjs/common'

import { SequencesController } from './sequences.controller'
import { SequencesService } from './sequences.service'

@Module({
  controllers: [SequencesController],
  providers: [SequencesService],
})
export class SequencesModule {}
