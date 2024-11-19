import { ApplicationLogLevel, SystemLogLevel } from 'aws-cdk-lib/aws-lambda'

export type Env = 'dev' | 'stg' | 'prod'

export type Config = {
  env: Env
  appName: string

  // domain
  domain: {
    http: string
    appsync: string
  }

  // existing resources
  userPoolId?: string

  vpc: {
    id: string
    subnetIds: string[]
    securityGroupIds: string[]
  }

  rds: {
    accountSsmKey: string
    endpoint: string
    dbName: string
  }

  systemAccountSsmKey?: string

  logLevel?: {
    lambdaSystem?: SystemLogLevel
    lambdaApplication?: ApplicationLogLevel
    level?: 'verbose' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  }

  frontBaseUrl: string
  fromEmailAddress: string

  wafArn?: string

  ecs?: {
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
    maxInstances: number
    minInstances: number
    cpu: number
    memory: number
    cpuThreshold?: number
    scaleStep?: number
    autoRollback?: boolean
  }
}
