#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import 'source-map-support/register'
import { Env, PIPELINE_NAME } from '../config'
import { PipelineStack } from '../libs/pipeline-stack'
import { CdkGraph, FilterPreset } from '@aws/pdk/cdk-graph'
import { CdkGraphDiagramPlugin } from '@aws/pdk/cdk-graph-plugin-diagram'
;(async () => {
  const app = new cdk.App()

  const cdkEnv: cdk.Environment = {
    account: '',
    region: '',
  }

  const envs: Env[] = ['dev']

  for (const env of envs) {
    new PipelineStack(app, env + '-' + PIPELINE_NAME + '-pipeline-stack', {
      env: cdkEnv,
      envName: env,
    })
  }

  const graph = new CdkGraph(app, {
    plugins: [
      new CdkGraphDiagramPlugin({
        diagrams: [
          {
            name: 'diagram',
            title: 'Infrastructure diagram',
            theme: 'light',
          },
        ],
      }),
    ],
  })

  app.synth()

  await graph.report()
})()
