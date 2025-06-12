#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { McpHostStack } from './mcp-host-stack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1'
}

const prefix = app.node.tryGetContext('prefix') || 'dev-mcp'
const claudeApiKey = app.node.tryGetContext('claudeApiKey') || '/mcp/claude-api-key'
const databaseUrl = app.node.tryGetContext('databaseUrl')

new McpHostStack(app, 'McpHostStack', {
  env,
  prefix,
  claudeApiKey,
  databaseUrl
})

app.synth()
