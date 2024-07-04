import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import { extractInvokeContext } from '../context'

export const INVOKE_CONTEXT = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return extractInvokeContext(ctx)
  },
)
