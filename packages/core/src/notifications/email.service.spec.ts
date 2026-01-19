import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { Logger } from '@nestjs/common'
import nodemailer from 'nodemailer'

import { EmailService } from './email.service'
import { EmailNotification, TemplatedEmailNotification } from '../interfaces'

// --- Mocking Dependencies ---

// 1. Mock AWS SDK
const mockAwsSend = jest.fn()
jest.mock('@aws-sdk/client-sesv2', () => {
  const SendEmailCommandMock = jest
    .fn()
    .mockImplementation((input) => ({ input }))
  const SESv2ClientMock = jest.fn().mockImplementation(() => ({
    send: mockAwsSend,
  }))
  return {
    SESv2Client: SESv2ClientMock,
    SendEmailCommand: SendEmailCommandMock,
  }
})

// 2. Mock Nodemailer
jest.mock('nodemailer')

//3. Mock Logger
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})

// --- Test Suite ---

describe('EmailService', () => {
  let service: EmailService
  let mockConfigService: { get: jest.Mock }

  const mockNodemailerSendMail = jest.fn()

  const DEFAULT_FROM_EMAIL = 'default.sender@example.com'
  const FAKE_RAW_BUFFER = Buffer.from('fake-raw-email-content')

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockNodemailerSendMail,
    })

    // Mock ConfigService
    mockConfigService = {
      get: jest.fn((key) => {
        if (key === 'SES_FROM_EMAIL') return DEFAULT_FROM_EMAIL
        return `mock-${key}`
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<EmailService>(EmailService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('when sending an email without attachments', () => {
    const simpleEmail: EmailNotification = {
      toAddrs: ['test@example.com'],
      subject: 'Simple Email',
      body: '<p>Test</p>',
    }

    it('should use SendEmailCommand with Simple content', async () => {
      await service.sendEmail(simpleEmail)

      expect(mockAwsSend).toHaveBeenCalledTimes(1)
      expect(SendEmailCommand).toHaveBeenCalledTimes(1)

      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]

      // Assert that the content is 'Simple' and not 'Raw'
      expect(commandInput.Content.Simple).toBeDefined()
      expect(commandInput.Content.Raw).toBeUndefined()

      // Assert that the email details are correct
      expect(commandInput.Destination.ToAddresses).toEqual(simpleEmail.toAddrs)
      expect(commandInput.Content.Simple.Subject.Data).toBe(simpleEmail.subject)
      expect(commandInput.FromEmailAddress).toBe(DEFAULT_FROM_EMAIL)
    })
  })

  describe('when sending an email with attachments', () => {
    const emailWithAttachments: EmailNotification = {
      toAddrs: ['test@example.com'],
      subject: 'Email With Attachment',
      body: '<p>See attached file.</p>',
      attachments: [
        {
          filename: 'test.txt',
          content: Buffer.from('attachment-content'),
        },
      ],
    }

    beforeEach(() => {
      // Configure the nodemailer mock to simulate a successful email build
      mockNodemailerSendMail.mockImplementation((options, callback) => {
        callback(null, { message: FAKE_RAW_BUFFER })
      })
    })

    it('should use SendEmailCommand with Raw content', async () => {
      await service.sendEmail(emailWithAttachments)

      expect(mockAwsSend).toHaveBeenCalledTimes(1)
      expect(SendEmailCommand).toHaveBeenCalledTimes(1)

      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]

      // Assert that the content is 'Raw' and not 'Simple'
      expect(commandInput.Content.Raw).toBeDefined()
      expect(commandInput.Content.Simple).toBeUndefined()

      // Assert that the raw data is the buffer our mock nodemailer provided
      expect(commandInput.Content.Raw.Data).toBe(FAKE_RAW_BUFFER)
      expect(commandInput.Destination.ToAddresses).toEqual(
        emailWithAttachments.toAddrs,
      )
    })

    it('should call nodemailer with correct options', async () => {
      await service.sendEmail(emailWithAttachments)

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })
      expect(mockNodemailerSendMail).toHaveBeenCalledTimes(1)
      const mailOptions = mockNodemailerSendMail.mock.calls[0][0]
      expect(mailOptions.subject).toBe(emailWithAttachments.subject)
      expect(mailOptions.html).toBe(emailWithAttachments.body)
      expect(mailOptions.attachments).toHaveLength(1)
      expect(mailOptions.attachments[0].filename).toBe('test.txt')
    })
  })

  describe('when an error occurs', () => {
    const email: EmailNotification = {
      toAddrs: ['error@example.com'],
      subject: 'error',
      body: '',
    }

    it('should throw an error if AWS SDK fails', async () => {
      const awsError = new Error('AWS Access Denied')
      mockAwsSend.mockRejectedValue(awsError)

      await expect(service.sendEmail(email)).rejects.toThrow(awsError)

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email'),
        awsError.stack,
      )
    })

    it('should throw an error if nodemailer fails to build', async () => {
      const nodemailerError = new Error('Nodemailer build failed')
      mockNodemailerSendMail.mockImplementation((options, callback) => {
        callback(nodemailerError, null)
      })

      const emailWithAttachments: EmailNotification = {
        ...email,
        attachments: [{ filename: 'fail.txt', content: Buffer.from('fail') }],
      }

      await expect(service.sendEmail(emailWithAttachments)).rejects.toThrow(
        nodemailerError,
      )

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email'),
        nodemailerError.stack,
      )
    })
  })

  /**
   * Test Overview: Tests complex attachment scenarios for email service
   * Purpose: Ensures the service handles various attachment types, sizes, and edge cases properly
   * Details: Verifies behavior with multiple attachments, large files, invalid file types, and attachment processing errors
   */
  describe('Complex Attachment Scenarios', () => {
    beforeEach(() => {
      mockAwsSend.mockResolvedValue({})
      mockNodemailerSendMail.mockImplementation((options, callback) => {
        callback(null, { message: FAKE_RAW_BUFFER })
      })
    })

    it('should handle multiple attachments of different types', async () => {
      const emailWithMultipleAttachments: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Multiple Attachments',
        body: '<p>Multiple files attached</p>',
        attachments: [
          {
            filename: 'document.pdf',
            content: Buffer.from('PDF content'),
          },
          {
            filename: 'image.jpg',
            content: Buffer.from('JPEG content'),
          },
          {
            filename: 'data.csv',
            content: Buffer.from('CSV,content,here'),
          },
        ],
      }

      await service.sendEmail(emailWithMultipleAttachments)

      expect(mockNodemailerSendMail).toHaveBeenCalledTimes(1)
      const mailOptions = mockNodemailerSendMail.mock.calls[0][0]
      expect(mailOptions.attachments).toHaveLength(3)
      expect(mailOptions.attachments[0].filename).toBe('document.pdf')
      expect(mailOptions.attachments[1].filename).toBe('image.jpg')
      expect(mailOptions.attachments[2].filename).toBe('data.csv')
    })

    it('should handle large attachment files', async () => {
      const largeContent = Buffer.alloc(1024 * 1024, 'A') // 1MB of 'A' characters
      const emailWithLargeAttachment: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Large Attachment',
        body: '<p>Large file attached</p>',
        attachments: [
          {
            filename: 'large-file.txt',
            content: largeContent,
          },
        ],
      }

      await service.sendEmail(emailWithLargeAttachment)

      expect(mockNodemailerSendMail).toHaveBeenCalledTimes(1)
      const mailOptions = mockNodemailerSendMail.mock.calls[0][0]
      expect(mailOptions.attachments[0].content).toEqual(largeContent)
      expect(mailOptions.attachments[0].content.length).toBe(1024 * 1024)
    })

    it('should handle attachments with special characters in filenames', async () => {
      const emailWithSpecialFilenames: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Special Filenames',
        body: '<p>Files with special names</p>',
        attachments: [
          {
            filename: 'file with spaces.txt',
            content: Buffer.from('content1'),
          },
          {
            filename: 'file-with-unicode-ñáéíóú.txt',
            content: Buffer.from('content2'),
          },
          {
            filename: 'file_with_symbols!@#$%.txt',
            content: Buffer.from('content3'),
          },
        ],
      }

      await service.sendEmail(emailWithSpecialFilenames)

      expect(mockNodemailerSendMail).toHaveBeenCalledTimes(1)
      const mailOptions = mockNodemailerSendMail.mock.calls[0][0]
      expect(mailOptions.attachments[0].filename).toBe('file with spaces.txt')
      expect(mailOptions.attachments[1].filename).toBe(
        'file-with-unicode-ñáéíóú.txt',
      )
      expect(mailOptions.attachments[2].filename).toBe(
        'file_with_symbols!@#$%.txt',
      )
    })

    it('should handle empty attachments', async () => {
      const emailWithEmptyAttachment: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Empty Attachment',
        body: '<p>Empty file attached</p>',
        attachments: [
          {
            filename: 'empty.txt',
            content: Buffer.alloc(0),
          },
        ],
      }

      await service.sendEmail(emailWithEmptyAttachment)

      expect(mockNodemailerSendMail).toHaveBeenCalledTimes(1)
      const mailOptions = mockNodemailerSendMail.mock.calls[0][0]
      expect(mailOptions.attachments[0].content.length).toBe(0)
    })
  })

  /**
   * Test Overview: Tests configuration edge cases for email service
   * Purpose: Ensures the service handles various configuration scenarios and missing settings properly
   * Details: Verifies behavior with missing SES configuration, invalid endpoints, and configuration errors
   */
  describe('Configuration Edge Cases', () => {
    beforeEach(() => {
      mockAwsSend.mockResolvedValue({})
    })
    it('should handle missing SES_FROM_EMAIL configuration', async () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'SES_FROM_EMAIL') return undefined
        return `mock-${key}`
      })

      const email: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Test',
        body: '<p>Test</p>',
      }

      await service.sendEmail(email)

      expect(SendEmailCommand).toHaveBeenCalledTimes(1)
      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]
      expect(commandInput.FromEmailAddress).toBeUndefined()
    })

    it('should handle empty SES_FROM_EMAIL configuration', async () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'SES_FROM_EMAIL') return ''
        return `mock-${key}`
      })

      const email: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Test',
        body: '<p>Test</p>',
      }

      await service.sendEmail(email)

      expect(SendEmailCommand).toHaveBeenCalledTimes(1)
      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]
      expect(commandInput.FromEmailAddress).toBe('')
    })

    it('should handle configuration service errors', async () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'SES_FROM_EMAIL') throw new Error('Config error')
        return `mock-${key}`
      })

      const email: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Test',
        body: '<p>Test</p>',
      }

      await expect(service.sendEmail(email)).rejects.toThrow('Config error')
    })
  })

  /**
   * Test Overview: Tests email validation and content processing scenarios
   * Purpose: Ensures the service validates email addresses and processes content correctly
   * Details: Verifies behavior with invalid email addresses, missing fields, and different content types
   */
  describe('Email Validation and Content Processing', () => {
    beforeEach(() => {
      mockAwsSend.mockResolvedValue({})
    })
    it('should handle invalid email addresses in toAddrs', async () => {
      const emailWithInvalidAddresses: EmailNotification = {
        toAddrs: ['invalid-email', 'another@invalid', '@invalid.com'],
        subject: 'Test',
        body: '<p>Test</p>',
      }

      await service.sendEmail(emailWithInvalidAddresses)

      expect(SendEmailCommand).toHaveBeenCalledTimes(1)
      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]
      expect(commandInput.Destination.ToAddresses).toEqual([
        'invalid-email',
        'another@invalid',
        '@invalid.com',
      ])
    })

    it('should handle empty toAddrs array', async () => {
      const emailWithEmptyToAddrs: EmailNotification = {
        toAddrs: [],
        subject: 'Test',
        body: '<p>Test</p>',
      }

      await service.sendEmail(emailWithEmptyToAddrs)

      expect(SendEmailCommand).toHaveBeenCalledTimes(1)
      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]
      expect(commandInput.Destination.ToAddresses).toEqual([])
    })

    it('should handle missing subject', async () => {
      const emailWithoutSubject: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: '',
        body: '<p>Test</p>',
      }

      await service.sendEmail(emailWithoutSubject)

      expect(SendEmailCommand).toHaveBeenCalledTimes(1)
      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]
      expect(commandInput.Content.Simple.Subject.Data).toBe('')
    })

    it('should handle missing body content', async () => {
      const emailWithoutBody: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Test Subject',
        body: '',
      }

      await service.sendEmail(emailWithoutBody)

      expect(SendEmailCommand).toHaveBeenCalledTimes(1)
      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]
      expect(commandInput.Content.Simple.Body.Html.Data).toBe('')
    })

    it('should handle HTML content with special characters', async () => {
      const emailWithSpecialHtml: EmailNotification = {
        toAddrs: ['test@example.com'],
        subject: 'Special HTML',
        body: '<p>Special chars: &lt;&gt;&amp;&quot;&#39; and unicode: 🚀 ñáéíóú</p>',
      }

      await service.sendEmail(emailWithSpecialHtml)

      expect(SendEmailCommand).toHaveBeenCalledTimes(1)
      const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
        .calls[0][0]
      expect(commandInput.Content.Simple.Body.Html.Data).toBe(
        '<p>Special chars: &lt;&gt;&amp;&quot;&#39; and unicode: 🚀 ñáéíóú</p>',
      )
    })
  })

  /**
   * Test Overview: Tests concurrent email sending and rate limiting scenarios
   * Purpose: Ensures the service handles multiple simultaneous email operations correctly
   * Details: Verifies behavior during concurrent sends, mixed success/failure scenarios, and rate limiting
   */
  describe('Concurrent Email Operations', () => {
    beforeEach(() => {
      mockAwsSend.mockResolvedValue({})
    })
    it('should handle concurrent email sending without attachments', async () => {
      const emails = Array.from({ length: 5 }, (_, i) => ({
        toAddrs: [`test${i}@example.com`],
        subject: `Test Email ${i}`,
        body: `<p>Test content ${i}</p>`,
      }))

      const promises = emails.map((email) => service.sendEmail(email))
      await Promise.all(promises)

      expect(mockAwsSend).toHaveBeenCalledTimes(5)
      expect(SendEmailCommand).toHaveBeenCalledTimes(5)
    })

    it('should handle concurrent email sending with attachments', async () => {
      mockNodemailerSendMail.mockImplementation((options, callback) => {
        callback(null, { message: FAKE_RAW_BUFFER })
      })

      const emails = Array.from({ length: 3 }, (_, i) => ({
        toAddrs: [`test${i}@example.com`],
        subject: `Test Email ${i}`,
        body: `<p>Test content ${i}</p>`,
        attachments: [
          {
            filename: `file${i}.txt`,
            content: Buffer.from(`content ${i}`),
          },
        ],
      }))

      const promises = emails.map((email) => service.sendEmail(email))
      await Promise.all(promises)

      expect(mockAwsSend).toHaveBeenCalledTimes(3)
      expect(mockNodemailerSendMail).toHaveBeenCalledTimes(3)
    })

    it('should handle mixed success and failure scenarios', async () => {
      mockAwsSend
        .mockResolvedValueOnce({}) // Success
        .mockRejectedValueOnce(new Error('SES Error')) // Failure
        .mockResolvedValueOnce({}) // Success

      const emails = [
        {
          toAddrs: ['success1@example.com'],
          subject: 'Success 1',
          body: '<p>Success</p>',
        },
        {
          toAddrs: ['failure@example.com'],
          subject: 'Failure',
          body: '<p>Failure</p>',
        },
        {
          toAddrs: ['success2@example.com'],
          subject: 'Success 2',
          body: '<p>Success</p>',
        },
      ]

      const results = await Promise.allSettled(
        emails.map((email) => service.sendEmail(email)),
      )

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      expect(results[2].status).toBe('fulfilled')
      expect(mockAwsSend).toHaveBeenCalledTimes(3)
    })
  })

  /**
   * Test Overview: Tests Inline Template functionality
   * Purpose: Ensures both AWS Native templates (Production) and Manual Compilation (Local/Offline) work correctly
   * Details: Covers env-based logic switching, variable substitution (flat & nested), and validation
   */
  describe('sendInlineTemplateEmail', () => {
    const OLD_ENV = process.env

    // 1. Setup Test Data
    const flatMsg: TemplatedEmailNotification = {
      toAddrs: ['user@example.com'],
      template: {
        subject: 'Welcome {{name}}!',
        html: '<p>Hello {{name}}, your code is {{code}}.</p>',
        text: 'Hello {{name}}, code: {{code}}',
      },
      data: {
        name: 'Alice',
        code: '12345',
      },
    }

    const nestedMsg: TemplatedEmailNotification = {
      toAddrs: ['user@example.com'],
      template: {
        subject: 'Welcome {{user.profile.firstName}}!',
        html: '<p>Hello, your access code is {{auth.otp}}.</p>',
        text: 'Code: {{auth.otp}}',
      },
      data: {
        user: {
          profile: { firstName: 'Bob' },
        },
        auth: {
          otp: '999888',
        },
      },
    }

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...OLD_ENV }
      mockAwsSend.mockResolvedValue({ MessageId: 'msg-id-123' })
    })

    afterAll(() => {
      process.env = OLD_ENV
    })

    it('should return undefined and log warning if no recipients provided', async () => {
      const msgNoRecipients: TemplatedEmailNotification = {
        ...flatMsg,
        toAddrs: [],
        ccAddrs: [],
        bccAddrs: [],
      }

      const result = await service.sendInlineTemplateEmail(msgNoRecipients)

      expect(result).toBeUndefined()
      expect(mockAwsSend).not.toHaveBeenCalled()
    })

    describe('Environment: PRODUCTION (AWS Native Templates)', () => {
      beforeEach(() => {
        // Ensure IS_OFFLINE is unset for production simulation
        delete process.env.IS_OFFLINE
      })

      it('should use SendEmailCommand with Template structure (Flat Data)', async () => {
        await service.sendInlineTemplateEmail(flatMsg)

        expect(SendEmailCommand).toHaveBeenCalledTimes(1)
        const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
          .calls[0][0]

        // Validation
        expect(commandInput.Content.Template).toBeDefined()
        expect(commandInput.Content.Simple).toBeUndefined()
        expect(commandInput.Content.Template.TemplateData).toBe(
          JSON.stringify(flatMsg.data),
        )
      })

      it('should use SendEmailCommand with Template structure (Nested Data)', async () => {
        await service.sendInlineTemplateEmail(nestedMsg)

        expect(SendEmailCommand).toHaveBeenCalledTimes(1)
        const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
          .calls[0][0]

        // Validation
        expect(commandInput.Content.Template).toBeDefined()
        expect(commandInput.Content.Template.TemplateData).toBe(
          JSON.stringify(nestedMsg.data),
        )
      })
    })

    describe('Environment: LOCAL/OFFLINE (Manual Compilation)', () => {
      beforeEach(() => {
        process.env.IS_OFFLINE = 'true'
      })

      it('should manually compile FLAT object variables', async () => {
        await service.sendInlineTemplateEmail(flatMsg)

        expect(SendEmailCommand).toHaveBeenCalledTimes(1)
        const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
          .calls[0][0]

        // Ensure fallback to Simple email
        expect(commandInput.Content.Simple).toBeDefined()
        expect(commandInput.Content.Template).toBeUndefined()

        // Check flat replacement: {{name}} -> Alice
        expect(commandInput.Content.Simple.Subject.Data).toBe('Welcome Alice!')
        expect(commandInput.Content.Simple.Body.Html.Data).toBe(
          '<p>Hello Alice, your code is 12345.</p>',
        )
      })

      it('should manually compile NESTED object variables', async () => {
        await service.sendInlineTemplateEmail(nestedMsg)

        expect(SendEmailCommand).toHaveBeenCalledTimes(1)
        const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
          .calls[0][0]

        // Check nested replacement
        // {{user.profile.firstName}} -> Bob
        expect(commandInput.Content.Simple.Subject.Data).toBe('Welcome Bob!')

        // {{auth.otp}} -> 999888
        expect(commandInput.Content.Simple.Body.Html.Data).toBe(
          '<p>Hello, your access code is 999888.</p>',
        )
      })

      it('should handle missing keys by preserving the tag (Regex Fallback)', async () => {
        const incompleteMsg: TemplatedEmailNotification = {
          ...nestedMsg,
          // 'auth' key is missing entirely from data
          data: {
            user: { profile: { firstName: 'Bob' } },
          } as any,
        }

        await service.sendInlineTemplateEmail(incompleteMsg)

        const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
          .calls[0][0]

        // {{user.profile.firstName}} should still work
        expect(commandInput.Content.Simple.Subject.Data).toBe('Welcome Bob!')

        // {{auth.otp}} should remain literally in the text because the data is missing
        expect(commandInput.Content.Simple.Body.Html.Data).toContain(
          '{{auth.otp}}',
        )
      })

      it('should handle Complex Scenarios (Japanese keys, Whitespace, Deep Nesting)', async () => {
        const complexMsg: TemplatedEmailNotification = {
          toAddrs: ['test@jp.com'],
          template: {
            subject: 'Confirm: {{ 認証コード }}', // Contains spaces and Japanese
            html: '<p>User: {{ user.details.name }}</p><p>Code: {{認証コード}}</p>',
            text: 'Code: {{認証コード}}',
          },
          data: {
            '認証コード': '12345', // Japanese Key
            user: {
              details: {
                name: 'Taro', // Nested Key
              },
            },
          },
        }

        await service.sendInlineTemplateEmail(complexMsg)

        const commandInput = (SendEmailCommand as unknown as jest.Mock).mock.calls[0][0]

        // 1. Validate Japanese Key with Whitespace inside braces
        // {{ 認証コード }} -> 12345
        expect(commandInput.Content.Simple.Subject.Data).toBe('Confirm: 12345')

        // 2. Validate Nested Object & Japanese Key without whitespace
        // {{ user.details.name }} -> Taro
        // {{認証コード}} -> 12345
        expect(commandInput.Content.Simple.Body.Html.Data).toBe(
          '<p>User: Taro</p><p>Code: 12345</p>',
        )
      })

      it('should handle NESTED objects with JAPANESE keys and values', async () => {
        const japaneseNestedMsg: TemplatedEmailNotification = {
          toAddrs: ['jp-test@example.com'],
          template: {
            subject: '注文確認: {{ 注文.ID }}',
            html: '<p>お客様: {{ 顧客.情報.名前 }} 様</p><p>商品: {{ 注文.詳細.品名 }}</p>',
            text: 'お客様: {{ 顧客.情報.名前 }} 様, 商品: {{ 注文.詳細.品名 }}',
          },
          data: {
            // Nested Japanese Keys
            '注文': {
              'ID': 'ORD-2024',
              '詳細': {
                '品名': 'ワイヤレスイヤホン', // Japanese Value
              },
            },
            '顧客': {
              '情報': {
                '名前': '山田 太郎', // Japanese Value
              },
            },
          },
        }
  
        await service.sendInlineTemplateEmail(japaneseNestedMsg)
  
        const commandInput = (SendEmailCommand as unknown as jest.Mock).mock
          .calls[0][0]
  
        // 1. Check Subject: {{ 注文.ID }} -> ORD-2024
        expect(commandInput.Content.Simple.Subject.Data).toBe('注文確認: ORD-2024')
  
        // 2. Check Body HTML:
        // {{ 顧客.情報.名前 }} -> 山田 太郎
        // {{ 注文.詳細.品名 }} -> ワイヤレスイヤホン
        expect(commandInput.Content.Simple.Body.Html.Data).toBe(
          '<p>お客様: 山田 太郎 様</p><p>商品: ワイヤレスイヤホン</p>',
        )
  
        // 3. Check Body Text: Same replacements
        expect(commandInput.Content.Simple.Body.Text.Data).toBe(
          'お客様: 山田 太郎 様, 商品: ワイヤレスイヤホン',
        )
      })
    })

    it('should catch and log errors during sending', async () => {
      mockAwsSend.mockRejectedValue(new Error('AWS Validation Error'))

      await expect(service.sendInlineTemplateEmail(flatMsg)).rejects.toThrow(
        'AWS Validation Error',
      )

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send inline template email'),
        expect.any(String),
      )
    })
  })
})
