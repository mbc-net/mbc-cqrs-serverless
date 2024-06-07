export class EventSourceException extends Error {
  constructor(error: Error) {
    super(error.message)
  }
}
