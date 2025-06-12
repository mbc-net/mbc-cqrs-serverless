import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ValidationPipe } from '@nestjs/common'
import { McpHostModule } from './mcp-host.module'

async function bootstrap() {
  const app = await NestFactory.create(McpHostModule)

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  }))

  app.enableCors({
    origin: true,
    credentials: true
  })

  const config = new DocumentBuilder()
    .setTitle('MCP Host API')
    .setDescription('MCPホストAPI - Claude AIを使用したAWSリソースアクセス')
    .setVersion('1.0')
    .addTag('MCP Host', 'MCPサーバーとClaude AI統合')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  const port = process.env.PORT || 3000
  await app.listen(port)
  
  console.log(`MCP Host API is running on: http://localhost:${port}`)
  console.log(`Swagger documentation: http://localhost:${port}/api`)
}

bootstrap()
