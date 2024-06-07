import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

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

  async sendEmail(msg: EmailNotification) {
    return await this[CLIENT_INSTANCE].send(
      new SendEmailCommand({
        FromEmailAddress: msg.fromAddr || this.config.get('SES_FROM_EMAIL'),
        Destination: {
          ToAddresses: msg.toAddrs,
          CcAddresses: msg.ccAddrs,
          BccAddresses: msg.bccAddrs,
        },
        Content: {
          Simple: {
            Subject: { Data: msg.subject },
            Body: { Html: { Data: msg.body } },
          },
        },
      }),
    )
  }
}
