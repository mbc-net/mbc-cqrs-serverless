import { ApplicationLogLevel, SystemLogLevel } from 'aws-cdk-lib/aws-lambda'
import { Config } from '../type'

const config: Config = {
  env: 'dev',
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
    level: 'verbose',
  },

  frontBaseUrl: '',
  fromEmailAddress: '',

  // wafArn: '',

  // ecs: {
  //   maxInstances: 1,
  //   minInstances: 1,
  //   cpu: 512,
  //   memory: 1024,
  //   cpuThreshold: 70,
  //   scaleStep: 1,
  //   autoRollback: false,
  // },
}

export default config
