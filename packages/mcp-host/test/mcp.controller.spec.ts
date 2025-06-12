import { Test, TestingModule } from '@nestjs/testing'
import { McpController } from '../src/controllers/mcp.controller'
import { ClaudeService } from '../src/claude-integration/claude.service'
import { McpClientService } from '../src/aws-services/mcp-client.service'

describe('McpController', () => {
  let controller: McpController
  let claudeService: ClaudeService
  let mcpClientService: McpClientService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        {
          provide: ClaudeService,
          useValue: {
            processNaturalLanguageQuery: jest.fn()
          }
        },
        {
          provide: McpClientService,
          useValue: {
            queryCloudWatchLogs: jest.fn(),
            queryRdsData: jest.fn(),
            queryDynamoDbData: jest.fn(),
            getSystemMetrics: jest.fn(),
            healthCheck: jest.fn(),
            getServerInfo: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<McpController>(McpController)
    claudeService = module.get<ClaudeService>(ClaudeService)
    mcpClientService = module.get<McpClientService>(McpClientService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('processChat', () => {
    it('should process chat request successfully', async () => {
      const mockResult = {
        response: 'システムは正常に動作しています',
        toolsUsed: ['system_metrics'],
        mcpCalls: [],
        processingTime: 1000
      }

      jest.spyOn(claudeService, 'processNaturalLanguageQuery').mockResolvedValue(mockResult)

      const result = await controller.processChat({
        message: 'システムの状況を教えて',
        tenantCode: 'test-tenant'
      })

      expect(result.status).toBe('success')
      expect(result.data?.response).toBe('システムは正常に動作しています')
    })
  })

  describe('healthCheck', () => {
    it('should return health status', async () => {
      jest.spyOn(mcpClientService, 'healthCheck').mockResolvedValue(true)
      jest.spyOn(mcpClientService, 'getServerInfo').mockResolvedValue({
        name: 'MCP Server',
        version: '1.0.0'
      })

      const result = await controller.healthCheck()

      expect(result.status).toBe('success')
      expect(result.data?.mcp_server_healthy).toBe(true)
    })
  })
})
