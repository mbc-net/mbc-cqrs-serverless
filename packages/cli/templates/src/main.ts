import { createHandler } from '@mbc-cqrs-severless/core'

import { MainModule } from './main.module'

export const handler = createHandler({
  rootModule: MainModule,
})
