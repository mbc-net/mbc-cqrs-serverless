import { createHandler } from '@mbc-cqrs-serverless/core'

import { MainModule } from './main.module'

export const handler = createHandler({
  rootModule: MainModule,
})
