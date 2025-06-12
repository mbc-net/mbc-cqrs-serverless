"""
FastMCP Server implementation for AWS resource access
"""
import os
import logging
from typing import Dict, Any, Optional
from fastmcp import FastMCP
from .aws_tools import AWSResourceManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mcp = FastMCP("AWS Resource MCP Server")
aws_manager = AWSResourceManager()

@mcp.tool()
async def cloudwatch_logs_query(
    log_group: str,
    query: str,
    hours_back: int = 24,
    limit: int = 100
) -> Dict[str, Any]:
    """
    CloudWatch Logsを自然言語で検索
    
    Args:
        log_group: ロググループ名
        query: 自然言語での検索クエリ（例：「エラーログを検索」「警告を含むログ」）
        hours_back: 何時間前からのログを検索するか
        limit: 取得する最大件数
    
    Returns:
        検索結果とメタデータ
    """
    from datetime import datetime, timedelta
    
    start_time = datetime.now() - timedelta(hours=hours_back)
    end_time = datetime.now()
    
    result = await aws_manager.query_cloudwatch_logs(
        log_group=log_group,
        query=query,
        start_time=start_time,
        end_time=end_time,
        limit=limit
    )
    
    return result

@mcp.tool()
async def rds_data_query(
    natural_query: str,
    table_name: Optional[str] = None,
    database_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    RDSデータを自然言語で検索
    
    Args:
        natural_query: 自然言語での検索クエリ（例：「ユーザー数を教えて」「最新のデータを取得」）
        table_name: 対象テーブル名（省略時はデフォルト）
        database_url: データベース接続URL（省略時は環境変数から取得）
    
    Returns:
        クエリ結果とメタデータ
    """
    if not database_url:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {
                'status': 'error',
                'error': 'DATABASE_URL environment variable not set'
            }
    
    result = await aws_manager.query_rds_data(
        database_url=database_url,
        natural_query=natural_query,
        table_name=table_name
    )
    
    return result

@mcp.tool()
async def dynamodb_operations(
    table_name: str,
    natural_query: str,
    tenant_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    DynamoDBデータを自然言語で操作
    
    Args:
        table_name: DynamoDBテーブル名
        natural_query: 自然言語での操作クエリ（例：「データ件数を確認」「最新のレコードを取得」）
        tenant_code: テナントコード（マルチテナント対応）
    
    Returns:
        操作結果とメタデータ
    """
    if tenant_code:
        env = os.getenv('NODE_ENV', 'dev')
        app_name = os.getenv('APP_NAME', 'main')
        full_table_name = f"{env}-{app_name}-{table_name}"
    else:
        full_table_name = table_name
    
    result = await aws_manager.query_dynamodb_data(
        table_name=full_table_name,
        natural_query=natural_query,
        tenant_code=tenant_code
    )
    
    return result

@mcp.tool()
async def system_metrics(
    tenant_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    システム稼働状況メトリクスを取得
    
    Args:
        tenant_code: テナントコード（省略時は全体メトリクス）
    
    Returns:
        システムメトリクス（データ登録件数、API呼び出し数など）
    """
    result = await aws_manager.get_system_metrics(tenant_code=tenant_code)
    return result

@mcp.resource("aws://logs")
async def logs_resource() -> str:
    """CloudWatch Logsリソース情報"""
    return "CloudWatch Logs - システムログの検索と分析"

@mcp.resource("aws://rds")
async def rds_resource() -> str:
    """RDSリソース情報"""
    return "Amazon RDS - リレーショナルデータベースのデータ検索"

@mcp.resource("aws://dynamodb")
async def dynamodb_resource() -> str:
    """DynamoDBリソース情報"""
    return "Amazon DynamoDB - NoSQLデータベースの操作"

@mcp.resource("aws://metrics")
async def metrics_resource() -> str:
    """システムメトリクスリソース情報"""
    return "System Metrics - システム稼働状況とパフォーマンス指標"

@mcp.get_server_info()
async def server_info():
    return {
        "name": "AWS Resource MCP Server",
        "version": "1.0.0",
        "description": "自然言語でAWSリソースにアクセスするためのMCPサーバー",
        "capabilities": [
            "CloudWatch Logs検索",
            "RDSデータクエリ",
            "DynamoDB操作",
            "システムメトリクス取得"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('PORT', 8000))
    uvicorn.run(
        "mcp_server.server:mcp",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
