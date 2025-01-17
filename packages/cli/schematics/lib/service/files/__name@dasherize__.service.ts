import { CommandService, DataService } from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class <%= classify(name) %>Service {
  private readonly logger = new Logger(<%= classify(name) %>Service.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}
}
