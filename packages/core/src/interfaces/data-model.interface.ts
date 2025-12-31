import { CommandModel } from './command-model.interface'

/**
 * Data model stored in the data (read) table.
 * Represents the current/projected state of an entity for queries.
 *
 * In CQRS, this is the read-side projection derived from command events.
 * Unlike CommandModel, DataModel stores only the latest state without version suffix.
 *
 * @example
 * Command table: pk='ORDER#123', sk='ITEM#A@3' (version 3)
 * Data table:    pk='ORDER#123', sk='ITEM#A' (current state)
 */
export interface DataModel extends Omit<CommandModel, 'status'> {
  /** Command partition key - references source command record */
  cpk?: string
  /** Command sort key with version - references exact command version */
  csk?: string
}
