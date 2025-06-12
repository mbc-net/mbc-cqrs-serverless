import * as cdk from 'aws-cdk-lib'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions'
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import * as events from 'aws-cdk-lib/aws-events'
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'

export interface McpHostStackProps extends cdk.StackProps {
  prefix: string
  vpc?: cdk.aws_ec2.IVpc
  claudeApiKey: string
  databaseUrl?: string
}

export class McpHostStack extends cdk.Stack {
  public readonly mcpHostServiceUrl: string
  public readonly mcpServerServiceUrl: string
  public readonly reportingStateMachineArn: string

  constructor(scope: Construct, id: string, props: McpHostStackProps) {
    super(scope, id, props)

    const { prefix, vpc, claudeApiKey, databaseUrl } = props

    const cluster = new ecs.Cluster(this, 'McpCluster', {
      clusterName: `${prefix}-mcp-cluster`,
      vpc,
      containerInsights: true
    })

    const mcpServerLogGroup = new logs.LogGroup(this, 'McpServerLogGroup', {
      logGroupName: `/aws/ecs/${prefix}-mcp-server`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    const mcpHostLogGroup = new logs.LogGroup(this, 'McpHostLogGroup', {
      logGroupName: `/aws/ecs/${prefix}-mcp-host`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    const mcpServerTaskRole = new iam.Role(this, 'McpServerTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    })

    mcpServerTaskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:StartQuery',
        'logs:GetQueryResults',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams'
      ],
      resources: ['*']
    }))

    mcpServerTaskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:DescribeTable'
      ],
      resources: [`arn:aws:dynamodb:${this.region}:${this.account}:table/${prefix}*`]
    }))

    mcpServerTaskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds:DescribeDBInstances',
        'rds:DescribeDBClusters'
      ],
      resources: ['*']
    }))

    mcpServerTaskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:ListMetrics'
      ],
      resources: ['*']
    }))

    mcpServerTaskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'kms:Decrypt'
      ],
      resources: ['*']
    }))

    const mcpServerService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'McpServerService', {
      cluster,
      serviceName: `${prefix}-mcp-server`,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('./docker', {
          file: 'Dockerfile.mcp-server'
        }),
        containerPort: 8000,
        environment: {
          PORT: '8000',
          AWS_REGION: this.region,
          NODE_ENV: 'production',
          APP_NAME: prefix
        },
        secrets: databaseUrl ? {
          DATABASE_URL: ecs.Secret.fromSsmParameter(
            ssm.StringParameter.fromStringParameterName(this, 'DatabaseUrlParam', databaseUrl)
          )
        } : undefined,
        taskRole: mcpServerTaskRole,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'mcp-server',
          logGroup: mcpServerLogGroup
        })
      },
      memoryLimitMiB: 1024,
      cpu: 512,
      desiredCount: 1,
      publicLoadBalancer: false,
      listenerPort: 8000
    })

    const mcpHostTaskRole = new iam.Role(this, 'McpHostTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    })

    const mcpHostService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'McpHostService', {
      cluster,
      serviceName: `${prefix}-mcp-host`,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('./docker', {
          file: 'Dockerfile'
        }),
        containerPort: 3000,
        environment: {
          PORT: '3000',
          NODE_ENV: 'production',
          MCP_SERVER_URL: `http://${mcpServerService.loadBalancer.loadBalancerDnsName}:8000`
        },
        secrets: {
          CLAUDE_API_KEY: ecs.Secret.fromSsmParameter(
            ssm.StringParameter.fromStringParameterName(this, 'ClaudeApiKeyParam', claudeApiKey)
          )
        },
        taskRole: mcpHostTaskRole,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'mcp-host',
          logGroup: mcpHostLogGroup
        })
      },
      memoryLimitMiB: 1024,
      cpu: 512,
      desiredCount: 1,
      publicLoadBalancer: true,
      listenerPort: 80
    })

    const httpApi = new apigatewayv2.HttpApi(this, 'McpHostApi', {
      apiName: `${prefix}-mcp-host-api`,
      description: 'MCP Host API for Claude AI integration',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ['*']
      }
    })

    const vpcLink = new apigatewayv2.VpcLink(this, 'McpHostVpcLink', {
      vpc: mcpHostService.cluster.vpc,
      subnets: {
        subnets: mcpHostService.cluster.vpc.privateSubnets
      }
    })

    const integration = new apigatewayv2Integrations.HttpAlbIntegration(
      'McpHostIntegration',
      mcpHostService.listener,
      {
        vpcLink
      }
    )

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration
    })

    const reportingLogGroup = new logs.LogGroup(this, 'ReportingLogGroup', {
      logGroupName: `/aws/stepfunctions/${prefix}-reporting`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    const reportGenerationTask = new stepfunctionsTasks.CallAwsService(this, 'GenerateReport', {
      service: 'apigatewayv2',
      action: 'getApi',
      parameters: {
        ApiId: httpApi.httpApiId
      },
      iamResources: [`arn:aws:apigateway:${this.region}::/apis/${httpApi.httpApiId}`],
      resultPath: '$.reportData'
    })

    const notifyTask = new stepfunctionsTasks.SnsPublish(this, 'NotifyReport', {
      topic: cdk.aws_sns.Topic.fromTopicArn(
        this,
        'ReportingTopic',
        `arn:aws:sns:${this.region}:${this.account}:${prefix}-main-sns`
      ),
      message: stepfunctions.TaskInput.fromJsonPathAt('$.reportData'),
      subject: `${prefix} システム稼働状況レポート`
    })

    const reportingDefinition = reportGenerationTask.next(notifyTask)

    const reportingStateMachine = new stepfunctions.StateMachine(this, 'ReportingStateMachine', {
      stateMachineName: `${prefix}-mcp-reporting`,
      definition: reportingDefinition,
      logs: {
        destination: reportingLogGroup,
        level: stepfunctions.LogLevel.ALL
      },
      tracingEnabled: true
    })

    const reportingRule = new events.Rule(this, 'ReportingSchedule', {
      ruleName: `${prefix}-daily-reporting`,
      description: 'Daily system metrics reporting',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '0', // 0 UTC = 9 AM JST
        day: '*',
        month: '*',
        year: '*'
      })
    })

    reportingRule.addTarget(new eventsTargets.SfnStateMachine(reportingStateMachine))

    this.mcpHostServiceUrl = `https://${httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com`
    this.mcpServerServiceUrl = `http://${mcpServerService.loadBalancer.loadBalancerDnsName}:8000`
    this.reportingStateMachineArn = reportingStateMachine.stateMachineArn

    new cdk.CfnOutput(this, 'McpHostApiUrl', {
      value: this.mcpHostServiceUrl,
      description: 'MCP Host API URL'
    })

    new cdk.CfnOutput(this, 'McpServerUrl', {
      value: this.mcpServerServiceUrl,
      description: 'MCP Server URL (internal)'
    })

    new cdk.CfnOutput(this, 'ReportingStateMachineArn', {
      value: this.reportingStateMachineArn,
      description: 'Reporting State Machine ARN'
    })
  }
}
