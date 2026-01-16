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

/**
 * Configuration for SES Inline Templates.
 * The subject and body are defined here rather than in the AWS Console.
 */
export interface InlineTemplateContent {
  /** The subject line, can include tags like {{name}} */
  subject: string
  /** The HTML body, can include tags like {{name}} */
  html: string
  /** Optional plain text body for clients that don't render HTML */
  text?: string
}

/**
 * Notification payload for sending emails via Inline Templates.
 */
export interface TemplatedEmailNotification {
  /** Sender email address (uses default if not specified) */
  fromAddr?: string
  /** List of recipient email addresses */
  toAddrs: string[]
  /** Optional CC recipients */
  ccAddrs?: string[]
  /** Optional BCC recipients */
  bccAddrs?: string[]
  /** Optional reply-to addresses */
  replyToAddrs?: string[]
  /** The template structure (Subject, HTML, Text) */
  template: InlineTemplateContent
  /** The actual data to inject into the template variables. e.g. { name: "Alex", verificationCode: "12345" } */
  data: Record<string, any>
  /** Optional configuration set name to handle open/click tracking events */
  configurationSetName?: string
}
