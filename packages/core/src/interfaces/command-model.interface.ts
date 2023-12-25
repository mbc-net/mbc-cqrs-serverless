import { CommandInputModel } from './command-input-model.interface'

export interface CommandModel extends CommandInputModel {
  status?: string
  requestId: string
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  createdIp: string
  updatedIp: string
}
