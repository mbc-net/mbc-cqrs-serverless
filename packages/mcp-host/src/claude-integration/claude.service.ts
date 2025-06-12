import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | any[]
}

interface ClaudeToolUse {
  type: 'tool_use'
  id: string
  name: string
  input: any
}

interface ClaudeToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name)
  private readonly client: AxiosInstance
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.anthropic.com/v1'

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is required')
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
  }

  async processNaturalLanguageQuery(
    userMessage: string,
    tenantCode?: string,
  ): Promise<{
    response: string
    toolsUsed: string[]
    mcpCalls: any[]
    processingTime: number
  }> {
    const startTime = Date.now()
    const toolsUsed: string[] = []
    const mcpCalls: any[] = []

    try {
      const messages: ClaudeMessage[] = [
        {
          role: 'user',
          content: this.buildSystemPrompt(tenantCode) + '\n\n' + userMessage,
        },
      ]

      const response = await this.client.post('/messages', {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages,
        tools: this.getAvailableTools(),
        tool_choice: { type: 'auto' },
      })

      let finalResponse = ''
      const responseContent = response.data.content

      for (const content of responseContent) {
        if (content.type === 'text') {
          finalResponse += content.text
        } else if (content.type === 'tool_use') {
          const toolUse = content as ClaudeToolUse
          toolsUsed.push(toolUse.name)

          const toolResult = await this.executeMcpTool(toolUse, tenantCode)
          mcpCalls.push({
            tool: toolUse.name,
            input: toolUse.input,
            result: toolResult,
          })

          const followUpMessages: ClaudeMessage[] = [
            ...messages,
            {
              role: 'assistant',
              content: responseContent,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(toolResult),
                } as ClaudeToolResult,
              ],
            },
          ]

          const followUpResponse = await this.client.post('/messages', {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: followUpMessages,
          })

          const followUpContent = followUpResponse.data.content
          for (const followContent of followUpContent) {
            if (followContent.type === 'text') {
              finalResponse += followContent.text
            }
          }
        }
      }

      const processingTime = Date.now() - startTime

      return {
        response: finalResponse || 'システムの処理が完了しました。',
        toolsUsed,
        mcpCalls,
        processingTime,
      }
    } catch (error) {
      this.logger.error('Claude API error:', error)
      const processingTime = Date.now() - startTime

      return {
        response:
          '申し訳ございませんが、システムエラーが発生しました。しばらく時間をおいて再度お試しください。',
        toolsUsed,
        mcpCalls,
        processingTime,
      }
    }
  }

  private buildSystemPrompt(tenantCode?: string): string {
    return `あなたは顧客問い合わせ対応のアシスタントです。以下の機能を使用してAWSリソースの情報を取得し、日本語で分かりやすく回答してください。

利用可能な機能：
1. CloudWatch Logsの検索 - システムログやエラーログの確認
2. RDSデータの検索 - データベースの情報取得
3. DynamoDBの操作 - NoSQLデータベースの情報取得
4. システムメトリクス - 稼働状況やパフォーマンス指標の取得

${tenantCode ? `テナントコード: ${tenantCode}` : ''}

回答の際は：
- 技術的な内容も分かりやすく説明してください
- 数値データは具体的に示してください
- 問題がある場合は対処方法も提案してください
- 丁寧で親しみやすい口調で回答してください`
  }

  private getAvailableTools() {
    return [
      {
        name: 'cloudwatch_logs_query',
        description: 'CloudWatch Logsを検索してシステムログやエラーログを取得',
        input_schema: {
          type: 'object',
          properties: {
            log_group: {
              type: 'string',
              description: 'ロググループ名',
            },
            query: {
              type: 'string',
              description: '自然言語での検索クエリ',
            },
            hours_back: {
              type: 'number',
              description: '何時間前からのログを検索するか',
              default: 24,
            },
            limit: {
              type: 'number',
              description: '取得する最大件数',
              default: 100,
            },
          },
          required: ['log_group', 'query'],
        },
      },
      {
        name: 'rds_data_query',
        description: 'RDSデータベースからデータを検索',
        input_schema: {
          type: 'object',
          properties: {
            natural_query: {
              type: 'string',
              description: '自然言語でのデータ検索クエリ',
            },
            table_name: {
              type: 'string',
              description: '対象テーブル名',
            },
          },
          required: ['natural_query'],
        },
      },
      {
        name: 'dynamodb_operations',
        description: 'DynamoDBデータの操作',
        input_schema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'DynamoDBテーブル名',
            },
            natural_query: {
              type: 'string',
              description: '自然言語での操作クエリ',
            },
            tenant_code: {
              type: 'string',
              description: 'テナントコード',
            },
          },
          required: ['table_name', 'natural_query'],
        },
      },
      {
        name: 'system_metrics',
        description: 'システム稼働状況メトリクスを取得',
        input_schema: {
          type: 'object',
          properties: {
            tenant_code: {
              type: 'string',
              description: 'テナントコード',
            },
          },
        },
      },
    ]
  }

  private async executeMcpTool(
    toolUse: ClaudeToolUse,
    tenantCode?: string,
  ): Promise<any> {
    try {
      const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:8000'

      const response = await axios.post(
        `${mcpServerUrl}/tools/${toolUse.name}`,
        {
          ...toolUse.input,
          tenant_code: tenantCode,
        },
      )

      return response.data
    } catch (error) {
      this.logger.error(`MCP tool execution error for ${toolUse.name}:`, error)
      return {
        status: 'error',
        error: `ツール ${toolUse.name} の実行中にエラーが発生しました`,
      }
    }
  }
}
