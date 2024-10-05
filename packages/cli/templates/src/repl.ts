/* eslint-disable no-console */
import { repl } from '@nestjs/core'
import { AppModule } from '@mbc-cqrs-serverless/core'

import { MainModule } from './main.module'

async function bootstrap() {
  const replServer = await repl(
    AppModule.forRoot({
      rootModule: MainModule,
    }),
  )
  replServer.setupHistory('.nestjs_repl_history', (err) => {
    if (err) {
      console.error(err)
    }
  })
}
bootstrap()

// npm run start -- --watch --entryFile repl
