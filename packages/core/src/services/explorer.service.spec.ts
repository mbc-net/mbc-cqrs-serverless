import { Test, TestingModule } from '@nestjs/testing'
import { ExplorerService } from './explorer.service'
import { MockEventHandler } from './mocks/event-handler.mock'
import { MockEventFactory } from './mocks/event-factory.mock'

describe('ExplorerService', () => {
  describe('explore', () => {
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

    it('should discover event handler correctly', () => {
      // Action
      const result = explorerService.explore()

      // Assert
      expect(result.eventFactorys.length).toEqual(0)
      expect(result.events.length).toEqual(1)
      expect(new result.events[0]()).toBeInstanceOf(MockEventHandler)
    })
  })

  describe('explore', () => {
    let explorerService: ExplorerService

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [ExplorerService, MockEventFactory],
      }).compile()

      explorerService = module.get<ExplorerService>(ExplorerService)
    })

    it('should be defined', () => {
      expect(explorerService).toBeDefined()
    })

    it('should discover event factory correctly', () => {
      // Action
      const result = explorerService.explore()

      // Assert
      expect(result.events.length).toEqual(0)
      expect(result.eventFactorys.length).toEqual(1)
      expect(new result.eventFactorys[0]()).toBeInstanceOf(MockEventFactory)
    })
  })
})
