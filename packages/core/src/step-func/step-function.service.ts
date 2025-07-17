import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const CLIENT_INSTANCE = Symbol('step-func')

@Injectable()
export class StepFunctionService {
  private [CLIENT_INSTANCE]: SFNClient

  constructor(private readonly config: ConfigService) {
    this[CLIENT_INSTANCE] = new SFNClient({
      endpoint: config.get<string>('SFN_ENDPOINT'),
      region: config.get<string>('SFN_REGION'),
    })
  }

  get client(): SFNClient {
    return this[CLIENT_INSTANCE]
  }

  startExecution(arn: string, input: any, name?: string) {
    return this.client.send(
      new StartExecutionCommand({
        stateMachineArn: arn,
        name: name && name.length <= 80 ? name : undefined,
        input: JSON.stringify(input),
      }),
    )
  }
}
