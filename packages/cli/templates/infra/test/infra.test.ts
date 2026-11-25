/*
 * Copyright (c) Murakami Business Consulting, Inc. All rights are reserved.
 */

import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { Config, getConfig } from '../config'
import { InfraStack } from '../libs/infra-stack'
import { PipelineStack } from '../libs/pipeline-stack'

jest.mock('../config/constant', () => ({
  PIPELINE_NAME: 'test-pipeline',
  GIT_REPO: 'test-owner/test-repo',
  GIT_CONNECTION_ARN:
    'arn:aws:codestar-connections:ap-northeast-1:101010101010:connection/test',
  ACM_HTTP_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:101010101010:certificate/test-http',
  ACM_APPSYNC_CERTIFICATE_ARN:
    'arn:aws:acm:us-east-1:101010101010:certificate/test-appsync',
  HOSTED_ZONE_ID: 'Z0123456789ABCDEFGHIJ',
  HOSTED_ZONE_NAME: 'example.com',
  COGNITO_URL: 'https://cognito-idp.ap-northeast-1.amazonaws.com/test',
}))

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(() => Buffer.from('e380014717dda68f930961c8fdcde7')),
}))

jest.mock('aws-cdk-lib', () => ({
  ...jest.requireActual('aws-cdk-lib'),
  Duration: {
    days: jest.fn((n: number) => ({
      toMilliseconds: jest.fn(() => n * 24 * 60 * 60 * 1000),
      toSeconds: jest.fn(() => n * 24 * 60 * 60),
    })),
    hours: jest.fn((n: number) => ({
      minutes: jest.fn(() => n * 60),
      toSeconds: jest.fn(() => n * 60 * 60),
      toMilliseconds: jest.fn(() => n * 60 * 60 * 1000),
    })),
    minutes: jest.fn((n: number) => ({
      toSeconds: jest.fn(() => n * 60),
    })),
    seconds: jest.fn((n: number) => ({
      toSeconds: jest.fn(() => n),
    })),
  },
  Expiration: {
    after: jest.fn(() => ({
      isBefore: jest.fn(() => false),
      isAfter: jest.fn(() => false),
      toEpoch: jest.fn(() => 1762419954),
    })),
  },
}))

// buildApp() shells out to a real `npm ci && npm run build:prod` of the parent
// application (via execSync). That cannot run in the isolated template / CI
// context, so it is mocked to return placeholder asset directories, keeping the
// CDK synthesis hermetic and the snapshot deterministic.
jest.mock('../libs/build-app', () => ({
  buildApp: jest.fn(() => ({
    layerPath: require('path').resolve(__dirname, 'fixtures/layer'),
    appPath: require('path').resolve(__dirname, 'fixtures/app'),
  })),
}))

function replaceKeyValue(obj: any, desKey: string, desVal: string): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (key === desKey) {
        obj[key] = desVal
      } else if (typeof obj[key] === 'object') {
        obj[key] = replaceKeyValue(obj[key], desKey, desVal)
      }
    }
  }

  return obj
}

test('snapshot test for InfraStack', () => {
  const cdkEnv: cdk.Environment = {
    account: '101010101010',
    region: 'ap-northeast-1',
  }
  const config = getConfig('dev')
  const app = new cdk.App()
  const stack = new InfraStack(app, 'TestInfraStack', { env: cdkEnv, config })
  let template = Template.fromStack(stack).toJSON()
  template = replaceKeyValue(
    template,
    'S3Key',
    `${Array(64).fill('x').join('')}.zip`,
  )
  template = replaceKeyValue(
    template,
    'Fn::Sub',
    '101010101010.dkr.ecr.xxxxxxxxxxxx.${AWS::URLSuffix}/cdk-hnb659fds-container-assets-101010101010-xxxxxxxxxxxx:' +
      Array(64).fill('x').join(''),
  )

  expect(template).toMatchSnapshot()
})

