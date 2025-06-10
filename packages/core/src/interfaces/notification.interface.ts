export interface INotification {
  id: string
  table: string
  pk: string
  sk: string
  tenantCode: string
  action: string
  content?: object
}

export interface Attachment {
  filename: string
  content: Buffer
  contentType?: string
}

export interface EmailNotification {
  fromAddr?: string
  toAddrs: string[]
  ccAddrs?: string[]
  bccAddrs?: string[]
  subject: string
  body: string // html
  replyToAddrs?: string[]
  attachments?: Attachment[]
}
