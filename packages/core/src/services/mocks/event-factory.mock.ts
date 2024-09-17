import { EventFactory } from '@mbc-cqrs-severless/core'
import { Logger } from '@nestjs/common'

@EventFactory()
export class MockEventFactory {
  private readonly logger = new Logger(MockEventFactory.name)
}
