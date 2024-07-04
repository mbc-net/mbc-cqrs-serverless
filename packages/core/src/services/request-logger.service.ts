/* eslint-disable no-console */
import { ConsoleLogger, LogLevel } from '@nestjs/common'

import { extractInvokeContext } from '../context'
import { getUserContext } from '../context/user'
import { Environment } from '../env.validation'
import { IS_LAMBDA_RUNNING } from '../helpers'

export type AppLogLevel =
  | 'verbose' // The most fine-grained information used to trace the path of your code's execution
  | 'debug' // Detailed information for system debugging
  | 'info' // Messages that record the normal operation of your function
  | 'warn' // Messages about potential errors that may lead to unexpected behavior if unaddressed
  | 'error' // Messages about problems that prevent the code from performing as expected
  | 'fatal' // Messages about serious errors that cause the application to stop functioning

export class RequestLogger extends ConsoleLogger {
  private readonly isLocal: boolean =
    process.env.NODE_ENV === Environment.Local || !IS_LAMBDA_RUNNING

  protected printStackTrace(stack: string) {
    if (this.isLocal) {
      return super.printStackTrace(stack)
    }

    // lambda function
    if (!stack) {
      return
    }
    console.error(stack)
  }

  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
  ) {
    if (
      context === 'InstanceLoader' ||
      context == 'RoutesResolver' ||
      context == 'RouterExplorer'
    ) {
      return
    }
    if (this.isLocal) {
      return super.printMessages(messages, context, logLevel, writeStreamType)
    }

    // lambda function
    const contextMessage = this.getLambdaContextMessage(context)
    const logFunc = logFuncMaper[logLevel]
    for (const message of messages) {
      if (!message) {
        continue
      }
      logFunc({ ...contextMessage, message })
    }
  }

  protected getLambdaContextMessage(contextMessage?: string) {
    const ctx = extractInvokeContext()
    const userContext = getUserContext(ctx)
    const requestId = ctx?.context?.awsRequestId || undefined
    const ip = ctx?.event?.requestContext?.http?.sourceIp || undefined
    const tenantCode = userContext.tenantCode || undefined
    const userId = userContext.userId || undefined

    return {
      context: contextMessage,
      requestId,
      ip,
      tenantCode,
      userId,
    }
  }
}

const logFuncMaper = {
  verbose: console.trace,
  debug: console.debug,
  log: console.info,
  warn: console.warn,
  error: console.error,
  fatal: console.error,
}

export function getLogLevels(level: AppLogLevel): LogLevel[] {
  const levels: LogLevel[] = [
    'verbose',
    'debug',
    'log',
    'warn',
    'error',
    'fatal',
  ]
  const start =
    level === 'debug'
      ? 1
      : level === 'info'
        ? 2
        : level === 'warn'
          ? 3
          : level === 'error'
            ? 4
            : level === 'fatal'
              ? 5
              : 0
  return levels.slice(start)
}
