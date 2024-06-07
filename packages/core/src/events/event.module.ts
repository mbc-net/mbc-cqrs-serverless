import { Global, Logger, Module, OnApplicationBootstrap } from '@nestjs/common'

import { ExplorerService } from '../services'
import { EventController } from './event.controller'
import { EventService } from './event.services'
import { EventBus } from './event-bus'

@Global()
@Module({
  controllers: [EventController],
  providers: [EventBus, ExplorerService, EventService],
  exports: [EventBus, EventService],
})
export class EventModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventModule.name)

  constructor(
    private readonly explorerService: ExplorerService,
    private readonly eventBus: EventBus,
    private readonly eventService: EventService,
  ) {}

  onApplicationBootstrap() {
    const { events, eventFactorys } = this.explorerService.explore()
    if (events && events.length) {
      // this.logger.debug('register events')
      this.eventBus.register(events)
    }

    if (eventFactorys && eventFactorys.length) {
      // this.logger.debug('register event factorys')
      this.eventService.eventFactory = new eventFactorys[0]()
    }
  }
}
