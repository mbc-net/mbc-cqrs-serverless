import { IInvoke } from '../context'

export interface ICommandOptions {
  source?: string
  requestId?: string

  invokeContext: IInvoke
}
