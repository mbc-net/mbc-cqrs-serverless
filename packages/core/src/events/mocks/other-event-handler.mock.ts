import { EventHandler } from '../../decorators'
import { IEvent, IEventHandler } from '../../interfaces'

export class IMockOtherClassEvent implements IEvent {
  source: string

  constructor(event?: Partial<IMockOtherClassEvent>) {
    Object.assign(this, event)
  }
}

@EventHandler(IMockOtherClassEvent)
export class MockOtherEventHandler
  implements IEventHandler<IMockOtherClassEvent>
{
  async execute(event: IMockOtherClassEvent): Promise<any> {
    return `[${
      MockOtherEventHandler.name
    }]::: executing event: ${JSON.stringify(event)}`
  }
}
