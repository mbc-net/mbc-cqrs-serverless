import { Test, TestingModule } from '@nestjs/testing'
import { IMockClassEvent, MockEventHandler } from './mocks/event-handler.mock'
import {
  IMockOtherClassEvent,
  MockOtherEventHandler,
} from './mocks/other-event-handler.mock'
import { EventBus } from './event-bus'

describe('EventBus', () => {
  let eventBus: EventBus

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBus, MockEventHandler, MockOtherEventHandler],
    }).compile()

    eventBus = module.get<EventBus>(EventBus)
  })

  it('should execute event correctly', async () => {
    // Arrange

    eventBus.register([MockEventHandler])
    // Action
    const result = await eventBus.execute(
      new IMockClassEvent({ source: 'test' }),
    )
    console.log(result)

    // Assert
    expect(result.length).toEqual(1)
    expect(result.at(0)).toContain('[MockEventHandler]::: executing event:')
  })

  it('should throw not found error', async () => {
    // Arrange
    eventBus.register([MockEventHandler])

    // Action & Assert
    try {
      await eventBus.execute(new IMockOtherClassEvent({ source: 'test' }))
    } catch (error) {
      expect((error as any).message).toMatch(
        /The event handler for the "[A-Z0-9]+" event was not found!/,
      )
    }
  })
})
