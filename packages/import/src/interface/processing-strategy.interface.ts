import {
  CommandInputModel,
  CommandPartialInputModel,
  CommandService,
  DataModel,
} from '@mbc-cqrs-serverless/core'

import { ComparisonStatus } from '../enum/comparison-status.enum'

/**
 * Defines the standardized result of a comparison operation.
 * It indicates whether the imported data corresponds to a new, changed, or identical entity.
 * @template TEntity The type of the database entity model, extending DataModel.
 */
export interface ComparisonResult<TEntity extends DataModel> {
  status: ComparisonStatus
  /**
   * If the status is 'CHANGED', this property holds the existing entity data
   * retrieved from the database. It is undefined otherwise.
   */
  existingData?: TEntity
}

/**
 * The core strategy interface for processing a single, validated import record.
 * Developers implement this interface to define the business logic for comparing
 * imported data with existing records and mapping it to the final database model.
 *
 * @template TEntity The type of the final database entity model (e.g., ProductModel).
 * @template TAttributesDto The type of the validated attributes DTO (e.g., CreateProductImportAttributesDto).
 */
export interface IProcessStrategy<
  TEntity extends DataModel,
  TAttributesDto extends object,
> {
  /**
   * Compares the validated import data with data already in the target system
   * to determine if it's a new entity, a changed one, or identical.
   * @param importAttributes The strongly-typed, validated attributes object.
   * @param tenantCode The tenant code for the operation.
   * @returns A promise that resolves with a ComparisonResult object.
   */
  compare(
    importAttributes: TAttributesDto,
    tenantCode: string,
  ): Promise<ComparisonResult<TEntity>>

  /**
   * Maps the validated import data into the precise input model required by the CommandService.
   * The implementer is responsible for constructing the correct payload for either a
   * create (`CommandInputModel`) or an update (`CommandPartialInputModel`).
   *
   * @param status The result from the `compare` step ('NOT_EXIST' or 'CHANGED').
   * @param importAttributes The strongly-typed, validated attributes object.
   * @param tenantCode The tenant code for the operation.
   * @param existingData The existing entity data, provided if status is 'CHANGED'.
   * @returns A promise that resolves with the input model for the CommandService.
   */
  map(
    status: Exclude<ComparisonStatus, ComparisonStatus.EQUAL>,
    importAttributes: TAttributesDto,
    tenantCode: string,
    existingData?: TEntity,
  ): Promise<CommandInputModel | CommandPartialInputModel>

  /**
   * Provides an instance of the command service for the final database write.
   */
  getCommandService(): CommandService
}
/**
 * A base class (framework) for a Process Strategy.
 */
export abstract class BaseProcessStrategy<
  TEntity extends DataModel,
  TTransformedDto extends object,
> implements IProcessStrategy<TEntity, TTransformedDto>
{
  abstract compare(
    transformedData: TTransformedDto,
    tenantCode: string,
  ): Promise<ComparisonResult<TEntity>>

  abstract map(
    status: Exclude<ComparisonStatus, ComparisonStatus.EQUAL>,
    transformedData: TTransformedDto,
    tenantCode: string,
    existingData?: TEntity,
  ): Promise<CommandInputModel | CommandPartialInputModel>

  abstract getCommandService(): CommandService
}
