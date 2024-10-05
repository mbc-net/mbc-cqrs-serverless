import { createHandler } from '@mbc-cqrs-sererless/core'

import { MainModule } from './main.module'

export const handler = createHandler({
  rootModule: MainModule,
})
