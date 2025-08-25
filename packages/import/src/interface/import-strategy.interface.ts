import { BadRequestException } from '@nestjs/common'
import { validate, ValidationError } from 'class-validator'

export interface IImportStrategy<
  TInput extends object,
  TAttributesDto extends object,
> {
  /**
   * Transforms a raw input object (from an API, CSV row, etc.)
   * into a standardized DTO.
   */
  transform(input: TInput): Promise<TAttributesDto>

  /**
   * Validates the standardized DTO.
   * @throws {Error} or a custom exception if validation fails.
   */
  validate(data: TAttributesDto): Promise<void>
}

/**
 * A base class (framework) that provides partial logic for an Import Strategy.
 * Users can extend this class to save effort.
 */
export abstract class BaseImportStrategy<
  TInput extends object,
  TAttributesDto extends object,
> implements IImportStrategy<TInput, TAttributesDto>
{
  async transform(input: TInput): Promise<TAttributesDto> {
    return input as unknown as TAttributesDto
  }

  async validate(data: TAttributesDto): Promise<void> {
    const errors = await validate(data)
    if (errors.length > 0) {
      const flatMessages = this.flattenValidationErrors(errors)
      throw new BadRequestException({
        statusCode: 400,
        message: flatMessages,
        error: 'Bad Request',
      })
    }
  }

  /**
   * Recursively flattens validation errors into a single array of strings.
   * @param errors The array of ValidationError objects.
   * @param parentPath The path of the parent property, used for building nested paths.
   * @returns An array of human-readable error strings.
   */
  private flattenValidationErrors(
    errors: ValidationError[],
    parentPath = '',
  ): string[] {
    const messages = []
    for (const error of errors) {
      const currentPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property

      // If there are children, recurse to find the nested errors
      if (error.children && error.children.length > 0) {
        messages.push(
          ...this.flattenValidationErrors(error.children, currentPath),
        )
      }
      // Otherwise, we've found the constraint. Format the message.
      else if (error.constraints) {
        // The default message from class-validator often includes the property name.
        // To avoid duplication like "attributes.policyType: policyType must be...",
        // we can simply replace the first word of the message with the full path.
        const firstConstraint = Object.values(error.constraints)[0]
        const message = firstConstraint.replace(error.property, currentPath)
        messages.push(message)
      }
    }
    return messages
  }
}
