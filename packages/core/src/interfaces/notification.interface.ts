/**
 * Real-time notification payload for WebSocket/AppSync subscriptions.
 * Published when data changes occur in the system.
 */
export interface INotification {
  /** Unique notification ID */
  id: string
  /** Source DynamoDB table name */
  table: string
  /** Partition key of the changed item */
  pk: string
  /** Sort key of the changed item */
  sk: string
  /** Tenant code for filtering notifications */
  tenantCode: string
  /** Type of change: 'INSERT', 'MODIFY', 'REMOVE' */
  action: string
  /** Optional payload with changed data */
  content?: object
}

/**
 * Email attachment for SES notifications.
 */
export interface Attachment {
  /** Filename shown to recipient */
  filename: string
  /** File content as Buffer */
  content: Buffer
  /** MIME type (e.g., 'application/pdf') */
  contentType?: string
}

/**
 * Email notification configuration for SES.
 * Used by NotificationService to send emails.
 */
export interface EmailNotification {
  /** Sender email address (uses default if not specified) */
  fromAddr?: string
  /** List of recipient email addresses */
  toAddrs: string[]
  /** Optional CC recipients */
  ccAddrs?: string[]
  /** Optional BCC recipients */
  bccAddrs?: string[]
  /** Email subject line */
  subject: string
  /** Email body as HTML */
  body: string
  /** Optional reply-to addresses */
  replyToAddrs?: string[]
  /** Optional file attachments */
  attachments?: Attachment[]
}
