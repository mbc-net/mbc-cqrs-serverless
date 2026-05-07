/**
 * AWS SESv2 Client Behavioral Tests
 *
 * These tests verify that @aws-sdk/client-sesv2 behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 *
 * SESv2 is used for sending emails (both simple and raw/templated).
 */

import {
  SendEmailCommand,
  SendEmailCommandInput,
  SESv2Client,
  SESv2ServiceException,
} from '@aws-sdk/client-sesv2'

describe('AWS SESv2 Client Behavioral Tests', () => {
  describe('Module exports', () => {
    it('should export SESv2Client class', () => {
      expect(SESv2Client).toBeDefined()
      expect(typeof SESv2Client).toBe('function')
    })

    it('should export SendEmailCommand class', () => {
      expect(SendEmailCommand).toBeDefined()
      expect(typeof SendEmailCommand).toBe('function')
    })

    it('should export SESv2ServiceException', () => {
      expect(SESv2ServiceException).toBeDefined()
    })
  })

  describe('Client instantiation', () => {
    it('should create client with default config', () => {
      const client = new SESv2Client({})
      expect(client).toBeInstanceOf(SESv2Client)
    })

    it('should create client with region config', () => {
      const client = new SESv2Client({
        region: 'ap-northeast-1',
      })
      expect(client).toBeInstanceOf(SESv2Client)
      expect(client.config.region).toBeDefined()
    })

    it('should create client with custom endpoint (for LocalStack)', () => {
      const client = new SESv2Client({
        endpoint: 'http://localhost:4566',
        region: 'us-east-1',
      })
      expect(client).toBeInstanceOf(SESv2Client)
    })

    it('should create client with credentials', () => {
      const client = new SESv2Client({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      })
      expect(client).toBeInstanceOf(SESv2Client)
    })
  })

  describe('SendEmailCommand input structure', () => {
    it('should create command with simple email content', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['recipient@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test Subject' },
            Body: {
              Html: { Data: '<p>Test HTML body</p>' },
            },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command).toBeInstanceOf(SendEmailCommand)
      expect(command.input).toEqual(input)
    })

    it('should create command with text body', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['recipient@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test Subject' },
            Body: {
              Text: { Data: 'Plain text body' },
            },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Simple?.Body?.Text?.Data).toBe(
        'Plain text body',
      )
    })

    it('should create command with both HTML and Text body', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['recipient@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test Subject' },
            Body: {
              Html: { Data: '<p>HTML version</p>' },
              Text: { Data: 'Text version' },
            },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Simple?.Body?.Html?.Data).toBe(
        '<p>HTML version</p>',
      )
      expect(command.input.Content?.Simple?.Body?.Text?.Data).toBe(
        'Text version',
      )
    })

    it('should create command with raw email content', () => {
      const rawEmailData = Buffer.from('MIME-Version: 1.0\r\nSubject: Test\r\n')

      const input: SendEmailCommandInput = {
        Destination: {
          ToAddresses: ['recipient@example.com'],
        },
        Content: {
          Raw: {
            Data: rawEmailData,
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Raw?.Data).toEqual(rawEmailData)
    })

    it('should create command with template content', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['recipient@example.com'],
        },
        Content: {
          Template: {
            TemplateContent: {
              Subject: 'Hello {{name}}',
              Html: '<p>Welcome, {{name}}!</p>',
              Text: 'Welcome, {{name}}!',
            },
            TemplateData: JSON.stringify({ name: 'John' }),
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Template?.TemplateData).toBe(
        '{"name":"John"}',
      )
    })
  })

  describe('Destination structure', () => {
    it('should accept single recipient', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['single@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Destination?.ToAddresses).toHaveLength(1)
    })

    it('should accept multiple To recipients', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['one@example.com', 'two@example.com', 'three@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Destination?.ToAddresses).toHaveLength(3)
    })

    it('should accept CC addresses', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
          CcAddresses: ['cc1@example.com', 'cc2@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Destination?.CcAddresses).toHaveLength(2)
    })

    it('should accept BCC addresses', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
          BccAddresses: ['bcc@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Destination?.BccAddresses).toHaveLength(1)
    })

    it('should accept empty optional address arrays', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
          CcAddresses: [],
          BccAddresses: [],
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Destination?.CcAddresses).toEqual([])
      expect(command.input.Destination?.BccAddresses).toEqual([])
    })

    it('should accept undefined optional address arrays', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
          // CcAddresses and BccAddresses are undefined
        },
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Destination?.CcAddresses).toBeUndefined()
      expect(command.input.Destination?.BccAddresses).toBeUndefined()
    })
  })

  describe('Optional fields', () => {
    it('should accept ReplyToAddresses', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        ReplyToAddresses: ['reply@example.com'],
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.ReplyToAddresses).toContain('reply@example.com')
    })

    it('should accept ConfigurationSetName', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        ConfigurationSetName: 'my-config-set',
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.ConfigurationSetName).toBe('my-config-set')
    })

    it('should accept FeedbackForwardingEmailAddress', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        FeedbackForwardingEmailAddress: 'bounce@example.com',
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.FeedbackForwardingEmailAddress).toBe(
        'bounce@example.com',
      )
    })

    it('should accept EmailTags', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        EmailTags: [
          { Name: 'campaign', Value: 'welcome' },
          { Name: 'user_type', Value: 'new' },
        ],
        Content: {
          Simple: {
            Subject: { Data: 'Test' },
            Body: { Text: { Data: 'Body' } },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.EmailTags).toHaveLength(2)
      expect(command.input.EmailTags?.[0].Name).toBe('campaign')
    })
  })

  describe('Content charset handling', () => {
    it('should accept charset specification', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'テスト件名', Charset: 'UTF-8' },
            Body: {
              Html: { Data: '<p>日本語本文</p>', Charset: 'UTF-8' },
              Text: { Data: '日本語本文', Charset: 'UTF-8' },
            },
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Simple?.Subject?.Charset).toBe('UTF-8')
      expect(command.input.Content?.Simple?.Body?.Html?.Charset).toBe('UTF-8')
    })

    it('should work without explicit charset (UTF-8 is default)', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        Content: {
          Simple: {
            Subject: { Data: 'テスト件名' },
            Body: {
              Html: { Data: '<p>日本語本文</p>' },
            },
          },
        },
      }

      const command = new SendEmailCommand(input)
      // No charset specified - SDK should use UTF-8 by default
      expect(command.input.Content?.Simple?.Subject?.Charset).toBeUndefined()
    })
  })

  describe('Template content structure', () => {
    it('should accept inline template with all fields', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        Content: {
          Template: {
            TemplateContent: {
              Subject: 'Welcome, {{name}}!',
              Html: '<h1>Hello {{name}}</h1><p>Your code: {{code}}</p>',
              Text: 'Hello {{name}}. Your code: {{code}}',
            },
            TemplateData: JSON.stringify({
              name: 'John',
              code: '123456',
            }),
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Template?.TemplateContent?.Subject).toContain(
        '{{name}}',
      )
    })

    it('should accept template with named template ARN', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        Content: {
          Template: {
            TemplateArn:
              'arn:aws:ses:us-east-1:123456789012:template/MyTemplate',
            TemplateData: JSON.stringify({ name: 'John' }),
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Template?.TemplateArn).toContain(
        'MyTemplate',
      )
    })

    it('should accept template with template name', () => {
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'sender@example.com',
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        Content: {
          Template: {
            TemplateName: 'WelcomeEmail',
            TemplateData: JSON.stringify({ name: 'John' }),
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Template?.TemplateName).toBe('WelcomeEmail')
    })
  })

  describe('Raw email for attachments', () => {
    it('should accept Uint8Array for raw data', () => {
      const rawData = new Uint8Array([77, 73, 77, 69]) // "MIME"

      const input: SendEmailCommandInput = {
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        Content: {
          Raw: {
            Data: rawData,
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Raw?.Data).toBeInstanceOf(Uint8Array)
    })

    it('should accept Buffer for raw data', () => {
      const rawData = Buffer.from(
        'From: sender@example.com\r\nTo: to@example.com\r\n',
      )

      const input: SendEmailCommandInput = {
        Destination: {
          ToAddresses: ['to@example.com'],
        },
        Content: {
          Raw: {
            Data: rawData,
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command.input.Content?.Raw?.Data).toBeDefined()
    })
  })

  describe('Real-world usage patterns', () => {
    it('should match EmailService simple email pattern', () => {
      // This mirrors the exact structure used in EmailService.sendEmail
      const fromAddress = 'noreply@example.com'
      const destination = {
        ToAddresses: ['user@example.com'],
        CcAddresses: undefined,
        BccAddresses: undefined,
      }

      const input: SendEmailCommandInput = {
        FromEmailAddress: fromAddress,
        Destination: destination,
        Content: {
          Simple: {
            Subject: { Data: 'Test Subject' },
            Body: { Html: { Data: '<p>Test body</p>' } },
          },
        },
        ReplyToAddresses: undefined,
      }

      const command = new SendEmailCommand(input)
      expect(command).toBeInstanceOf(SendEmailCommand)
      expect(command.input.FromEmailAddress).toBe(fromAddress)
    })

    it('should match EmailService raw email pattern', () => {
      // This mirrors the raw email structure for attachments
      const destination = {
        ToAddresses: ['user@example.com'],
        CcAddresses: ['cc@example.com'],
        BccAddresses: ['bcc@example.com'],
      }
      const emailBuffer = Buffer.from('MIME email content...')

      const input: SendEmailCommandInput = {
        Destination: destination,
        Content: {
          Raw: { Data: emailBuffer },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command).toBeInstanceOf(SendEmailCommand)
      expect(command.input.Content?.Raw?.Data).toBe(emailBuffer)
    })

    it('should match EmailService inline template pattern', () => {
      // This mirrors the inline template email structure
      const input: SendEmailCommandInput = {
        FromEmailAddress: 'noreply@example.com',
        Destination: {
          ToAddresses: ['user@example.com'],
          CcAddresses: [],
          BccAddresses: [],
        },
        ReplyToAddresses: ['support@example.com'],
        ConfigurationSetName: 'default-config',
        Content: {
          Template: {
            TemplateContent: {
              Subject: 'Your verification code: {{code}}',
              Html: '<p>Your code is: <strong>{{code}}</strong></p>',
              Text: 'Your code is: {{code}}',
            },
            TemplateData: JSON.stringify({ code: '123456' }),
          },
        },
      }

      const command = new SendEmailCommand(input)
      expect(command).toBeInstanceOf(SendEmailCommand)
      expect(command.input.ConfigurationSetName).toBe('default-config')
    })
  })
})
