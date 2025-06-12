import { Module } from '@nestjs/common'
import { McpController } from './controllers/mcp.controller'
import { ClaudeService } from './claude-integration/claude.service'
import { McpClientService } from './aws-services/mcp-client.service'

@Module({
  controllers: [McpController],
  providers: [ClaudeService, McpClientService],
  exports: [ClaudeService, McpClientService]
})
export class McpHostModule {}
