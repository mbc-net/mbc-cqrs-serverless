/**
 * Base interface for domain events.
 * All events should implement this interface.
 */
export interface IEvent {
  /** Source identifier of the event */
  source: string
}
