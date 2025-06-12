import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { McpClientService } from '../aws-services/mcp-client.service'
import { ClaudeService } from '../claude-integration/claude.service'
import {
  ChatRequestDto,
  CloudWatchLogsQueryDto,
  DynamoDbQueryDto,
  RdsQueryDto,
  SystemMetricsQueryDto,
} from '../dto/mcp-query.dto'
import {
  ChatResponseDto,
  CloudWatchLogsResponseDto,
  DynamoDbResponseDto,
  McpResponseDto,
  RdsDataResponseDto,
  SystemMetricsResponseDto,
} from '../dto/mcp-response.dto'

@ApiTags('MCP Host')
@Controller('mcp')
export class McpController {
  constructor(
    private readonly mcpClientService: McpClientService,
    private readonly claudeService: ClaudeService,
  ) {}

  @Post('chat')
  @ApiOperation({
    summary: '顧客問い合わせ処理',
    description:
      '自然言語での問い合わせをClaude AIで処理し、必要に応じてAWSリソースにアクセス',
  })
  @ApiResponse({
    status: 200,
    description: 'チャット処理成功',
    type: ChatResponseDto,
  })
  async processChat(
    @Body() chatRequest: ChatRequestDto,
  ): Promise<McpResponseDto<ChatResponseDto>> {
    try {
      const result = await this.claudeService.processNaturalLanguageQuery(
        chatRequest.message,
        chatRequest.tenantCode,
      )

      return {
        status: 'success',
        data: {
          response: result.response,
          toolsUsed: result.toolsUsed,
          context: result.mcpCalls,
          processingTime: result.processingTime,
        },
      }
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('cloudwatch-logs')
  @ApiOperation({
    summary: 'CloudWatch Logs検索',
    description: '自然言語でCloudWatch Logsを検索',
  })
  @ApiResponse({
    status: 200,
    description: 'ログ検索成功',
    type: CloudWatchLogsResponseDto,
  })
  async queryCloudWatchLogs(
    @Body() query: CloudWatchLogsQueryDto,
  ): Promise<McpResponseDto<CloudWatchLogsResponseDto>> {
    try {
      const result = await this.mcpClientService.queryCloudWatchLogs(
        query.logGroup,
        query.query,
        query.hoursBack,
        query.limit,
      )

      return {
        status: 'success',
        data: result,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new HttpException(
        {
          status: 'error',
          error: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('rds-data')
  @ApiOperation({
    summary: 'RDSデータ検索',
    description: '自然言語でRDSデータを検索',
  })
  @ApiResponse({
    status: 200,
    description: 'データ検索成功',
    type: RdsDataResponseDto,
  })
  async queryRdsData(
    @Body() query: RdsQueryDto,
  ): Promise<McpResponseDto<RdsDataResponseDto>> {
    try {
      const result = await this.mcpClientService.queryRdsData(
        query.naturalQuery,
        query.tableName,
        query.databaseUrl,
      )

      return {
        status: 'success',
        data: result,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new HttpException(
        {
          status: 'error',
          error: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('dynamodb-data')
  @ApiOperation({
    summary: 'DynamoDBデータ操作',
    description: '自然言語でDynamoDBデータを操作',
  })
  @ApiResponse({
    status: 200,
    description: 'データ操作成功',
    type: DynamoDbResponseDto,
  })
  async queryDynamoDbData(
    @Body() query: DynamoDbQueryDto,
  ): Promise<McpResponseDto<DynamoDbResponseDto>> {
    try {
      const result = await this.mcpClientService.queryDynamoDbData(
        query.tableName,
        query.naturalQuery,
        query.tenantCode,
      )

      return {
        status: 'success',
        data: result,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new HttpException(
        {
          status: 'error',
          error: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('system-metrics')
  @ApiOperation({
    summary: 'システム稼働状況取得',
    description: 'システムメトリクスと稼働状況を取得',
  })
  @ApiResponse({
    status: 200,
    description: 'メトリクス取得成功',
    type: SystemMetricsResponseDto,
  })
  async getSystemMetrics(
    @Query() query: SystemMetricsQueryDto,
  ): Promise<McpResponseDto<SystemMetricsResponseDto>> {
    try {
      const result = await this.mcpClientService.getSystemMetrics(
        query.tenantCode,
      )

      return {
        status: 'success',
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('health')
  @ApiOperation({
    summary: 'ヘルスチェック',
    description: 'MCPサーバーとシステムの稼働状況を確認',
  })
  @ApiResponse({
    status: 200,
    description: 'ヘルスチェック成功',
  })
  async healthCheck(): Promise<McpResponseDto<any>> {
    try {
      const mcpHealthy = await this.mcpClientService.healthCheck()
      const serverInfo = await this.mcpClientService.getServerInfo()

      return {
        status: 'success',
        data: {
          mcp_server_healthy: mcpHealthy,
          server_info: serverInfo,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        status: 'error',
        error: message,
      }
    }
  }
}
