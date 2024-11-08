#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
// import { InfraStack } from '../libs/infra-stack'

// import * as dotenv from 'dotenv'
// import { Env } from '../config/type'
// import { getConfig } from '../config'
import { PipelineStack } from '../libs/pipeline-stack'
import { Env, PIPELINE_NAME } from '../config'
// dotenv.config()

const app = new cdk.App()

// const env: Env = app.node.tryGetContext('env') || 'dev'
// console.log('stack environment:', env)
// const config = getConfig(env)

const cdkEnv: cdk.Environment = {
  account: '',
  region: '',
}

// new InfraStack(app, 'InfraStack', {
//   config,
//   /* If you don't specify 'env', this stack will be environment-agnostic.
//    * Account/Region-dependent features and context lookups will not work,
//    * but a single synthesized template can be deployed anywhere. */
//   /* Uncomment the next line to specialize this stack for the AWS Account
//    * and Region that are implied by the current CLI configuration. */
//   // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
//   /* Uncomment the next line if you know exactly what Account and Region you
//    * want to deploy the stack to. */
//   env: cdkEnv,
//   /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// })

const envs: Env[] = ['dev']

for (const env of envs) {
  new PipelineStack(app, env + '-' + PIPELINE_NAME + '-pipeline-stack', {
    env: cdkEnv,
    envName: env,
  })
}

app.synth()
