import {
  SFNClient,
  SendTaskSuccessCommand,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const CLIENT_INSTANCE = Symbol('step-func')

@Injectable()
export class StepFunctionService {
  private readonly logger: Logger
  private [CLIENT_INSTANCE]: SFNClient

  constructor(private readonly config: ConfigService) {
    this.logger = new Logger(StepFunctionService.name)
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

  async resumeExecution(taskToken: string, output: any = {}) {
    try {
      this.logger.debug(
        `Resuming execution with token: ${taskToken.substring(0, 10)}...`,
      )
      return await this.client.send(
        new SendTaskSuccessCommand({
          taskToken: taskToken,
          output: JSON.stringify(output),
        }),
      )
    } catch (error) {
      this.logger.error(
        `Failed to resume execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }
}
