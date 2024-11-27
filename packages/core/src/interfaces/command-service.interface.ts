import {
  CommandInputModel,
  CommandModel,
  CommandPartialInputModel,
  ICommandOptions,
} from '.'

export interface ICommandService {
  /**
   * Publishes a command and processes it synchronously.
   *
   * @param {CommandInputModel} input - The complete command data to be published.
   * @param {ICommandOptions} options - Options for command execution, including context and additional parameters.
   * @returns {Promise<CommandModel>} The published command model.
   * @throws {BadRequestException} If the item does not exist or the input version is invalid.
   */
  publishSync(
    input: CommandInputModel,
    options: ICommandOptions,
  ): Promise<CommandModel>

  /**
   * Publishes a command and processes it asynchronously.
   *
   * @param {CommandInputModel} input - The complete command data to be published.
   * @param {ICommandOptions} options - Options for command execution, including context and additional parameters.
   * @returns {Promise<CommandModel|null>} The published command model, or `null` if the command was not updated (not dirty).
   * @throws {BadRequestException} If the input version is invalid.
   */
  publishAsync(
    input: CommandInputModel,
    options: ICommandOptions,
  ): Promise<CommandModel | null>

  /**
   * Publishes a partial command and processes it synchronously.
   *
   * @param {CommandPartialInputModel} input - The partial data used to update the command item.
   * @param {ICommandOptions} options - Options for command execution, including context and additional parameters.
   * @returns {Promise<CommandModel>} The updated command model after the publish operation.
   * @throws {BadRequestException} If the item does not exist for the provided keys.
   */
  publishPartialUpdateSync(
    input: CommandPartialInputModel,
    options: ICommandOptions,
  ): Promise<CommandModel>

  /**
   * Publishes a partial command and processes it asynchronously.
   *
   * @param {CommandPartialInputModel} input - The partial data used to update the command item.
   * @param {ICommandOptions} options - Options for command execution, including context and additional parameters.
   * @returns {Promise<CommandModel>} The updated command model after the publish operation.
   * @throws {BadRequestException} If the item does not exist for the provided keys.
   */
  publishPartialUpdateAsync(
    input: CommandPartialInputModel,
    options: ICommandOptions,
  ): Promise<CommandModel>
}
