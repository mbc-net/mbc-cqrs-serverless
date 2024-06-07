import { Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'

const logger = new Logger('Prisma')

export function prismaLoggingMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const before = Date.now()

    const result = await next(params)

    const after = Date.now()

    logger.debug(
      `Query ${params.model}.${params.action} took ${after - before}ms`,
    )

    return result
  }
}
