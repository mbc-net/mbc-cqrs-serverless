import {
  DetailKey,
  IEvent,
  StepFunctionsContext,
} from '@mbc-cqrs-serverless/core'

import { TaskEntity } from '../entity'

export interface StepFunctionStateInput {
  prevStateName?: string // undefined if no state before step
  result?: unknown
  error?: string
  cause?: string
}

export class StepFunctionTaskEvent implements IEvent {
  source: string
  context: StepFunctionsContext
  input?: TaskEntity
  taskToken?: string

  constructor(event?: Partial<StepFunctionTaskEvent>) {
    Object.assign(this, event)
    if (event?.context) {
      this.source = event.context.StateMachine.Id
    }
  }

  get taskKey(): DetailKey {
    return {
      pk: this.input.pk,
      sk: this.input.sk,
    }
  }
}
