/* eslint-disable no-console */
import { AppModule, HEADER_TENANT_CODE } from '@mbc-cqrs-serverless/core'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { format } from 'prettier'

import { MainModule } from './main.module'

const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta
    name="description"
    content="serverless"
  />
  <title>serverless</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.4.1/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.4.1/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.4.1/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ###JSON###,
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`

async function generateSwagger() {
  const app = await NestFactory.create(
    AppModule.forRoot({
      rootModule: MainModule,
    }),
  )
  const config = new DocumentBuilder()
    .setTitle('serverless')
    .setDescription('The serverless API')
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

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  })

  const reportDir = path.join(__dirname, '../report')

  if (!existsSync(reportDir)) {
    mkdirSync(reportDir)
  }

  format(JSON.stringify(document), {
    parser: 'json',
  }).then((ret) => writeFileSync(path.join(reportDir, 'swagger.json'), ret))

  writeFileSync(
    path.join(reportDir, 'swagger-ui.html'),
    template.replace('###JSON###', JSON.stringify(document)),
  )

  console.log('Swagger documentation has been successfully generated!')
  await app.close()
}

generateSwagger().catch((err) => {
  console.error('Error generating Swagger documentation:', err)
  process.exit(1)
})
