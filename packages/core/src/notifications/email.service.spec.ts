import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { Logger } from '@nestjs/common'
import nodemailer from 'nodemailer'

import { EmailService } from './email.service'
import { EmailNotification } from '../interfaces'

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
})
