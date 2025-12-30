import { CommandInputModel } from './command-input-model.interface'

/**
 * Complete command model stored in the command (write) table.
 * Extends CommandInputModel with audit fields and processing metadata.
 *
 * This represents a single versioned command record in event sourcing.
 * Each command creates a new version with sk format: {baseSk}@{version}
 */
export interface CommandModel extends CommandInputModel {
  /** Processing status (e.g., 'PENDING', 'COMPLETED', 'FAILED') */
  status?: string
  /** Event source identifier (e.g., 'POST /api/master', 'SQS') */
  source?: string
  /** Unique request ID for tracing and idempotency */
  requestId?: string
  /** Timestamp when the command was created */
  createdAt?: Date
  /** Timestamp when the command was last updated */
  updatedAt?: Date
  /** User ID who created the command */
  createdBy?: string
  /** User ID who last updated the command */
  updatedBy?: string
  /** IP address of the creator */
  createdIp?: string
  /** IP address of the last updater */
  updatedIp?: string
  /** Step Functions task token for async workflows */
  taskToken?: string
}
