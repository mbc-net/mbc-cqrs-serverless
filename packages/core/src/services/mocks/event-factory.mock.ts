import { Logger } from '@nestjs/common'

import { EventFactory } from '../../decorators'

@EventFactory()
export class MockEventFactory {
  private readonly logger = new Logger(MockEventFactory.name)
}
