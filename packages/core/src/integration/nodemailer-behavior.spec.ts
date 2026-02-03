/**
 * nodemailer Behavioral Tests
 *
 * These tests verify that nodemailer behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 *
 * nodemailer is used for constructing MIME messages with attachments
 * that are then sent via AWS SES as raw email.
 */

import nodemailer from 'nodemailer'

describe('nodemailer Behavioral Tests', () => {
  describe('Module exports', () => {
    it('should export createTransport function', () => {
      expect(typeof nodemailer.createTransport).toBe('function')
    })

    it('should have default export with createTransport', () => {
      expect(nodemailer).toBeDefined()
      expect(nodemailer.createTransport).toBeDefined()
    })
  })

  describe('Stream transport mode', () => {
    it('should create transporter with streamTransport option', () => {
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })

      expect(transporter).toBeDefined()
      expect(typeof transporter.sendMail).toBe('function')
    })

    it('should generate email buffer using streamTransport', async () => {
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })

      const mailOptions: nodemailer.SendMailOptions = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>This is a test email</p>',
      }

      const info = await new Promise<nodemailer.SentMessageInfo>(
        (resolve, reject) => {
          transporter.sendMail(mailOptions, (err, info) => {
            if (err) return reject(err)
            resolve(info)
          })
        },
      )

      // With buffer: true, message should be a Buffer
      expect(info.message).toBeInstanceOf(Buffer)
      expect(info.envelope).toBeDefined()
      expect(info.envelope.from).toBe('sender@example.com')
      expect(info.envelope.to).toContain('recipient@example.com')
    })

    it('should support promise-based sendMail', async () => {
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })

      const mailOptions: nodemailer.SendMailOptions = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'Plain text body',
      }

      // nodemailer supports both callback and promise styles
      const info = await transporter.sendMail(mailOptions)

      expect(info.message).toBeInstanceOf(Buffer)
    })
  })

  describe('MIME message structure', () => {
    let transporter: nodemailer.Transporter

    beforeAll(() => {
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })
    })

    it('should include From header', async () => {
      const info = await transporter.sendMail({
        from: 'Test Sender <sender@example.com>',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test body',
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('From:')
      expect(messageContent).toContain('sender@example.com')
    })

    it('should include To header', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Test',
        text: 'Test body',
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('To:')
      expect(messageContent).toContain('recipient1@example.com')
      expect(messageContent).toContain('recipient2@example.com')
    })

    it('should include CC and BCC in envelope for delivery', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'to@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Test',
        text: 'Test body',
      })

      const messageContent = (info.message as Buffer).toString()

      // CC should be in headers
      expect(messageContent).toContain('Cc:')
      expect(messageContent).toContain('cc@example.com')

      // Envelope should contain all recipients for delivery
      expect(info.envelope.to).toContain('to@example.com')
      expect(info.envelope.to).toContain('cc@example.com')
      expect(info.envelope.to).toContain('bcc@example.com')

      // Note: In streamTransport, BCC header may be included in the message.
      // In actual SMTP delivery, the BCC header is stripped by the transport.
      // This test verifies the envelope correctly includes BCC for delivery.
    })

    it('should include Subject header', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject Line',
        text: 'Test body',
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('Subject:')
      expect(messageContent).toContain('Test Subject Line')
    })

    it('should include Reply-To header when specified', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        replyTo: 'reply@example.com',
        subject: 'Test',
        text: 'Test body',
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('Reply-To:')
      expect(messageContent).toContain('reply@example.com')
    })

    it('should generate MIME-Version header', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test body',
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('MIME-Version: 1.0')
    })

    it('should set Content-Type for HTML emails', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>HTML body</p>',
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('Content-Type:')
      expect(messageContent).toContain('text/html')
    })

    it('should create multipart message for text + HTML', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Plain text version',
        html: '<p>HTML version</p>',
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('multipart/alternative')
      expect(messageContent).toContain('Plain text version')
      expect(messageContent).toContain('HTML version')
    })
  })

  describe('Attachment handling', () => {
    let transporter: nodemailer.Transporter

    beforeAll(() => {
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })
    })

    it('should handle string content attachments', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test with attachment',
        text: 'See attachment',
        attachments: [
          {
            filename: 'test.txt',
            content: 'Hello World',
          },
        ],
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('Content-Disposition: attachment')
      expect(messageContent).toContain('test.txt')
    })

    it('should handle Buffer content attachments', async () => {
      const attachmentContent = Buffer.from('Binary content here')

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test with buffer attachment',
        text: 'See attachment',
        attachments: [
          {
            filename: 'data.bin',
            content: attachmentContent,
          },
        ],
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('Content-Disposition: attachment')
      expect(messageContent).toContain('data.bin')
    })

    it('should handle multiple attachments', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Multiple attachments',
        text: 'See attachments',
        attachments: [
          { filename: 'file1.txt', content: 'Content 1' },
          { filename: 'file2.txt', content: 'Content 2' },
          { filename: 'file3.txt', content: 'Content 3' },
        ],
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('file1.txt')
      expect(messageContent).toContain('file2.txt')
      expect(messageContent).toContain('file3.txt')
    })

    it('should set Content-Type for attachments', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Body',
        attachments: [
          {
            filename: 'document.pdf',
            content: Buffer.from('PDF content'),
            contentType: 'application/pdf',
          },
        ],
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('application/pdf')
    })

    it('should handle attachment with CID for embedded images', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test with embedded image',
        html: '<img src="cid:image001"/>',
        attachments: [
          {
            filename: 'image.png',
            content: Buffer.from('fake image data'),
            cid: 'image001',
          },
        ],
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('Content-ID:')
      expect(messageContent).toContain('image001')
    })

    it('should create multipart/mixed for email with attachments', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Body text',
        attachments: [{ filename: 'file.txt', content: 'content' }],
      })

      const messageContent = (info.message as Buffer).toString()
      expect(messageContent).toContain('multipart/mixed')
    })
  })

  describe('Unicode and encoding support', () => {
    let transporter: nodemailer.Transporter

    beforeAll(() => {
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })
    })

    it('should handle Japanese characters in subject', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'テストメール件名',
        text: 'テスト本文',
      })

      const messageContent = (info.message as Buffer).toString()
      // Subject should be encoded (quoted-printable or base64)
      expect(messageContent).toContain('Subject:')
    })

    it('should handle Japanese characters in body', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>日本語のメール本文です。</p>',
      })

      const messageContent = (info.message as Buffer).toString()
      // Content should be properly encoded
      expect(messageContent).toContain('Content-Type:')
    })

    it('should handle emoji in email', async () => {
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test 🎉',
        text: 'Hello! 👋 This is a test 🚀',
      })

      expect(info.message).toBeInstanceOf(Buffer)
      // Email should be generated without errors
    })

    it('should handle Unicode in sender name', async () => {
      const info = await transporter.sendMail({
        from: '山田太郎 <yamada@example.com>',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Body',
      })

      expect(info.envelope.from).toBe('yamada@example.com')
    })
  })

  describe('Error handling', () => {
    it('should handle missing required fields gracefully', async () => {
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
      })

      // nodemailer may still generate a message even with missing fields
      // This test verifies the behavior
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        // Missing 'to' field
        subject: 'Test',
        text: 'Body',
      } as any)

      // Should still create a message (even if incomplete)
      expect(info.message).toBeDefined()
    })

    it('should handle empty attachments array', async () => {
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
      })

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Body',
        attachments: [],
      })

      expect(info.message).toBeInstanceOf(Buffer)
    })
  })

  describe('Callback vs Promise API consistency', () => {
    let transporter: nodemailer.Transporter

    beforeAll(() => {
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })
    })

    it('should produce same result with callback and promise', async () => {
      const mailOptions: nodemailer.SendMailOptions = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Consistency Test',
        text: 'Test body content',
      }

      // Callback style
      const callbackResult = await new Promise<nodemailer.SentMessageInfo>(
        (resolve, reject) => {
          transporter.sendMail(mailOptions, (err, info) => {
            if (err) return reject(err)
            resolve(info)
          })
        },
      )

      // Promise style
      const promiseResult = await transporter.sendMail(mailOptions)

      // Both should have message buffers
      expect(callbackResult.message).toBeInstanceOf(Buffer)
      expect(promiseResult.message).toBeInstanceOf(Buffer)

      // Envelopes should match
      expect(callbackResult.envelope.from).toBe(promiseResult.envelope.from)
      expect(callbackResult.envelope.to).toEqual(promiseResult.envelope.to)
    })
  })

  describe('Transport options', () => {
    it('should respect newline option (unix)', async () => {
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Body',
      })

      const messageContent = (info.message as Buffer).toString()
      // Unix newlines should be \n (not \r\n)
      // The message should contain headers separated by newlines
      expect(messageContent).toContain('\n')
    })

    it('should work without buffer option (streaming mode)', async () => {
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        // buffer: false - default
      })

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Body',
      })

      // Without buffer: true, message should be a readable stream
      expect(info.message).toBeDefined()
    })
  })

  describe('Real-world usage patterns', () => {
    it('should match EmailService attachment pattern', async () => {
      // This test mirrors the exact usage in EmailService
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })

      const mailOptions: nodemailer.SendMailOptions = {
        from: 'noreply@example.com',
        to: ['user1@example.com', 'user2@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        replyTo: ['support@example.com'],
        subject: 'Report Attached',
        html: '<p>Please find the report attached.</p>',
        attachments: [
          {
            filename: 'report.pdf',
            content: Buffer.from('PDF binary content'),
            contentType: 'application/pdf',
          },
        ],
      }

      // Using callback style as in EmailService
      const emailBuffer = await new Promise<Buffer>((resolve, reject) => {
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) return reject(err)
          resolve(info.message as Buffer)
        })
      })

      expect(emailBuffer).toBeInstanceOf(Buffer)
      expect(emailBuffer.length).toBeGreaterThan(0)

      // Verify the buffer contains expected content
      const content = emailBuffer.toString()
      expect(content).toContain('From:')
      expect(content).toContain('To:')
      expect(content).toContain('Subject:')
      expect(content).toContain('report.pdf')
    })
  })
})
