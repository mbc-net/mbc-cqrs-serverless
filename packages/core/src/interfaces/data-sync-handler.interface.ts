import { CommandModel } from './command-model.interface'

export interface IDataSyncHandler<TExecuteResult = any, TRollbackResult = any> {
  /**
   * Upgrade data by a command.
   * @param cmd The command to upgrade
   */
  up(cmd: CommandModel): Promise<TExecuteResult>

  /**
   * Downgrade a command.
   * @param cmd The command to downgrade
   */
  down(cmd: CommandModel): Promise<TRollbackResult>
}