test('lambda-api SendTaskSuccess is scoped to command-handler state machine', () => {
  const cdkEnv: cdk.Environment = {
    account: '101010101010',
    region: 'ap-northeast-1',
  }
  const config = getConfig('dev')
  const app = new cdk.App()
  const stack = new InfraStack(app, 'TestInfraStackIam', {
    env: cdkEnv,
    config,
  })
  const template = Template.fromStack(stack)

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'states:SendTaskSuccess',
          Effect: 'Allow',
          Resource: { Ref: 'commandhandlerstatemachine937D91FB' },
        }),
      ]),
    },
  })
})

test('pipeline CodeBuild projects pin the Node.js 22 runtime', () => {
  // The Lambda functions and layer run on nodejs22.x and every package
  // requires Node.js >=22, so tests, synth and the layer build must not
  // depend on the CodeBuild image's default Node.js version.
  const app = new cdk.App()
  const stack = new PipelineStack(app, 'TestPipelineStack', {
    env: { account: '101010101010', region: 'ap-northeast-1' },
    envName: 'dev',
  })
  const projects = Template.fromStack(stack).findResources(
    'AWS::CodeBuild::Project',
  )

  expect(Object.keys(projects).length).toBeGreaterThan(0)
  // A buildspec that embeds CloudFormation references is an Fn::Join; render
  // the references as placeholder text so the JSON can be parsed.
  const render = (value: any): string =>
    typeof value === 'string'
      ? value
      : value?.['Fn::Join']
        ? value['Fn::Join'][1].map(render).join(value['Fn::Join'][0])
        : 'TOKEN'
  for (const project of Object.values(projects)) {
    const source = project.Properties.Source.BuildSpec
    // Only a plain string or an Fn::Join renders to parseable JSON; fail with
    // a clear message if a CDK upgrade emits another form (e.g. Fn::Sub).
    expect(typeof source === 'string' || 'Fn::Join' in source).toBe(true)
    const buildSpec = JSON.parse(render(source))
    expect(buildSpec.phases?.install?.['runtime-versions']).toEqual({
      nodejs: '22',
    })
  }
})

const env: cdk.Environment = {
  account: '101010101010',
  region: 'ap-northeast-1',
}

test('app client lets users write only name', () => {
  // Without WriteAttributes, Cognito lets a user rewrite custom:roles with
  // their own access token (UpdateUserAttributes) and escalate privileges.
  const cases: Array<[string, Config]> = [
    ['TestClientNew', getConfig('dev')],
    [
      'TestClientImported',
      { ...getConfig('dev'), userPoolId: 'ap-northeast-1_abcdefghi' },
    ],
  ]
  for (const [id, config] of cases) {
    const clients = Template.fromStack(
      new InfraStack(new cdk.App(), id, { env, config }),
    ).findResources('AWS::Cognito::UserPoolClient')
    expect(
      Object.values(clients).map((c: any) => c.Properties.WriteAttributes),
    ).toEqual([['name']])
  }
})

test('ECS task role gets the Cognito admin actions', () => {
  // ECS mode needs appName (ECR repo name) and an RDS SSM key to synthesize.
  const config: Config = {
    ...getConfig('dev'),
    appName: 'demo',
    rds: { accountSsmKey: '/demo/db', endpoint: 'db.local', dbName: 'demo' },
    ecs: { maxInstances: 1, minInstances: 1, cpu: 256, memory: 512 },
  }
  const template = Template.fromStack(
    new InfraStack(new cdk.App(), 'TestEcsCognito', { env, config }),
  )
  template.hasResourceProperties('AWS::IAM::Policy', {
    Roles: Match.arrayWith([{ Ref: Match.stringLikeRegexp('^ecsrole') }]),
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Effect: 'Allow',
          Action: Match.arrayWith([
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminAddUserToGroup',
            'cognito-idp:AdminCreateUser',
            'cognito-idp:AdminDeleteUser',
            'cognito-idp:AdminDisableUser',
            'cognito-idp:AdminEnableUser',
            'cognito-idp:AdminSetUserPassword',
            'cognito-idp:AdminResetUserPassword',
            'cognito-idp:AdminUpdateUserAttributes',
          ]),
          Resource: {
            'Fn::GetAtt': [Match.stringLikeRegexp('userpool'), 'Arn'],
          },
        }),
      ]),
    },
  })
})
