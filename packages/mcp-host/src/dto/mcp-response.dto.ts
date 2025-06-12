import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class McpResponseDto<T = any> {
  @ApiProperty({
    description: 'レスポンスステータス',
    enum: ['success', 'error'],
  })
  status: 'success' | 'error'

  @ApiPropertyOptional({
    description: 'レスポンスデータ',
  })
  data?: T

  @ApiPropertyOptional({
    description: 'エラーメッセージ',
  })
  error?: string

  @ApiPropertyOptional({
    description: 'メタデータ',
  })
  metadata?: any
}

export class CloudWatchLogsResponseDto {
  @ApiProperty({
    description: 'ログ検索結果',
  })
  results: any[]

  @ApiProperty({
    description: '実行されたCloudWatch Insightsクエリ',
  })
  query: string

  @ApiProperty({
    description: '対象ロググループ',
  })
  logGroup: string

  @ApiPropertyOptional({
    description: 'クエリ統計情報',
  })
  statistics?: any
}

export class RdsDataResponseDto {
  @ApiProperty({
    description: 'クエリ結果データ',
  })
  data: any[]

  @ApiProperty({
    description: '実行されたSQLクエリ',
  })
  query: string

  @ApiProperty({
    description: '結果件数',
  })
  count: number
}

export class DynamoDbResponseDto {
  @ApiProperty({
    description: 'DynamoDBデータまたは件数',
  })
  data?: any[]

  @ApiProperty({
    description: '件数',
  })
  count: number

  @ApiProperty({
    description: '対象テーブル名',
  })
  table: string
}

export class SystemMetricsResponseDto {
  @ApiProperty({
    description: 'システムメトリクス',
  })
  metrics: {
    users_count: number
    projects_count: number
    tasks_count: number
    lambda_invocations_24h: number
    api_requests_24h: number
  }

  @ApiProperty({
    description: 'メトリクス取得時刻',
  })
  timestamp: string

  @ApiPropertyOptional({
    description: 'テナントコード',
  })
  tenant?: string
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'Claude AIからの回答',
  })
  response: string

  @ApiPropertyOptional({
    description: '使用されたMCPツール情報',
  })
  toolsUsed?: string[]

  @ApiPropertyOptional({
    description: 'コンテキスト情報',
  })
  context?: any

  @ApiProperty({
    description: '処理時間（ミリ秒）',
  })
  processingTime: number
}
