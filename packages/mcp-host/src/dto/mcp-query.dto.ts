import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class CloudWatchLogsQueryDto {
  @ApiProperty({
    description: 'CloudWatch Logs グループ名',
    example: '/aws/lambda/my-function',
  })
  @IsString()
  logGroup: string

  @ApiProperty({
    description: '自然言語での検索クエリ',
    example: 'エラーログを検索して',
  })
  @IsString()
  query: string

  @ApiPropertyOptional({
    description: '何時間前からのログを検索するか',
    example: 24,
    minimum: 1,
    maximum: 168,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  hoursBack?: number = 24

  @ApiPropertyOptional({
    description: '取得する最大件数',
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100
}

export class RdsQueryDto {
  @ApiProperty({
    description: '自然言語でのデータ検索クエリ',
    example: 'ユーザー数を教えて',
  })
  @IsString()
  naturalQuery: string

  @ApiPropertyOptional({
    description: '対象テーブル名',
    example: 'users',
  })
  @IsOptional()
  @IsString()
  tableName?: string

  @ApiPropertyOptional({
    description: 'データベース接続URL（省略時は環境変数から取得）',
  })
  @IsOptional()
  @IsString()
  databaseUrl?: string
}

export class DynamoDbQueryDto {
  @ApiProperty({
    description: 'DynamoDBテーブル名',
    example: 'users',
  })
  @IsString()
  tableName: string

  @ApiProperty({
    description: '自然言語での操作クエリ',
    example: 'データ件数を確認して',
  })
  @IsString()
  naturalQuery: string

  @ApiPropertyOptional({
    description: 'テナントコード（マルチテナント対応）',
    example: 'tenant001',
  })
  @IsOptional()
  @IsString()
  tenantCode?: string
}

export class ChatRequestDto {
  @ApiProperty({
    description: '顧客からの問い合わせ内容',
    example: 'システムの稼働状況を教えてください',
  })
  @IsString()
  message: string

  @ApiPropertyOptional({
    description: 'テナントコード',
    example: 'tenant001',
  })
  @IsOptional()
  @IsString()
  tenantCode?: string

  @ApiPropertyOptional({
    description: 'コンテキスト情報（過去の会話履歴など）',
  })
  @IsOptional()
  context?: any
}

export class SystemMetricsQueryDto {
  @ApiPropertyOptional({
    description: 'テナントコード（省略時は全体メトリクス）',
    example: 'tenant001',
  })
  @IsOptional()
  @IsString()
  tenantCode?: string
}
