/*
 * Copyright (c) Murakami Business Consulting, Inc. All rights are reserved.
 */

import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { getConfig } from '../config'
import { InfraStack } from '../libs/infra-stack'

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(() => Buffer.from('e380014717dda68f930961c8fdcde7')),
}))

jest.mock('aws-cdk-lib', () => ({
  ...jest.requireActual('aws-cdk-lib'),
  Duration: {
    days: jest.fn(() => ({
      toMilliseconds: jest.fn(() => 365 * 24 * 60 * 60 * 1000), // Mock milliseconds for 365 days
    })),
    hours: jest.fn(() => ({
      minutes: jest.fn(() => 365 * 24 * 60),
      toSeconds: jest.fn(() => 365 * 24 * 60 * 60),
    })),
    minutes: jest.fn(() => ({
      toSeconds: jest.fn(() => 365 * 24 * 60),
    })),
    seconds: jest.fn(() => ({
      toSeconds: jest.fn(() => 365 * 24 * 60 * 60),
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
