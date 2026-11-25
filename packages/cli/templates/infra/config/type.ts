import { ApplicationLogLevel, SystemLogLevel } from 'aws-cdk-lib/aws-lambda'

export type Env = 'dev' | 'stg' | 'prod'

export type Config = {
  env: Env
  appName: string

  // domain
  domain: {
    http: string
    appsync: string
    appsyncEvents?: string // optional: custom domain for AppSync Events API
  }

  appsyncEvents?: {
    /** Set true to create the AppSync Events API and inject env vars into Lambda/ECS */
    enabled: boolean
    /**
     * Channel namespace name — must be a pre-registered name in the AppSync Event API.
     * Becomes segment 1 of every channel path: /{namespace}/{tenantCode}/{table}/{action}/{id}
     * Defaults to 'default'.
     */
    namespace: string
    /** API key TTL in days. Defaults to 365. */
    apiKeyExpireDays?: number
  }

  /**
   * Value injected as NOTIFICATION_TRANSPORTS env var into Lambda/ECS.
   * Controls which transports NotificationEventHandler uses.
   * Examples:
   *   'appsync-event'                    — Events API only
   *   'appsync-graphql'                  — GraphQL API only
   *   'appsync-graphql,appsync-event'    — dual-publish (migration mode)
   * Defaults to 'appsync-event' when appsyncEvents is enabled.
   */
  notificationTransports?: string

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
