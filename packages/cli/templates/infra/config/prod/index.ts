import { SystemLogLevel, ApplicationLogLevel } from 'aws-cdk-lib/aws-lambda'
import { Config } from '../type'

const config: Config = {
  env: 'prod',
  appName: '',

  domain: {
    http: '',
    appsync: '',
  },

  userPoolId: '',

  vpc: {
    id: '',
    subnetIds: [],
    securityGroupIds: [],
  },
  rds: {
    accountSsmKey: '',
    endpoint: '',
    dbName: '',
  },

  logLevel: {
    lambdaSystem: SystemLogLevel.DEBUG,
    lambdaApplication: ApplicationLogLevel.TRACE,
    level: 'info',
  },

  frontBaseUrl: '',
  fromEmailAddress: '',

  // wafArn: '',

  // ecs: {
  //   maxInstances: 2,
  //   minInstances: 1,
  //   cpu: 2048,
  //   memory: 4096,
  //   cpuThreshold: 70,
  //   scaleStep: 1,
  //   autoRollback: true,
  // },
}

export default config
