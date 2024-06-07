import { Catch } from '@nestjs/common'
import { ExternalExceptionFilter } from '@nestjs/core/exceptions/external-exception-filter'

// import { Response } from 'express'
import { EventSourceException } from '../exceptions'

@Catch(EventSourceException)
export class EventSourceExceptionFilter extends ExternalExceptionFilter<EventSourceException> {}
// export class EventSourceExceptionFilter extends BaseExceptionFilter {
//   private readonly logger = new Logger(EventSourceExceptionFilter.name)

//   catch(exception: EventSourceException, host: ArgumentsHost) {
//     this.logger.error(exception)
//     const ctx = host.switchToHttp()
//     const response = ctx.getResponse<Response>()

//     response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(exception.message)
//   }

//   cleanUpException(exception: EventSourceException): string {
//     return exception.toString().replace(/\n/g, '')
//   }
// }
