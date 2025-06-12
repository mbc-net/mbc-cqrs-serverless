"""
AWS Tools for MCP Server - CloudWatch Logs, RDS, DynamoDB access
"""
import boto3
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

class AWSResourceManager:
    """AWS resource access manager with natural language support"""
    
    def __init__(self):
        self.cloudwatch_logs = boto3.client('logs')
        self.dynamodb = boto3.resource('dynamodb')
        self.rds_client = boto3.client('rds')
        
    async def query_cloudwatch_logs(
        self, 
        log_group: str, 
        query: str, 
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        CloudWatch Logsクエリを実行
        自然言語クエリをCloudWatch Insights クエリに変換
        """
        try:
            if not start_time:
                start_time = datetime.now() - timedelta(hours=24)
            if not end_time:
                end_time = datetime.now()
                
            insights_query = self._convert_natural_language_to_insights(query)
            
            response = self.cloudwatch_logs.start_query(
                logGroupName=log_group,
                startTime=int(start_time.timestamp()),
                endTime=int(end_time.timestamp()),
                queryString=insights_query,
                limit=limit
            )
            
            query_id = response['queryId']
            
            import time
            while True:
                result = self.cloudwatch_logs.get_query_results(queryId=query_id)
                if result['status'] == 'Complete':
                    break
                elif result['status'] == 'Failed':
                    raise Exception(f"Query failed: {result.get('statistics', {})}")
                time.sleep(1)
            
            return {
                'status': 'success',
                'results': result['results'],
                'statistics': result.get('statistics', {}),
                'query': insights_query,
                'log_group': log_group
            }
            
        except Exception as e:
            logger.error(f"CloudWatch Logs query error: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'query': query,
                'log_group': log_group
            }
    
    def _convert_natural_language_to_insights(self, natural_query: str) -> str:
        """自然言語クエリをCloudWatch Insights クエリに変換"""
        query_lower = natural_query.lower()
        
        if 'エラー' in query_lower or 'error' in query_lower:
            return 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc'
        
        if '警告' in query_lower or 'warning' in query_lower or 'warn' in query_lower:
            return 'fields @timestamp, @message | filter @message like /WARN/ | sort @timestamp desc'
        
        if '含む' in query_lower or 'contains' in query_lower:
            keywords = [word for word in natural_query.split() if len(word) > 2]
            if keywords:
                keyword = keywords[-1]  # 最後のキーワードを使用
                return f'fields @timestamp, @message | filter @message like /{keyword}/ | sort @timestamp desc'
        
        return 'fields @timestamp, @message | sort @timestamp desc | limit 100'
    
    async def query_rds_data(
        self, 
        database_url: str, 
        natural_query: str,
        table_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        RDSデータクエリを実行
        自然言語クエリをSQLクエリに変換
        """
        try:
            conn = psycopg2.connect(database_url)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            sql_query = self._convert_natural_language_to_sql(natural_query, table_name)
            
            cursor.execute(sql_query)
            results = cursor.fetchall()
            
            data = [dict(row) for row in results]
            
            cursor.close()
            conn.close()
            
            return {
                'status': 'success',
                'data': data,
                'query': sql_query,
                'count': len(data)
            }
            
        except Exception as e:
            logger.error(f"RDS query error: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'query': natural_query
            }
    
    def _convert_natural_language_to_sql(self, natural_query: str, table_name: str = None) -> str:
        """自然言語クエリをSQLクエリに変換"""
        query_lower = natural_query.lower()
        
        if not table_name:
            table_name = 'users'  # デフォルトテーブル
        
        if '件数' in query_lower or 'count' in query_lower or '数' in query_lower:
            return f'SELECT COUNT(*) as count FROM {table_name}'
        
        if '最新' in query_lower or 'latest' in query_lower or '新しい' in query_lower:
            return f'SELECT * FROM {table_name} ORDER BY created_at DESC LIMIT 10'
        
        if '全て' in query_lower or 'all' in query_lower or '一覧' in query_lower:
            return f'SELECT * FROM {table_name} LIMIT 100'
        
        return f'SELECT * FROM {table_name} LIMIT 10'
    
    async def query_dynamodb_data(
        self, 
        table_name: str, 
        natural_query: str,
        tenant_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        DynamoDBデータクエリを実行
        自然言語クエリをDynamoDB操作に変換
        """
        try:
            table = self.dynamodb.Table(table_name)
            
            filter_expression = None
            if tenant_code:
                filter_expression = boto3.dynamodb.conditions.Attr('tenant').eq(tenant_code)
            
            query_lower = natural_query.lower()
            
            if '件数' in query_lower or 'count' in query_lower:
                response = table.scan(
                    FilterExpression=filter_expression,
                    Select='COUNT'
                )
                return {
                    'status': 'success',
                    'count': response['Count'],
                    'table': table_name
                }
            
            scan_kwargs = {'Limit': 100}
            if filter_expression:
                scan_kwargs['FilterExpression'] = filter_expression
            
            response = table.scan(**scan_kwargs)
            
            return {
                'status': 'success',
                'data': response['Items'],
                'count': len(response['Items']),
                'table': table_name
            }
            
        except Exception as e:
            logger.error(f"DynamoDB query error: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'query': natural_query,
                'table': table_name
            }
    
    async def get_system_metrics(self, tenant_code: Optional[str] = None) -> Dict[str, Any]:
        """システム稼働状況メトリクスを取得"""
        try:
            metrics = {}
            
            dynamodb_tables = ['users', 'projects', 'tasks']  # 主要テーブル
            for table_name in dynamodb_tables:
                try:
                    if tenant_code:
                        full_table_name = f"dev-{tenant_code}-{table_name}"
                    else:
                        full_table_name = f"dev-main-{table_name}"
                    
                    result = await self.query_dynamodb_data(full_table_name, "件数", tenant_code)
                    if result['status'] == 'success':
                        metrics[f'{table_name}_count'] = result.get('count', 0)
                except Exception as e:
                    logger.warning(f"Failed to get count for {table_name}: {str(e)}")
                    metrics[f'{table_name}_count'] = 0
            
            cloudwatch = boto3.client('cloudwatch')
            
            try:
                lambda_metrics = cloudwatch.get_metric_statistics(
                    Namespace='AWS/Lambda',
                    MetricName='Invocations',
                    Dimensions=[],
                    StartTime=datetime.now() - timedelta(hours=24),
                    EndTime=datetime.now(),
                    Period=3600,
                    Statistics=['Sum']
                )
                metrics['lambda_invocations_24h'] = sum([point['Sum'] for point in lambda_metrics['Datapoints']])
            except Exception as e:
                logger.warning(f"Failed to get Lambda metrics: {str(e)}")
                metrics['lambda_invocations_24h'] = 0
            
            try:
                api_metrics = cloudwatch.get_metric_statistics(
                    Namespace='AWS/ApiGateway',
                    MetricName='Count',
                    Dimensions=[],
                    StartTime=datetime.now() - timedelta(hours=24),
                    EndTime=datetime.now(),
                    Period=3600,
                    Statistics=['Sum']
                )
                metrics['api_requests_24h'] = sum([point['Sum'] for point in api_metrics['Datapoints']])
            except Exception as e:
                logger.warning(f"Failed to get API Gateway metrics: {str(e)}")
                metrics['api_requests_24h'] = 0
            
            return {
                'status': 'success',
                'metrics': metrics,
                'timestamp': datetime.now().isoformat(),
                'tenant': tenant_code
            }
            
        except Exception as e:
            logger.error(f"System metrics error: {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
