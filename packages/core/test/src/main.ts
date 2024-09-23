import { createHandler } from '../../src'
import { MainModule } from './main.module'

export const handler = createHandler({
  rootModule: MainModule,
})
