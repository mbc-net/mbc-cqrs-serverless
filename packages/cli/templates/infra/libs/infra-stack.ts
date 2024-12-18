import * as cdk from 'aws-cdk-lib'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayv2_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { Construct } from 'constructs'
import { randomBytes } from 'crypto'

import { IgnoreMode } from 'aws-cdk-lib'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets'
import { ContainerImage } from 'aws-cdk-lib/aws-ecs'
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns'
import { DockerImageName, ECRDeployment } from 'cdk-ecr-deployment'
import * as path from 'path'
import {
  ACM_APPSYNC_CERTIFICATE_ARN,
  ACM_HTTP_CERTIFICATE_ARN,
  HOSTED_ZONE_ID,
  HOSTED_ZONE_NAME,
} from '../config'
import { Config } from '../config/type'
import { buildApp } from './build-app'

export interface InfraStackProps extends cdk.StackProps {
  config: Config
}

export class InfraStack extends cdk.Stack {
  public readonly userPoolId: cdk.CfnOutput
  public readonly userPoolClientId: cdk.CfnOutput
  public readonly graphqlApiUrl: cdk.CfnOutput
  public readonly graphqlApiKey: cdk.CfnOutput
  public readonly httpApiUrl: cdk.CfnOutput
  public readonly stateMachineArn: cdk.CfnOutput
  public readonly httpDistributionDomain: cdk.CfnOutput

  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props)

    const name = props.config.appName
    const env = props.config.env
    const prefix = `${env}-${name}-`
    const originVerifyToken = prefix + randomBytes(32).toString('hex')

    cdk.Tags.of(scope).add('name', props.config.appName)
    cdk.Tags.of(scope).add('env', props.config.env)

    // Cognito
    let userPool: cdk.aws_cognito.IUserPool
    if (props.config.userPoolId) {
      userPool = cdk.aws_cognito.UserPool.fromUserPoolId(
        this,
        'main-user-pool',
        props.config.userPoolId,
      )
    } else {
      // create new cognito
      userPool = new cdk.aws_cognito.UserPool(this, prefix + 'user-pool', {
        userPoolName: prefix + 'user-pool',
        selfSignUpEnabled: false,
        signInAliases: {
          username: true,
          preferredUsername: true,
        },
        passwordPolicy: {
          minLength: 6,
          requireDigits: false,
          requireLowercase: false,
          requireSymbols: false,
          requireUppercase: false,
        },
        mfa: cdk.aws_cognito.Mfa.OFF,
        accountRecovery: cdk.aws_cognito.AccountRecovery.NONE,
        customAttributes: {
          tenant: new cdk.aws_cognito.StringAttribute({
            mutable: true,
            maxLen: 50,
          }),
          company_code: new cdk.aws_cognito.StringAttribute({
            mutable: true,
            maxLen: 50,
          }),
          member_id: new cdk.aws_cognito.StringAttribute({
            mutable: true,
            maxLen: 2024,
          }),
          roles: new cdk.aws_cognito.StringAttribute({ mutable: true }),
        },
        email: cdk.aws_cognito.UserPoolEmail.withCognito(),
        deletionProtection: true,
      })
    }
    this.userPoolId = new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    })

    // SNS
    const mainSns = new cdk.aws_sns.Topic(this, 'main-sns', {
      topicName: prefix + 'main-sns',
    })

    const alarmSns = new cdk.aws_sns.Topic(this, 'alarm-sns', {
      topicName: prefix + 'alarm-sns',
    })
    // SQS
    const taskDlSqs = new cdk.aws_sqs.Queue(this, 'task-dead-letter-sqs', {
      queueName: prefix + 'task-dead-letter-queue',
    })
    const taskSqs = new cdk.aws_sqs.Queue(this, 'task-sqs', {
      queueName: prefix + 'task-action-queue',
      deadLetterQueue: {
        queue: taskDlSqs,
        maxReceiveCount: 5,
      },
    })

    alarmSns.addSubscription(
      new cdk.aws_sns_subscriptions.SqsSubscription(taskDlSqs, {
        rawMessageDelivery: true,
      }),
    )

    mainSns.addSubscription(
      new cdk.aws_sns_subscriptions.SqsSubscription(taskSqs, {
        rawMessageDelivery: true,
        filterPolicy: {
          action: cdk.aws_sns.SubscriptionFilter.stringFilter({
            allowlist: ['task-execute'],
          }),
        },
      }),
    )
    const notifySqs = new cdk.aws_sqs.Queue(this, 'notify-sqs', {
      queueName: prefix + 'notification-queue',
    })
    mainSns.addSubscription(
      new cdk.aws_sns_subscriptions.SqsSubscription(notifySqs, {
        rawMessageDelivery: true,
        filterPolicy: {
          action: cdk.aws_sns.SubscriptionFilter.stringFilter({
            allowlist: ['command-status', 'task-status'],
          }),
        },
      }),
    )
    // host zone
    const hostedZone = cdk.aws_route53.HostedZone.fromHostedZoneAttributes(
      this,
      'HostedZone',
      {
        hostedZoneId: HOSTED_ZONE_ID,
        zoneName: HOSTED_ZONE_NAME,
      },
    )

    // AppSync
    const appSyncCertificate =
      cdk.aws_certificatemanager.Certificate.fromCertificateArn(
        this,
        'appsync-certificate',
        ACM_APPSYNC_CERTIFICATE_ARN,
      )

    const appSyncApi = new cdk.aws_appsync.GraphqlApi(this, 'realtime', {
      name: prefix + 'realtime',
      definition: cdk.aws_appsync.Definition.fromFile('asset/schema.graphql'), // Define the schema
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: cdk.aws_appsync.AuthorizationType.API_KEY, // Defining authorization type
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)), // Set expiration for API Key
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: cdk.aws_appsync.AuthorizationType.IAM,
          },
          {
            authorizationType: cdk.aws_appsync.AuthorizationType.USER_POOL,
            userPoolConfig: { userPool },
          },
        ],
      },
      xrayEnabled: true, // Enable X-Ray for monitoring
      domainName: {
        certificate: appSyncCertificate,
        domainName: props.config.domain.appsync,
      },
    })

    const noneDS = appSyncApi.addNoneDataSource('NoneDataSource')
    noneDS.createResolver('sendMessageResolver', {
      typeName: 'Mutation',
      fieldName: 'sendMessage',
      requestMappingTemplate: cdk.aws_appsync.MappingTemplate.fromString(
        '{"version": "2018-05-29","payload": $util.toJson($context.arguments.message)}',
      ),
      responseMappingTemplate: cdk.aws_appsync.MappingTemplate.fromString(
        '$util.toJson($context.result)',
      ),
    })

    // route to AppSync
    new cdk.aws_route53.CnameRecord(this, `AppSyncCnameRecord`, {
      zone: hostedZone,
      recordName: props.config.domain.appsync,
      domainName: appSyncApi.appSyncDomainName,
    })

    this.graphqlApiUrl = new cdk.CfnOutput(this, 'GraphQLAPIURL', {
      value: appSyncApi.graphqlUrl,
    })
    this.graphqlApiKey = new cdk.CfnOutput(this, 'GraphQLAPIKey', {
      value: appSyncApi.apiKey || '',
    })
    // S3
    const ddbBucket = new cdk.aws_s3.Bucket(this, 'ddb-attributes', {
      bucketName: prefix + 'ddb-attributes', // Globally unique bucket name
      versioned: false,
      publicReadAccess: false, // Block public read access
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Define removal policy (use with caution in production)
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            cdk.aws_s3.HttpMethods.GET,
            cdk.aws_s3.HttpMethods.PUT,
            cdk.aws_s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'],
          maxAge: 3000,
        },
      ],
    })

    const publicBucket = new cdk.aws_s3.Bucket(this, 'public-bucket', {
      bucketName: prefix + 'public', // Globally unique bucket name
      versioned: false,
      publicReadAccess: false, // Block public read access
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Define removal policy (use with caution in production)
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            cdk.aws_s3.HttpMethods.GET,
            cdk.aws_s3.HttpMethods.PUT,
            cdk.aws_s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'],
          maxAge: 3000,
        },
      ],
    })
    // cloudfront
    const publicBucketOAI = new cdk.aws_cloudfront.OriginAccessIdentity(
      this,
      'public-bucket-OAI',
    )
    publicBucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['s3:GetObject'],
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: [publicBucket.arnForObjects('*')],
        principals: [
          new cdk.aws_iam.CanonicalUserPrincipal(
            publicBucketOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId,
          ),
        ],
      }),
    )
    const publicBucketDistribution = new cdk.aws_cloudfront.Distribution(
      this,
      'public-bucket-distribution',
      {
        defaultBehavior: {
          allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cdk.aws_cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy:
            cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          origin: new cdk.aws_cloudfront_origins.S3Origin(publicBucket, {
            originAccessIdentity: publicBucketOAI,
          }),
        },
        priceClass: cdk.aws_cloudfront.PriceClass.PRICE_CLASS_200,
        geoRestriction: cdk.aws_cloudfront.GeoRestriction.allowlist('JP', 'VN'),
      },
    )

    // VPC
    const vpc = cdk.aws_ec2.Vpc.fromLookup(this, 'main-vpc', {
      vpcId: props.config.vpc.id,
    })

    const subnets = cdk.aws_ec2.SubnetFilter.byIds(props.config.vpc.subnetIds)
    const securityGroups = props.config.vpc.securityGroupIds.map((id, idx) =>
      cdk.aws_ec2.SecurityGroup.fromSecurityGroupId(
        this,
        'main-security-group-' + idx,
        id,
      ),
    )
    // Lambda Layer
    const { layerPath, appPath } = buildApp(env)
    console.log('dist path:', layerPath, appPath)
    const lambdaLayer = new cdk.aws_lambda.LayerVersion(this, 'main-layer', {
      layerVersionName: prefix + 'main-layer',
      code: cdk.aws_lambda.AssetCode.fromAsset(layerPath),
      compatibleRuntimes: [cdk.aws_lambda.Runtime.NODEJS_18_X],
      compatibleArchitectures: [cdk.aws_lambda.Architecture.ARM_64],
    })

    const commandSfnArn = cdk.Arn.format({
      partition: 'aws',
      region: this.region,
      account: this.account,
      service: 'states',
      resource: 'stateMachine',
      resourceName: prefix + 'command-handler',
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
    })

    // Lambda api ( arm64 )
    const execEnv = {
      NODE_OPTIONS: '--enable-source-maps',
      TZ: 'Asia/Tokyo',
      NODE_ENV: env,
      APP_NAME: name,
      LOG_LEVEL: props.config.logLevel?.level || 'info',
      EVENT_SOURCE_DISABLED: 'false',
      ATTRIBUTE_LIMIT_SIZE: '389120',
      S3_BUCKET_NAME: ddbBucket.bucketName,
      SFN_COMMAND_ARN: commandSfnArn,
      SNS_TOPIC_ARN: mainSns.topicArn,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      APPSYNC_ENDPOINT: appSyncApi.graphqlUrl,
      SES_FROM_EMAIL: props.config.fromEmailAddress,
      DATABASE_URL: `postgresql://${props.config.rds.accountSsmKey}@${props.config.rds.endpoint}/${props.config.rds.dbName}?schema=public`,
      S3_PUBLIC_BUCKET_NAME: publicBucket.bucketName,
      FRONT_BASE_URL: props.config.frontBaseUrl,
    }
    const lambdaApi = new cdk.aws_lambda.Function(this, 'lambda-api', {
      vpc,
      vpcSubnets: {
        subnetFilters: [subnets],
      },
      securityGroups,
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      functionName: prefix + 'lambda-api',
      layers: [lambdaLayer],
      code: cdk.aws_lambda.Code.fromAsset(appPath),
      handler: 'main.handler',
      runtime: cdk.aws_lambda.Runtime.NODEJS_LATEST,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      tracing: cdk.aws_lambda.Tracing.ACTIVE,
      loggingFormat: cdk.aws_lambda.LoggingFormat.JSON,
      applicationLogLevelV2: props.config.logLevel?.lambdaApplication,
      systemLogLevelV2: props.config.logLevel?.lambdaSystem,
      environment: execEnv,
    })

    // API GW
    const httpApi = new apigwv2.HttpApi(this, 'main-api', {
      description: 'HTTP API for Lambda integration',
      apiName: prefix + 'api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowCredentials: false,
        allowHeaders: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        maxAge: cdk.Duration.hours(1),
      },
    })
    const lambdaIntegration = new apigwv2_integrations.HttpLambdaIntegration(
      'main-api-lambda',
      lambdaApi,
    )
    // event routes
    httpApi.addRoutes({
      path: '/event/{proxy+}',
      integration: lambdaIntegration,
      authorizer: new apigatewayv2_authorizers.HttpIamAuthorizer(),
    })

    // api protected routes
    const userPoolClient = new cdk.aws_cognito.UserPoolClient(
      this,
      'apigw-client',
      {
        userPool,
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
      },
    )

    this.userPoolClientId = new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    })

    const authorizer = new apigatewayv2_authorizers.HttpUserPoolAuthorizer(
      'CognitoAuthorizer',
      userPool,
      {
        userPoolClients: [userPoolClient],
      },
    )

    let apiIntegration: apigwv2.HttpRouteIntegration
    let taskRole: cdk.aws_iam.Role | undefined
    if (!props.config.ecs) {
      apiIntegration = lambdaIntegration
    } else {
      // ecs api
      const resp = new Repository(this, 'main-ecr-repo', {
        repositoryName: `${prefix}api`,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      })

      const image = new DockerImageAsset(this, 'main-image', {
        directory: path.resolve(__dirname, '../..'),
        platform: Platform.LINUX_AMD64,
        ignoreMode: IgnoreMode.DOCKER,
      })

      const imageTag = process.env.CODEBUILD_RESOLVED_SOURCE_VERSION
        ? process.env.CODEBUILD_RESOLVED_SOURCE_VERSION.substring(0, 4)
        : 'latest'

      new ECRDeployment(this, `${prefix}deploy`, {
        src: new DockerImageName(image.imageUri),
        dest: new DockerImageName(`${resp.repositoryUri}:${imageTag}`),
      })

      taskRole = new cdk.aws_iam.Role(this, 'ecs-role', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      })

      const ecsService = new ApplicationLoadBalancedFargateService(
        this,
        'main-service',
        {
          vpc,
          taskSubnets: {
            subnetFilters: [subnets],
          },
          securityGroups,
          circuitBreaker: {
            rollback: props.config.ecs.autoRollback,
          },
          publicLoadBalancer: false,
          memoryLimitMiB: props.config.ecs.memory,
          cpu: props.config.ecs.cpu,
          desiredCount: props.config.ecs.minInstances,
          taskImageOptions: {
            image: ContainerImage.fromDockerImageAsset(image),
            environment: {
              ...execEnv,
              APP_PORT: '80',
              EVENT_SOURCE_DISABLED: 'true',
              PRISMA_EXPLICIT_CONNECT: 'false',
            },
            secrets: {
              DATABASE_USER_PASS: cdk.aws_ecs.Secret.fromSsmParameter(
                cdk.aws_ssm.StringParameter.fromSecureStringParameterAttributes(
                  this,
                  'dbUserPass',
                  {
                    parameterName: props.config.rds.accountSsmKey,
                  },
                ),
              ),
            },
            taskRole,
          },
        },
      )

      if (props.config.ecs.cpuThreshold) {
        const scalableTarget = ecsService.service.autoScaleTaskCount({
          minCapacity: props.config.ecs.minInstances,
          maxCapacity: props.config.ecs.maxInstances,
        })

        scalableTarget.scaleOnCpuUtilization('CpuScaling', {
          targetUtilizationPercent: props.config.ecs.cpuThreshold,
        })
      }

      const vpcLink = new apigwv2.VpcLink(this, 'ecs-vpc-link', {
        vpc,
      })
      const vpcLinkIntegration = new apigwv2_integrations.HttpAlbIntegration(
        'ecs-vpc-link-integration',
        ecsService.loadBalancer.listeners[0],
        {
          vpcLink,
          parameterMapping: new apigwv2.ParameterMapping()
            .appendHeader(
              'x-source-ip',
              apigwv2.MappingValue.contextVariable('identity.sourceIp'),
            )
            .appendHeader(
              'x-request-id',
              apigwv2.MappingValue.contextVariable('extendedRequestId'),
            ),
        },
      )
      apiIntegration = vpcLinkIntegration
    }
    // health check api (public)
    httpApi.addRoutes({
      path: '/',
      methods: [apigwv2.HttpMethod.GET],
      integration: apiIntegration,
    })
    // protected api
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [
        apigwv2.HttpMethod.HEAD,
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.POST,
        apigwv2.HttpMethod.DELETE,
        apigwv2.HttpMethod.PUT,
        apigwv2.HttpMethod.PATCH,
      ],
      integration: apiIntegration,
      authorizer,
    })
    // Output the URL of the HTTP API
    this.httpApiUrl = new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.url!,
    })

    // cloudfront to HTTP API
    const httpDistributionCertificate =
      cdk.aws_certificatemanager.Certificate.fromCertificateArn(
        this,
        'http-distribution-certificate',
        ACM_HTTP_CERTIFICATE_ARN,
      )
    const httpDistribution = new cdk.aws_cloudfront.Distribution(
      this,
      'http-distribution',
      {
        defaultBehavior: {
          origin: new cdk.aws_cloudfront_origins.HttpOrigin(
            `${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
            {
              customHeaders: {
                'X-Origin-Verify': originVerifyToken,
              },
            },
          ),
          originRequestPolicy:
            cdk.aws_cloudfront.OriginRequestPolicy
              .ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy:
            cdk.aws_cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
          allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_DISABLED,
          viewerProtocolPolicy:
            cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        priceClass: cdk.aws_cloudfront.PriceClass.PRICE_CLASS_200,
        geoRestriction: cdk.aws_cloudfront.GeoRestriction.allowlist('JP', 'VN'),
        domainNames: [props.config.domain.http],
        certificate: httpDistributionCertificate,
        webAclId: props.config.wafArn,
        enableIpv6: false,
      },
    )

    new cdk.aws_route53.CnameRecord(this, 'http-distribution-a-record', {
      zone: hostedZone,
      recordName: props.config.domain.http,
      domainName: httpDistribution.distributionDomainName,
    })

    this.httpDistributionDomain = new cdk.CfnOutput(
      this,
      'http-distribution-domain',
      {
        value: httpDistribution.distributionDomainName,
      },
    )

    // api gateway logging
    // Setup the access log for APIGWv2
    const httpApiAccessLogs = new cdk.aws_logs.LogGroup(
      this,
      'http-api-AccessLogs',
    )
    const httpApiDefaultStage = httpApi.defaultStage?.node
      .defaultChild as cdk.aws_apigatewayv2.CfnStage
    httpApiDefaultStage.accessLogSettings = {
      destinationArn: httpApiAccessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        ip: '$context.identity.sourceIp',
        userAgent: '$context.identity.userAgent',
        sourceIp: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        requestTimeEpoch: '$context.requestTimeEpoch',
        httpMethod: '$context.httpMethod',
        routeKey: '$context.routeKey',
        path: '$context.path',
        status: '$context.status',
        protocol: '$context.protocol',
        responseLength: '$context.responseLength',
        domainName: '$context.domainName',
        responseLatency: '$context.responseLatency',
        integrationLatency: '$context.integrationLatency',
        username: '$context.authorizer.claims.sub',
      }),
    }
    httpApiDefaultStage.defaultRouteSettings = {
      detailedMetricsEnabled: true,
    }

    // StepFunction
    // Define the lambda invoke task with common configurations
    const lambdaInvoke = (
      stateName: string,
      nextState: cdk.aws_stepfunctions.IChainable | null,
      integrationPattern: cdk.aws_stepfunctions.IntegrationPattern,
    ) => {
      const payloadObject: {
        [key: string]: any
      } = {
        'input.$': '$',
        'context.$': '$$',
      }
      if (
        integrationPattern ===
        cdk.aws_stepfunctions.IntegrationPattern.WAIT_FOR_TASK_TOKEN
      ) {
        payloadObject['taskToken'] = cdk.aws_stepfunctions.JsonPath.taskToken // '$$.Task.Token'
      }
      const lambdaTask = new cdk.aws_stepfunctions_tasks.LambdaInvoke(
        this,
        stateName,
        {
          lambdaFunction: lambdaApi,
          payload: cdk.aws_stepfunctions.TaskInput.fromObject(payloadObject),
          retryOnServiceExceptions: true,
          stateName,
          outputPath: '$.Payload[0][0]',
          integrationPattern,
        },
      )
      if (nextState) {
        return lambdaTask.next(nextState)
      }
      return lambdaTask
    }

    // Define states
    const fail = new cdk.aws_stepfunctions.Fail(this, 'fail', {
      stateName: 'fail',
      causePath: '$.cause',
      errorPath: '$.error',
    })
    const success = new cdk.aws_stepfunctions.Succeed(this, 'success', {
      stateName: 'success',
    })
    const finish = lambdaInvoke(
      'finish',
      success,
      cdk.aws_stepfunctions.IntegrationPattern.REQUEST_RESPONSE,
    )
    const syncData = lambdaInvoke(
      'sync_data',
      null,
      cdk.aws_stepfunctions.IntegrationPattern.REQUEST_RESPONSE,
    )
    // Define Map state
    const syncDataAll = new cdk.aws_stepfunctions.Map(this, 'sync_data_all', {
      stateName: 'sync_data_all',
      maxConcurrency: 0,
      itemsPath: cdk.aws_stepfunctions.JsonPath.stringAt('$'),
    })
      .itemProcessor(syncData)
      .next(finish)
    const transformData = lambdaInvoke(
      'transform_data',
      syncDataAll,
      cdk.aws_stepfunctions.IntegrationPattern.REQUEST_RESPONSE,
    )
    const historyCopy = lambdaInvoke(
      'history_copy',
      transformData,
      cdk.aws_stepfunctions.IntegrationPattern.REQUEST_RESPONSE,
    )
    const setTtlCommand = lambdaInvoke(
      'set_ttl_command',
      historyCopy,
      cdk.aws_stepfunctions.IntegrationPattern.REQUEST_RESPONSE,
    )

    const waitPrevCommand = lambdaInvoke(
      'wait_prev_command',
      setTtlCommand,
      cdk.aws_stepfunctions.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    )

    // Define Choice state
    const checkVersionResult = new cdk.aws_stepfunctions.Choice(
      this,
      'check_version_result',
      {
        stateName: 'check_version_result',
      },
    )
      .when(
        cdk.aws_stepfunctions.Condition.numberEquals('$.result', 0),
        setTtlCommand,
      )
      .when(
        cdk.aws_stepfunctions.Condition.numberEquals('$.result', 1),
        waitPrevCommand,
      )
      .when(cdk.aws_stepfunctions.Condition.numberEquals('$.result', -1), fail)
      .otherwise(waitPrevCommand)

    const sfnDefinition = lambdaInvoke(
      'check_version',
      checkVersionResult,
      cdk.aws_stepfunctions.IntegrationPattern.REQUEST_RESPONSE,
    )

    const sfnLogGroup = new cdk.aws_logs.LogGroup(
      this,
      'command-handler-sfn-log',
      {
        logGroupName: `/aws/vendedlogs/states/${prefix}-command-handler-state-machine-Logs`, // Specify a log group name
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Policy for log group removal
        retention: cdk.aws_logs.RetentionDays.SIX_MONTHS,
      },
    )

    // Define the state machine
    const stateMachine = new cdk.aws_stepfunctions.StateMachine(
      this,
      'command-handler-state-machine',
      {
        stateMachineName: prefix + 'command-handler',
        comment: 'A state machine that run the command stream handler',
        definitionBody:
          cdk.aws_stepfunctions.DefinitionBody.fromChainable(sfnDefinition),
        tracingEnabled: true,
        logs: {
          destination: sfnLogGroup,
          level: cdk.aws_stepfunctions.LogLevel.ALL, // Log level (ALL, ERROR, or FATAL)
        },
      },
    )

    // Output the State Machine's ARN
    this.stateMachineArn = new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
    })

    // add event sources to lambda event
    lambdaApi.addEventSource(
      new cdk.aws_lambda_event_sources.SqsEventSource(taskSqs, {
        batchSize: 1,
      }),
    )
    lambdaApi.addEventSource(
      new cdk.aws_lambda_event_sources.SqsEventSource(notifySqs, {
        batchSize: 1,
      }),
    )
    // dynamodb event source
    const tableNames = ['tasks', 'master-command']
    for (const tableName of tableNames) {
      const tableDesc = new cdk.custom_resources.AwsCustomResource(
        this,
        tableName + '-decs',
        {
          onCreate: {
            service: 'DynamoDB',
            action: 'describeTable',
            parameters: {
              TableName: prefix + tableName,
            },
            physicalResourceId:
              cdk.custom_resources.PhysicalResourceId.fromResponse(
                'Table.TableArn',
              ),
          },
          policy: cdk.custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
            resources:
              cdk.custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
          }),
        },
      )
      const tableCdk = cdk.aws_dynamodb.Table.fromTableAttributes(
        this,
        tableName + '-table',
        {
          tableArn: tableDesc.getResponseField('Table.TableArn'),
          tableStreamArn: tableDesc.getResponseField('Table.LatestStreamArn'),
        },
      )
      lambdaApi.addEventSource(
        new cdk.aws_lambda_event_sources.DynamoEventSource(tableCdk, {
          startingPosition: cdk.aws_lambda.StartingPosition.TRIM_HORIZON,
          batchSize: 1,
          filters: [
            cdk.aws_lambda.FilterCriteria.filter({
              eventName: cdk.aws_lambda.FilterRule.isEqual('INSERT'),
            }),
          ],
        }),
      )
    }

    // add lambda role
    userPool.grant(
      lambdaApi,
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminDeleteUser',
      'cognito-idp:AdminDisableUser',
      'cognito-idp:AdminEnableUser',
      'cognito-idp:AdminSetUserPassword',
      'cognito-idp:AdminResetUserPassword',
      'cognito-idp:AdminUpdateUserAttributes',
    )
    ddbBucket.grantReadWrite(lambdaApi)
    publicBucket.grantReadWrite(lambdaApi)
    mainSns.grantPublish(lambdaApi)
    taskSqs.grantSendMessages(lambdaApi)
    notifySqs.grantSendMessages(lambdaApi)
    appSyncApi.grantMutation(lambdaApi)

    // Define an IAM policy for full DynamoDB access
    const dynamoDbTablePrefixArn = cdk.Arn.format({
      partition: 'aws',
      region: this.region,
      account: this.account,
      service: 'dynamodb',
      resource: 'table',
      resourceName: prefix + '*',
    })
    const dynamodbPolicy = new cdk.aws_iam.PolicyStatement({
      actions: [
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'dynamodb:Query',
      ],
      resources: [dynamoDbTablePrefixArn], // Access to all resources
    })

    // Attach the policy to the Lambda function's execution role
    lambdaApi.role?.attachInlinePolicy(
      new cdk.aws_iam.Policy(this, 'lambda-api-ddb-policy', {
        statements: [dynamodbPolicy],
      }),
    )

    const sfnPolicy = new cdk.aws_iam.PolicyStatement({
      actions: [
        'states:StartExecution',
        'states:GetExecutionHistory',
        'states:DescribeExecution',
      ],
      resources: [commandSfnArn],
    })

    // Attach the policy to the Lambda function's execution role
    lambdaApi.role?.attachInlinePolicy(
      new cdk.aws_iam.Policy(this, 'lambda-event-sfn-policy', {
        statements: [sfnPolicy],
      }),
    )

    const sesPolicy = new cdk.aws_iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    })

    // Attach the policy to the Lambda function's execution role
    lambdaApi.role?.attachInlinePolicy(
      new cdk.aws_iam.Policy(this, 'lambda-ses-policy', {
        statements: [sesPolicy],
      }),
    )

    const ssmPolicy = new cdk.aws_iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'kms:Decrypt'],
      resources: ['*'],
    })

    // allow lambdaApi role to access ssm
    lambdaApi.role?.attachInlinePolicy(
      new cdk.aws_iam.Policy(this, 'lambda-api-ssm-policy', {
        statements: [ssmPolicy],
      }),
    )

    if (!!taskRole) {
      ddbBucket.grantReadWrite(taskRole)
      publicBucket.grantReadWrite(taskRole)
      mainSns.grantPublish(taskRole)
      taskSqs.grantSendMessages(taskRole)
      notifySqs.grantSendMessages(taskRole)
      appSyncApi.grantMutation(taskRole)
      taskRole.addToPrincipalPolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'ssmmessages:CreateControlChannel',
            'ssmmessages:CreateDataChannel',
            'ssmmessages:OpenControlChannel',
            'ssmmessages:OpenDataChannel',
          ],
          resources: ['*'],
        }),
      )
      taskRole.attachInlinePolicy(
        new cdk.aws_iam.Policy(this, 'ecs-api-ddb-policy', {
          statements: [dynamodbPolicy],
        }),
      )
      taskRole.attachInlinePolicy(
        new cdk.aws_iam.Policy(this, 'ecs-event-sfn-policy', {
          statements: [sfnPolicy],
        }),
      )
      taskRole.attachInlinePolicy(
        new cdk.aws_iam.Policy(this, 'ecs-ses-policy', {
          statements: [sesPolicy],
        }),
      )
      taskRole.attachInlinePolicy(
        new cdk.aws_iam.Policy(this, 'ecs-api-ssm-policy', {
          statements: [ssmPolicy],
        }),
      )
    }
  }
}
