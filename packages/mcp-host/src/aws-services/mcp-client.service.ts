import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name)
  private readonly client: AxiosInstance
  private readonly mcpServerUrl: string

  constructor() {
    this.mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:8000'
    this.client = axios.create({
      baseURL: this.mcpServerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  async queryCloudWatchLogs(
    logGroup: string,
    query: string,
    hoursBack: number = 24,
    limit: number = 100,
  ): Promise<any> {
    try {
      const response = await this.client.post('/tools/cloudwatch_logs_query', {
        log_group: logGroup,
        query,
        hours_back: hoursBack,
        limit,
      })

      return response.data
    } catch (error) {
      this.logger.error('CloudWatch Logs query error:', error)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`CloudWatch Logsクエリでエラーが発生しました: ${message}`)
    }
  }

  async queryRdsData(
    naturalQuery: string,
    tableName?: string,
    databaseUrl?: string,
  ): Promise<any> {
    try {
      const response = await this.client.post('/tools/rds_data_query', {
        natural_query: naturalQuery,
        table_name: tableName,
        database_url: databaseUrl,
      })

      return response.data
    } catch (error) {
      this.logger.error('RDS data query error:', error)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`RDSデータクエリでエラーが発生しました: ${message}`)
    }
  }

  async queryDynamoDbData(
    tableName: string,
    naturalQuery: string,
    tenantCode?: string,
  ): Promise<any> {
    try {
      const response = await this.client.post('/tools/dynamodb_operations', {
        table_name: tableName,
        natural_query: naturalQuery,
        tenant_code: tenantCode,
      })

      return response.data
    } catch (error) {
      this.logger.error('DynamoDB query error:', error)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`DynamoDBクエリでエラーが発生しました: ${message}`)
    }
  }

  async getSystemMetrics(tenantCode?: string): Promise<any> {
    try {
      const response = await this.client.post('/tools/system_metrics', {
        tenant_code: tenantCode,
      })

      return response.data
    } catch (error) {
      this.logger.error('System metrics error:', error)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `システムメトリクス取得でエラーが発生しました: ${message}`,
      )
    }
  }

  async getServerInfo(): Promise<any> {
    try {
      const response = await this.client.get('/server-info')
      return response.data
    } catch (error) {
      this.logger.error('MCP server info error:', error)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`MCPサーバー情報取得でエラーが発生しました: ${message}`)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health')
      return response.status === 200
    } catch (error) {
      this.logger.error('MCP server health check failed:', error)
      return false
    }
  }
}
