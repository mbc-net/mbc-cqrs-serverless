import { ConflictException, ServiceUnavailableException } from '@nestjs/common'

/** An admission check failed: the request must capture, reread and rebuild. */
export class CommandAdmissionRejectedException extends ConflictException {
  constructor(cause?: unknown) {
    super('Command admission rejected', { cause })
  }
}

/** The transaction lost a race and was not evaluated: it is safe to try again. */
export class CommandAdmissionContentionException extends ServiceUnavailableException {
  constructor(cause?: unknown) {
    super('Command admission contention; retry with a fresh read', { cause })
  }
}
