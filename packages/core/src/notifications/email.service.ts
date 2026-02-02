import {
  SendEmailCommand,
  SendEmailCommandOutput,
  SESv2Client,
} from '@aws-sdk/client-sesv2'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import nodemailer from 'nodemailer'

import { EmailNotification, TemplatedEmailNotification } from '../interfaces'

const CLIENT_INSTANCE = Symbol()

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly [CLIENT_INSTANCE]: SESv2Client

  constructor(private readonly config: ConfigService) {
    this[CLIENT_INSTANCE] = new SESv2Client({
      endpoint: config.get<string>('SES_ENDPOINT'),
      region: config.get<string>('SES_REGION'),
    })
  }

  async sendEmail(msg: EmailNotification): Promise<any> {
    try {
      const fromAddress = msg.fromAddr || this.config.get('SES_FROM_EMAIL')
      const destination = {
        ToAddresses: msg.toAddrs,
        CcAddresses: msg.ccAddrs,
        BccAddresses: msg.bccAddrs,
      }

      const emailTags = msg.emailTags?.map((tag) => ({
        Name: tag.name,
        Value: tag.value,
      }))

      if (!msg.attachments || msg.attachments.length === 0) {
        this.logger.log(`Sending simple email to ${msg.toAddrs.join(', ')}`)

        const command = new SendEmailCommand({
          FromEmailAddress: fromAddress,
          Destination: destination,
          Content: {
            Simple: {
              Subject: { Data: msg.subject },
              Body: { Html: { Data: msg.body } },
            },
          },
          ReplyToAddresses: msg.replyToAddrs,
          EmailTags: emailTags,
        })

        const result = await this[CLIENT_INSTANCE].send(command)
        return result
      }

      this.logger.log(
        `Sending raw email with attachments to ${msg.toAddrs.join(', ')}`,
      )

      const transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })
      const mailOptions: nodemailer.SendMailOptions = {
        from: fromAddress,
        to: msg.toAddrs,
        cc: msg.ccAddrs,
        bcc: msg.bccAddrs,
        replyTo: msg.replyToAddrs,
        subject: msg.subject,
        html: msg.body,
        attachments:
          msg.attachments as nodemailer.SendMailOptions['attachments'],
      }

      const emailBuffer = await new Promise<Buffer>((resolve, reject) => {
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) return reject(err)
          resolve(info.message as Buffer)
        })
      })

      const command = new SendEmailCommand({
        Destination: destination,
        Content: {
          Raw: { Data: emailBuffer },
        },
        EmailTags: emailTags,
      })

      const result = await this[CLIENT_INSTANCE].send(command)
      return result
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${msg.toAddrs.join(', ')}`,
        (error as Error).stack,
      )
      throw error
    }
  }

  /**
   * Sends an email using SES v2 Inline Templates.
   * @remarks
   * Supports a hybrid mode for local development:
   * - PRODUCTION: Uses AWS SES Native Inline Templates.
   * - OFFLINE/LOCAL: Falls back to 'Simple' email with manual variable substitution
   * to bypass limitations of local emulators (like serverless-offline-ses-v2).
   */
  async sendInlineTemplateEmail(
    msg: TemplatedEmailNotification,
  ): Promise<SendEmailCommandOutput | undefined> {
    // 1. Validation: Fail early if no recipients
    if (!msg.toAddrs.length && !msg.ccAddrs?.length && !msg.bccAddrs?.length) {
      this.logger.warn('Email skipped: No recipients provided.')
      return
    }

    try {
      const fromAddress =
        msg.fromAddr || this.config.get<string>('SES_FROM_EMAIL')
      const isOffline =
        process.env.IS_OFFLINE === 'true' || process.env.IS_OFFLINE === '1'

      // 2. Privacy-safe logging
      this.logger.log(
        `Sending inline template email to ${msg.toAddrs.length} recipient(s). Mode: ${isOffline ? 'LOCAL_EMULATION' : 'AWS_NATIVE'}`,
      )

      let contentPayload: any

      if (isOffline) {
        // --- LOCAL FALLBACK LOGIC ---
        this.logger.warn(
          '⚠️ IS_OFFLINE detected: Switching to manual template compilation for local testing.',
        )

        // Helper to access deep properties (e.g., "user.profile.name" or "認証コード")
        const getDeepValue = (obj: any, path: string) => {
          return path.split('.').reduce((acc, part) => acc && acc[part], obj)
        }

        const replaceVariables = (text: string, data: any) => {
          if (!text) return ''

          // Regex Explanation: /\{\{([^}]{1,255})\}\}/g
          // 1. [^}]: Matches any character that is NOT a closing curly brace.
          // 2. {1,255}: Limits length to prevent ReDoS.
          return text.replace(/\{\{([^}]{1,255})\}\}/g, (_, expression) => {
            const key = expression.trim() // Remove spaces (e.g. {{ code }} -> code)
            const value = getDeepValue(data || {}, key)

            // AWS SES behavior: If the value is missing, the tag remains in the output
            // or is handled by the template engine. We'll keep the original tag here.
            return value !== undefined ? String(value) : `{{${expression}}}`
          })
        }

        const emailTags = msg.emailTags?.map((tag) => ({
          Name: tag.name,
          Value: tag.value,
        }))

        contentPayload = {
          Simple: {
            Subject: { Data: replaceVariables(msg.template.subject, msg.data) },
            Body: {
              Html: { Data: replaceVariables(msg.template.html, msg.data) },
              Text: msg.template.text
                ? { Data: replaceVariables(msg.template.text, msg.data) }
                : undefined,
            },
          },
          EmailTags: emailTags,
        }
      } else {
        // --- PRODUCTION AWS LOGIC ---
        // Use native SES v2 Inline Template features
        contentPayload = {
          Template: {
            TemplateContent: {
              Subject: msg.template.subject,
              Html: msg.template.html,
              ...(msg.template.text && { Text: msg.template.text }),
            },
            // Ensure data is valid JSON string
            TemplateData: JSON.stringify(msg.data || {}),
          },
        }
      }

      const emailTags = msg.emailTags?.map((tag) => ({
        Name: tag.name,
        Value: tag.value,
      }))

      const command = new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: msg.toAddrs,
          CcAddresses: msg.ccAddrs,
          BccAddresses: msg.bccAddrs,
        },
        ReplyToAddresses: msg.replyToAddrs,
        ConfigurationSetName: msg.configurationSetName,
        Content: contentPayload,
        EmailTags: emailTags,
      })

      const result = await this[CLIENT_INSTANCE].send(command)

      this.logger.log(`Template email sent successfully: ${result.MessageId}`)
      return result
    } catch (error) {
      this.logger.error(
        `Failed to send inline template email. 
         ConfigSet: ${msg.configurationSetName || 'None'} 
         Recipients (Count): ${msg.toAddrs.length}`,
        (error as Error).stack,
      )
      throw error
    }
  }
}
