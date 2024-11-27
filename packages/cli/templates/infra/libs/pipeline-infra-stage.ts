import { CfnOutput, Stage, StageProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { InfraStack } from './infra-stack'
import { getConfig } from '../config'
import { Env } from '../config/type'

export interface PipelineInfraStageProps extends StageProps {
  appEnv: Env
}

export class PipelineInfraStage extends Stage {
  public readonly userPoolId: CfnOutput
  public readonly userPoolClientId: CfnOutput
  public readonly graphqlApiUrl: CfnOutput
  public readonly graphqlApiKey: CfnOutput
  public readonly httpApiUrl: CfnOutput
  public readonly httpDistributionDomain: CfnOutput

  constructor(scope: Construct, id: string, props: PipelineInfraStageProps) {
    super(scope, id, props)

    const config = getConfig(props.appEnv)
    const infraStack = new InfraStack(this, props.appEnv + 'InfraStack', {
      config,
    })

    this.userPoolId = infraStack.userPoolId
    this.userPoolClientId = infraStack.userPoolClientId
    this.graphqlApiUrl = infraStack.graphqlApiUrl
    this.graphqlApiKey = infraStack.graphqlApiKey
    this.httpApiUrl = infraStack.httpApiUrl
    this.httpDistributionDomain = infraStack.httpDistributionDomain
  }
}
