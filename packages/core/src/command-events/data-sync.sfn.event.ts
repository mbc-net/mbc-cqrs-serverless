import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'

import { COMMAND_TABLE_SUFFIX, DATA_TABLE_SUFFIX } from '../constants'
import {
  CommandModel,
  DetailKey,
  IEvent,
  StepFunctionsContext,
} from '../interfaces'
import { DataSyncNewCommandEvent } from './data-sync.new.event'

export interface StepFunctionStateInput {
  prevStateName?: string // undefined if no state before step
  result?: unknown
  error?: string
  cause?: string
}

export class DataSyncCommandSfnEvent implements IEvent {
  source: string
  context: StepFunctionsContext
  commandEvent?: DataSyncNewCommandEvent
  input?: StepFunctionStateInput
  taskToken?: string

  constructor(event?: Partial<DataSyncCommandSfnEvent>) {
    Object.assign(this, event)
    if (event?.context) {
      this.commandEvent = new DataSyncNewCommandEvent(
        event.context.Execution.Input,
      )
      this.source = event.context.StateMachine.Id
    }
  }

  get commandTableName(): string {
    return this.commandEvent?.tableName
  }

  get dataTableName(): string {
    return this.commandTableName.replace(
      COMMAND_TABLE_SUFFIX,
      DATA_TABLE_SUFFIX,
    )
  }

  get stepStateName(): string {
    return this.context.State.Name
  }

  private commandModel?: CommandModel
  get commandRecord(): CommandModel | null {
    if (this.commandModel) {
      return this.commandModel
    }

    if (!this.commandEvent?.dynamodb?.NewImage) {
      return null
    }

    const newImage = this.commandEvent?.dynamodb?.NewImage as {
      [key: string]: AttributeValue
    }

    this.commandModel = unmarshall(newImage) as CommandModel
    // TODO convert S3 attributes
    if (this.commandModel.createdAt) {
      this.commandModel.createdAt = new Date(this.commandModel.createdAt)
    }

    if (this.commandModel.updatedAt) {
      this.commandModel.updatedAt = new Date(this.commandModel.updatedAt)
    }
    return this.commandModel
  }

  get commandKey(): DetailKey {
    return {
      pk: this.commandRecord.pk,
      sk: this.commandRecord.sk,
    }
  }
}
