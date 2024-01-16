// enable this for local debugging
// import 'source-map-support/register'

import serverlessExpress from '@codegenie/serverless-express'
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpAdapterHost, NestFactory, Reflector } from '@nestjs/core'
import { Callback, Context, Handler } from 'aws-lambda'

import { AppModule } from './app.module'
import { HEADER_TENANT_CODE } from './constants'
import { Environment } from './env.validation'
import { DynamoDBExceptionFilter } from './filters'
import { AppModuleOptions } from './interfaces'
import { AppLogLevel, getLogLevels, RequestLogger } from './services'

let server: Handler

async function bootstrap(opts: AppModuleOptions) {
  const logLevel: AppLogLevel =
    (process.env.LOG_LEVEL as AppLogLevel) ?? 'verbose'
  const logger = new RequestLogger('main', {
    logLevels: getLogLevels(logLevel),
    timestamp: true,
  })

  const app = await NestFactory.create(AppModule.forRoot(opts), {
    cors: true,
    logger,
  })

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
  const configService = app.get(ConfigService)
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
    },
    logSettings: {
      level: logLevel,
    },
  })
}

export function createHandler(opts: AppModuleOptions): Handler {
  return async (event: any, context: Context, callback: Callback) => {
    server = server ?? (await bootstrap(opts))
    return server(event, context, callback)
  }
}
