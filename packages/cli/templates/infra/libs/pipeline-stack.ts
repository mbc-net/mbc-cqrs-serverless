import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { BuildSpec, ReportGroup } from 'aws-cdk-lib/aws-codebuild'
import {
  CodeBuildStep,
  CodePipeline,
  CodePipelineSource,
  ShellStep,
} from 'aws-cdk-lib/pipelines'
import { Construct } from 'constructs'
import {
  GIT_CONNECTION_ARN,
  GIT_REPO,
  PIPELINE_NAME,
  getConfig,
} from '../config'
import { Env } from '../config/type'
import { PipelineInfraStage } from './pipeline-infra-stage'

export interface PipelineStackProps extends StackProps {
  envName: Env
}

const mappingBranchName = {
  dev: 'develop',
  stg: 'staging',
}

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: PipelineStackProps) {
    super(scope, id, props)

    const env = props?.envName || 'dev'

    const idName = env.charAt(0).toUpperCase() + env.slice(1)
    const branchName =
      mappingBranchName[env as keyof typeof mappingBranchName] || 'main'

    const config = getConfig(env)
    const name = config.appName

    const prefix = `${env}-${name}-`

    const unitTestReports = new ReportGroup(this, `${prefix}UnitTestReports`, {
      reportGroupName: `${prefix}UnitTestReports`,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const testStep = new CodeBuildStep(`${prefix}Test`, {
      projectName: `${prefix}Test`,
      installCommands: [
        'apt install graphviz -y',
        'npm i -g pnpm',
        'npm ci',
        'pnpm --dir ./infra install --frozen-lockfile',
      ],
      commands: [
        'npm run test', // source test
        'npm --prefix ./infra run test', // infra snapshot test
        'npm --prefix ./infra run cdk synth', // generate infra diagram
        'npm ci && cp .env.local .env && npm run generate:swagger', // generate api doc
      ],
      primaryOutputDirectory: 'report',
      partialBuildSpec: BuildSpec.fromObject({
        reports: {
          [unitTestReports.reportGroupArn]: {
            files: ['*.xml'],
            'base-directory': 'report',
            'discard-paths': true,
          },
        },
      }),
    })

    const pipeline = new CodePipeline(this, idName + 'PipelineV3', {
      selfMutation: true,
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection(GIT_REPO, branchName, {
          connectionArn: GIT_CONNECTION_ARN,
        }),
        additionalInputs: {
          testOut: testStep,
        },
        commands: [
          'npm i -g pnpm',
          'cd infra',
          'pnpm install --frozen-lockfile',
          'npm run build',
          'npx cdk synth ' + id + ' -e',
        ],
        primaryOutputDirectory: 'infra/cdk.out',
      }),
    })

    const infraPipelineStage = new PipelineInfraStage(
      this,
      idName + PIPELINE_NAME + 'InfraStage',
      {
        appEnv: env,
        env: { account: this.account, region: this.region },
      },
    )

    const infraStage = pipeline.addStage(infraPipelineStage)
    infraStage.addPost(
      new ShellStep('validate', {
        envFromCfnOutputs: {
          OUTPUT_HTTP_API_URL: infraPipelineStage.httpApiUrl,
          OUTPUT_GRAPHQL_API_URL: infraPipelineStage.graphqlApiUrl,
          OUTPUT_GRAPHQL_API_KEY: infraPipelineStage.graphqlApiKey,
          OUTPUT_USER_POOL_ID: infraPipelineStage.userPoolId,
          OUTPUT_HTTP_DISTRIBUTION_DOMAIN:
            infraPipelineStage.httpDistributionDomain,
        },
        commands: [
          'echo $OUTPUT_HTTP_API_URL',
          'echo $OUTPUT_GRAPHQL_API_URL',
          'echo $OUTPUT_GRAPHQL_API_KEY',
          'echo $OUTPUT_USER_POOL_ID',
          'echo $OUTPUT_HTTP_DISTRIBUTION_DOMAIN',
        ],
      }),
    )
    pipeline.buildPipeline()
    unitTestReports.grantWrite(testStep.grantPrincipal)
  }
}
