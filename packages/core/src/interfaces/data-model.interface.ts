import { CommandModel } from './command-model.interface'

export interface DataModel extends Omit<CommandModel, 'status'> {
  cpk?: string
  csk?: string
}
