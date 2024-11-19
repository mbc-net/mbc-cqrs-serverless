import { DataEntity, DetailKey, IInvoke } from '@mbc-cqrs-serverless/core'

import { GenSequenceDto } from '../dto/gen-sequence.dto'

export interface ISequenceService {
  getCurrentSequence(key: DetailKey): Promise<DataEntity>

  genNewSequence(
    dto: GenSequenceDto,
    opts: {
      invokeContext: IInvoke
    },
  ): Promise<DataEntity>
}
