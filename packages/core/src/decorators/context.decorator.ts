import { getCurrentInvoke } from '@codegenie/serverless-express'
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'

import { IS_LAMBDA_RUNNING } from '../helpers'

export const CONTEXT = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    if (IS_LAMBDA_RUNNING) {
      return getCurrentInvoke()
    }
    const request = ctx.switchToHttp().getRequest<Request>()
    return request.get('authorization')
  },
)
