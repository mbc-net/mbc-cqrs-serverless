import { Test, TestingModule } from '@nestjs/testing'
import { ExplorerService } from './explorer.service'
import { MockEventHandler } from './mocks/event.handler.mock'

describe('ExplorerService', () => {
  let explorerService: ExplorerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExplorerService, MockEventHandler],
    }).compile()

    explorerService = module.get<ExplorerService>(ExplorerService)
  })

  it('should be defined', () => {
    expect(explorerService).toBeDefined()
  })

  it('should discover event factory and event handler correctly', () => {
    // Action
    const result = explorerService.explore()

    // Assert
    expect(result.eventFactorys.length).toEqual(0)
    expect(result.events.length).toEqual(1)
    expect(new result.events[0]()).toBeInstanceOf(MockEventHandler)
  })
})
