import { EventHandler } from '../../decorators'
import { IEvent, IEventHandler } from '../../interfaces'

export class IMockClassEvent implements IEvent {
  source: string
}

@EventHandler(IMockClassEvent)
export class MockEventHandler implements IEventHandler<IMockClassEvent> {
  async execute(event: IMockClassEvent): Promise<any> {
    return event
  }
}
