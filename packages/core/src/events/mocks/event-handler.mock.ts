import { EventHandler } from '../../decorators'
import { IEvent, IEventHandler } from '../../interfaces'

export class IMockClassEvent implements IEvent {
  source: string

  constructor(event?: Partial<IMockClassEvent>) {
    Object.assign(this, event)
  }
}

@EventHandler(IMockClassEvent)
export class MockEventHandler implements IEventHandler<IMockClassEvent> {
  async execute(event: IMockClassEvent): Promise<any> {
    return `[${MockEventHandler.name}]::: executing event: ${JSON.stringify(
      event,
    )}`
  }
}
