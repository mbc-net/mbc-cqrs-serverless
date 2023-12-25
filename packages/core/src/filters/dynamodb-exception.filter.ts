import {
  ConditionalCheckFailedException,
  DynamoDBServiceException,
} from '@aws-sdk/client-dynamodb'
import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Response } from 'express'

@Catch(DynamoDBServiceException)
export class DynamoDBExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DynamoDBExceptionFilter.name)

  catch(exception: DynamoDBServiceException, host: ArgumentsHost) {
    this.logger.error(exception)
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof ConditionalCheckFailedException) {
      return this.catchUniqueConstraint(exception, response)
    }

    this.unhandledException(exception, host)
  }

  catchUniqueConstraint(
    exception: ConditionalCheckFailedException,
    response: Response,
  ) {
    const status = HttpStatus.CONFLICT
    response.status(status).json({
      statusCode: status,
      message: this.cleanUpException(exception),
    })
  }

  catchValueTooLong(exception: DynamoDBServiceException, response: Response) {
    const status = HttpStatus.BAD_REQUEST
    response.status(status).json({
      statusCode: status,
      message: this.cleanUpException(exception),
    })
  }

  catchNotFound(exception: DynamoDBServiceException, response: Response) {
    const status = HttpStatus.NOT_FOUND
    response.status(status).json({
      statusCode: status,
      message: this.cleanUpException(exception),
    })
  }

  unhandledException(exception: DynamoDBServiceException, host: ArgumentsHost) {
    // default 500 error code
    super.catch(exception, host)
  }

  /**
   *
   * @param exception
   * @returns replace line breaks with empty string
   */
  cleanUpException(exception: DynamoDBServiceException): string {
    return exception.toString().replace(/\n/g, '')
  }
}
