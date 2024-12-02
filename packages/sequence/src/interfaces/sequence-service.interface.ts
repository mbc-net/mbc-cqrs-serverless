import { DataEntity, DetailKey, IInvoke } from '@mbc-cqrs-serverless/core'

import {
  GenerateFormattedSequenceDto,
  GenSequenceDto,
} from '../dto/gen-sequence.dto'
import { SequenceEntity } from '../entities/sequence.entity'

export interface ISequenceService {
  /**
   * Get the current sequence by a specific key.
   * @param key - The key to identify the sequence details.
   * @returns A promise that resolves to the current sequence's data entity.
   */
  getCurrentSequence(key: DetailKey): Promise<DataEntity>

  /**
   * Generate a new sequence based on the provided parameters.
   * @param dto - The data transfer object containing generation parameters.
   * @param options - Additional options including invocation context.
   * @returns A promise that resolves to the newly generated sequence's data entity.
   */
  genNewSequence(
    dto: GenSequenceDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<DataEntity>

  /**
   * Generate a new sequence with a specified format.
   * @param dto - The data transfer object containing parameters for formatted sequence generation.
   * @param options - Additional options including invocation context.
   * @returns A promise that resolves to the newly generated formatted sequence's data entity.
   */
  generateSequenceItem(
    dto: GenerateFormattedSequenceDto,
    options?: {
      invokeContext: IInvoke
    },
  ): Promise<SequenceEntity>
}
