// enable this for local debugging
// import 'source-map-support/register'

import serverlessExpress from '@codegenie/serverless-express'
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpAdapterHost, NestFactory, Reflector } from '@nestjs/core'
import { Context, Handler } from 'aws-lambda'
import * as express from 'express'
import { firstValueFrom, ReplaySubject } from 'rxjs'

import { AppModule } from './app.module'
import { HEADER_TENANT_CODE } from './constants'
import { Environment } from './env.validation'
import { DynamoDBExceptionFilter } from './filters'
import { IS_LAMBDA_RUNNING } from './helpers'
import { AppModuleOptions } from './interfaces'
import { AppLogLevel, getLogLevels, RequestLogger } from './services'

const serverSubject = new ReplaySubject<Handler>()

async function bootstrap(opts: AppModuleOptions) {
  const logLevel: AppLogLevel =
    (process.env.LOG_LEVEL as AppLogLevel) ?? 'verbose'
  const logger = new RequestLogger('main', {
    logLevels: getLogLevels(logLevel),
    timestamp: logLevel === 'verbose' || logLevel === 'debug',
  })

  const app = await NestFactory.create(AppModule.forRoot(opts), {
    cors: true,
    logger,
  })

  const configService = app.get(ConfigService)
  const bodySizeLimit =
    configService.get<string>('REQUEST_BODY_SIZE_LIMIT') || '100kb'

  app.use(express.json({ limit: bodySizeLimit }))
  app.use(express.urlencoded({ limit: bodySizeLimit, extended: true }))

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  )

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))

  const { httpAdapter } = app.get(HttpAdapterHost)
  app.useGlobalFilters(new DynamoDBExceptionFilter(httpAdapter))

  //swager init
  if (configService.get<Environment>('NODE_ENV') === Environment.Local) {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger')

    const swgConfig = new DocumentBuilder()
      .setTitle('serverless')
      .setDescription('The serverless API')
      .addServer('http://localhost:3000/', Environment.Local)
      .addApiKey(
        { type: 'apiKey', name: 'Authorization', in: 'header' },
        'Api-Key',
      )
      .addSecurityRequirements('Api-Key')
      .addGlobalParameters({
        in: 'header',
        required: false,
        name: HEADER_TENANT_CODE,
      })
      .build()
    const document = SwaggerModule.createDocument(app, swgConfig, {
      deepScanRoutes: true,
    })
    SwaggerModule.setup('/swagger-ui', app, document)
    import('fs').then((fs) => {
      import('prettier').then((prettier) => {
        prettier
          .format(JSON.stringify(document), {
            parser: 'json',
          })
          .then((ret) => fs.writeFileSync('swagger.json', ret))
      })
    })

    // const { SpelunkerModule } = await import('nestjs-spelunker')

    // const tree = SpelunkerModule.explore(app)
    // const root = SpelunkerModule.graph(tree)
    // const edges = SpelunkerModule.findGraphEdges(root)
    // // eslint-disable-next-line no-console
    // console.log('graph LR')
    // const mermaidEdges = edges.map(
    //   ({ from, to }) => `  ${from.module.name}-->${to.module.name}`,
    // )
    // // eslint-disable-next-line no-console
    // console.log(mermaidEdges.join('\n'))
  }

  if (!IS_LAMBDA_RUNNING) {
    await app.listen(configService.get<number>('APP_PORT') || 3000)
    return null
  }

  await app.init()

  const expressApp = app.getHttpAdapter().getInstance()

  return serverlessExpress({
    app: expressApp,
    // resolutionMode: 'CALLBACK',
    eventSourceRoutes: {
      AWS_SNS: '/event/sns',
      AWS_SQS: '/event/sqs',
      AWS_DYNAMODB: '/event/dynamodb',
      AWS_EVENTBRIDGE: '/event/event-bridge',
      AWS_STEP_FUNCTIONS: '/event/step-functions',
      AWS_S3: '/event/s3',
      AWS_KINESIS_DATA_STREAM: '/event/kinesis-data-stream',
    },
    logSettings: {
      level: logLevel,
    },
  })
}

/**
 * Async handler type for Node.js 24 compatibility
 *
 * Node.js 24 does not support callback-based handlers.
 * This type represents an async handler that returns a Promise.
 */
type AsyncHandler = (event: any, context: Context) => Promise<any>

/**
 * Create Lambda handler
 *
 * Node.js 24 compatibility:
 * - Handler signature is (event, context) only
 * - callback parameter is not used (not supported in Node.js 24)
 *
 * @see https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
 */
export function createHandler(opts: AppModuleOptions): Handler {
  // Do not wait for lambdaHandler to be called before bootstraping Nest.
  bootstrap(opts).then((server) => serverSubject.next(server))

  return async (event: any, context: Context) => {
    // Wait for bootstrap to finish, then start handling requests.
    const server = (await firstValueFrom(serverSubject)) as AsyncHandler
    return server(event, context)
  }
}
