/* eslint-disable no-console */
import { getCurrentInvoke } from '@codegenie/serverless-express'
import { ConsoleLogger, LogLevel } from '@nestjs/common'

import { getUserContext } from '../context/user.context'
import { Environment } from '../env.validation'

export type AppLogLevel =
  | 'verbose' // The most fine-grained information used to trace the path of your code's execution
  | 'debug' // Detailed information for system debugging
  | 'info' // Messages that record the normal operation of your function
  | 'warn' // Messages about potential errors that may lead to unexpected behavior if unaddressed
  | 'error' // Messages about problems that prevent the code from performing as expected
  | 'fatal' // Messages about serious errors that cause the application to stop functioning

export class RequestLogger extends ConsoleLogger {
  private readonly isLocal: boolean = process.env.NODE_ENV === Environment.Local

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
    const { event, context } = getCurrentInvoke()
    const userContext = getUserContext(event)
    const requestId = context?.awsRequestId || undefined
    const ip = event?.requestContext?.http?.sourceIp || undefined
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
