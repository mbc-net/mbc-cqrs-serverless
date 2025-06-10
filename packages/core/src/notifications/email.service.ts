import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import nodemailer from 'nodemailer'

import { EmailNotification } from '../interfaces'

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
}
