import { IEvent } from './event.interface'

export interface IEventHandler<TEvent extends IEvent = any, TResult = any> {
  /**
   * Executes a event.
   * @param event The event to execute.
   */
  execute(event: TEvent): Promise<TResult>
}
