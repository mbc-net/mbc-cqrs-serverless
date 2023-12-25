export interface StepFunctionsContextExecution {
  Id: string
  Input: { [id: string]: any }
  Name: string
  RoleArn: string
  StartTime: string
}

export interface StepFunctionsContextState {
  EnteredTime: string
  Name: string
  RetryCount: number
}

export interface StepFunctionsContextStateMachine {
  Id: string
  Name: string
}

export interface StepFunctionsContext {
  Execution: StepFunctionsContextExecution
  State: StepFunctionsContextState
  StateMachine: StepFunctionsContextStateMachine
}

export interface StepFunctionsEvent<TInput> {
  input: TInput
  context: StepFunctionsContext
}
