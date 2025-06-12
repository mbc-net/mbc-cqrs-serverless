import { Test, TestingModule } from '@nestjs/testing'
import { ClaudeService } from '../src/claude-integration/claude.service'
import axios from 'axios'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('ClaudeService', () => {
  let service: ClaudeService

  beforeEach(async () => {
    process.env.CLAUDE_API_KEY = 'test-api-key'
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClaudeService]
    }).compile()

    service = module.get<ClaudeService>(ClaudeService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should throw error if CLAUDE_API_KEY is not set', () => {
    delete process.env.CLAUDE_API_KEY
    
    expect(() => {
      new ClaudeService()
    }).toThrow('CLAUDE_API_KEY environment variable is required')
  })

  describe('processNaturalLanguageQuery', () => {
    it('should process simple text response', async () => {
      const mockResponse = {
        data: {
          content: [
            {
              type: 'text',
              text: 'システムは正常に動作しています。'
            }
          ]
        }
      }

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse)
      } as any)

      const result = await service.processNaturalLanguageQuery(
        'システムの状況を教えて',
        'test-tenant'
      )

      expect(result.response).toBe('システムは正常に動作しています。')
      expect(result.toolsUsed).toEqual([])
    })
  })
})
