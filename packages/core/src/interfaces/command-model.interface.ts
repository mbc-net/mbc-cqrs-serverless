import { CommandInputModel } from './command-input-model.interface'

export interface CommandModel extends CommandInputModel {
  status?: string
  source?: string // event source, e.x: POST /api/master
  requestId?: string
  createdAt?: Date
  updatedAt?: Date
  createdBy?: string
  updatedBy?: string
  createdIp?: string
  updatedIp?: string
  taskToken?: string
}
