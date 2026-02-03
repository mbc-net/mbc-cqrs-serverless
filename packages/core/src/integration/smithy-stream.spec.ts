/**
 * Smithy Stream Utility Tests
 *
 * This file tests @smithy/util-stream behaviors:
 * - Stream to string conversion
 * - Stream to buffer conversion
 * - Stream to byte array conversion
 * - SDK stream mixin functionality
 *
 * These tests verify stream utility contracts to detect breaking changes.
 */
import { Readable, PassThrough } from 'stream'
import { sdkStreamMixin } from '@smithy/util-stream'

describe('Smithy Stream Utility Tests', () => {
  // ============================================================================
  // sdkStreamMixin Basic Functionality
  // ============================================================================
  describe('sdkStreamMixin basic functionality', () => {
    describe('Creating SDK stream from Readable', () => {
      it('should wrap Readable stream with SDK methods', () => {
        const readable = new Readable()
        readable.push('test content')
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)

        expect(typeof sdkStream.transformToString).toBe('function')
        expect(typeof sdkStream.transformToByteArray).toBe('function')
        expect(typeof sdkStream.transformToWebStream).toBe('function')
      })

      it('should maintain stream properties', () => {
        const readable = new Readable({
          read() {
            this.push('data')
            this.push(null)
          },
        })

        const sdkStream = sdkStreamMixin(readable)

        // sdkStreamMixin preserves the underlying stream functionality
        // We verify by checking the stream can still be used
        expect(sdkStream).toBeDefined()
        // The underlying readable stream should be accessible
        expect((sdkStream as unknown as Readable).readable).toBe(true)
      })
    })
  })

  // ============================================================================
  // transformToString
  // ============================================================================
  describe('transformToString', () => {
    describe('Basic string conversion', () => {
      it('should convert stream to string', async () => {
        const readable = new Readable()
        readable.push('Hello, World!')
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toBe('Hello, World!')
      })

      it('should handle multi-chunk stream', async () => {
        const readable = new Readable()
        readable.push('chunk1')
        readable.push('chunk2')
        readable.push('chunk3')
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toBe('chunk1chunk2chunk3')
      })

      it('should handle empty stream', async () => {
        const readable = new Readable()
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toBe('')
      })
    })

    describe('Encoding support', () => {
      it('should support utf-8 encoding (default)', async () => {
        const readable = new Readable()
        readable.push('UTF-8 日本語')
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString('utf-8')

        expect(result).toBe('UTF-8 日本語')
      })

      it('should handle base64 encoding', async () => {
        const readable = new Readable()
        const buffer = Buffer.from('Hello')
        readable.push(buffer)
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString('base64')

        expect(result).toBe('SGVsbG8=')
      })

      it('should handle ascii encoding', async () => {
        const readable = new Readable()
        readable.push('ASCII text')
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString('ascii')

        expect(result).toBe('ASCII text')
      })
    })

    describe('JSON content handling', () => {
      it('should convert JSON stream to string and parse', async () => {
        const jsonData = { name: 'test', value: 42, nested: { key: 'value' } }
        const readable = new Readable()
        readable.push(JSON.stringify(jsonData))
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()
        const parsed = JSON.parse(result)

        expect(parsed).toEqual(jsonData)
      })

      it('should handle large JSON', async () => {
        const largeData = {
          items: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: `item-${i}`,
            data: 'x'.repeat(100),
          })),
        }

        const readable = new Readable()
        readable.push(JSON.stringify(largeData))
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()
        const parsed = JSON.parse(result)

        expect(parsed.items.length).toBe(1000)
      })
    })
  })

  // ============================================================================
  // transformToByteArray
  // ============================================================================
  describe('transformToByteArray', () => {
    describe('Basic byte array conversion', () => {
      it('should convert stream to Uint8Array', async () => {
        const readable = new Readable()
        readable.push(Buffer.from([0x01, 0x02, 0x03, 0x04]))
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToByteArray()

        expect(result).toBeInstanceOf(Uint8Array)
        expect(Array.from(result)).toEqual([0x01, 0x02, 0x03, 0x04])
      })

      it('should handle multi-chunk binary data', async () => {
        const readable = new Readable()
        readable.push(Buffer.from([0x01, 0x02]))
        readable.push(Buffer.from([0x03, 0x04]))
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToByteArray()

        expect(Array.from(result)).toEqual([0x01, 0x02, 0x03, 0x04])
      })

      it('should handle empty binary stream', async () => {
        const readable = new Readable()
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToByteArray()

        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBe(0)
      })
    })

    describe('Binary data handling', () => {
      it('should preserve all byte values (0-255)', async () => {
        const allBytes = new Uint8Array(256)
        for (let i = 0; i < 256; i++) {
          allBytes[i] = i
        }

        const readable = new Readable()
        readable.push(Buffer.from(allBytes))
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToByteArray()

        expect(result.length).toBe(256)
        for (let i = 0; i < 256; i++) {
          expect(result[i]).toBe(i)
        }
      })

      it('should handle binary file-like content', async () => {
        // Simulate PDF header
        const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]) // %PDF-

        const readable = new Readable()
        readable.push(pdfHeader)
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToByteArray()

        expect(Buffer.from(result).toString()).toBe('%PDF-')
      })
    })
  })

  // ============================================================================
  // Stream from Buffer
  // ============================================================================
  describe('Stream from Buffer', () => {
    describe('Buffer to SDK stream', () => {
      it('should create SDK stream from Buffer', async () => {
        const buffer = Buffer.from('Buffer content')
        const readable = Readable.from(buffer)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toBe('Buffer content')
      })

      it('should round-trip Buffer through stream', async () => {
        const original = Buffer.from([0x00, 0x01, 0xff, 0xfe])
        const readable = Readable.from(original)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToByteArray()

        expect(Buffer.from(result)).toEqual(original)
      })
    })
  })

  // ============================================================================
  // Stream from Iterable
  // ============================================================================
  describe('Stream from Iterable', () => {
    describe('Array to stream', () => {
      it('should create stream from array of buffers', async () => {
        const chunks = [Buffer.from('part1'), Buffer.from('part2')]
        const readable = Readable.from(chunks)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toBe('part1part2')
      })

      it('should create stream from array of strings', async () => {
        const chunks = ['hello', ' ', 'world']
        const readable = Readable.from(chunks)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toBe('hello world')
      })
    })

    describe('Generator to stream', () => {
      it('should create stream from generator', async () => {
        function* generateChunks() {
          yield 'chunk1'
          yield 'chunk2'
          yield 'chunk3'
        }

        const readable = Readable.from(generateChunks())
        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toBe('chunk1chunk2chunk3')
      })

      it('should create stream from async generator', async () => {
        async function* asyncGenerator() {
          yield 'async1'
          await new Promise((r) => setTimeout(r, 10))
          yield 'async2'
        }

        const readable = Readable.from(asyncGenerator())
        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toBe('async1async2')
      })
    })
  })

  // ============================================================================
  // Error Handling
  // ============================================================================
  describe('Error handling', () => {
    describe('Stream error propagation', () => {
      it('should propagate stream errors', async () => {
        const readable = new Readable({
          read() {
            this.destroy(new Error('Stream error'))
          },
        })

        const sdkStream = sdkStreamMixin(readable)

        await expect(sdkStream.transformToString()).rejects.toThrow('Stream error')
      })

      it('should handle destroyed stream with error', async () => {
        const readable = new Readable({
          read() {
            // Don't push anything, just destroy with error
          },
        })

        // Destroy the stream with an error
        readable.destroy(new Error('Stream was destroyed'))

        const sdkStream = sdkStreamMixin(readable)

        // The destroyed stream should reject with the error
        await expect(sdkStream.transformToString()).rejects.toThrow(
          'Stream was destroyed',
        )
      })
    })
  })

  // ============================================================================
  // PassThrough Stream
  // ============================================================================
  describe('PassThrough stream', () => {
    describe('Using PassThrough with SDK mixin', () => {
      it('should work with PassThrough stream', async () => {
        const passThrough = new PassThrough()
        const sdkStream = sdkStreamMixin(passThrough)

        // Write data asynchronously
        setTimeout(() => {
          passThrough.write('hello')
          passThrough.write(' world')
          passThrough.end()
        }, 10)

        const result = await sdkStream.transformToString()
        expect(result).toBe('hello world')
      })

      it('should pipe data through PassThrough', async () => {
        const source = new Readable()
        source.push('piped data')
        source.push(null)

        const passThrough = new PassThrough()
        source.pipe(passThrough)

        const sdkStream = sdkStreamMixin(passThrough)
        const result = await sdkStream.transformToString()

        expect(result).toBe('piped data')
      })
    })
  })

  // ============================================================================
  // Large Data Handling
  // ============================================================================
  describe('Large data handling', () => {
    describe('Memory-efficient streaming', () => {
      it('should handle large string data', async () => {
        const largeString = 'x'.repeat(100000)
        const readable = Readable.from([largeString])

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result.length).toBe(100000)
      })

      it('should handle many small chunks', async () => {
        const chunks = Array.from({ length: 1000 }, (_, i) => `chunk${i}`)
        const readable = Readable.from(chunks)

        const sdkStream = sdkStreamMixin(readable)
        const result = await sdkStream.transformToString()

        expect(result).toContain('chunk0')
        expect(result).toContain('chunk999')
      })
    })
  })

  // ============================================================================
  // Web Stream Compatibility
  // ============================================================================
  describe('Web stream compatibility', () => {
    describe('transformToWebStream', () => {
      it('should have transformToWebStream method', () => {
        const readable = new Readable()
        readable.push('data')
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)

        expect(typeof sdkStream.transformToWebStream).toBe('function')
      })

      it('should transform to web-compatible ReadableStream', async () => {
        const readable = new Readable()
        readable.push('web stream data')
        readable.push(null)

        const sdkStream = sdkStreamMixin(readable)

        // Node.js 18+ has global ReadableStream
        if (typeof ReadableStream !== 'undefined') {
          const webStream = sdkStream.transformToWebStream()
          expect(webStream).toBeInstanceOf(ReadableStream)
        }
      })
    })
  })

  // ============================================================================
  // Integration with AWS S3 response pattern
  // ============================================================================
  describe('Integration with S3 response pattern', () => {
    describe('Simulated S3 GetObject response', () => {
      it('should handle S3-like text response', async () => {
        // Simulate S3 GetObject Body
        const body = new Readable()
        body.push('S3 object content')
        body.push(null)

        const sdkBody = sdkStreamMixin(body)
        const content = await sdkBody.transformToString()

        expect(content).toBe('S3 object content')
      })

      it('should handle S3-like JSON response', async () => {
        const jsonContent = { key: 'value', count: 42 }
        const body = new Readable()
        body.push(JSON.stringify(jsonContent))
        body.push(null)

        const sdkBody = sdkStreamMixin(body)
        const content = await sdkBody.transformToString()
        const parsed = JSON.parse(content)

        expect(parsed).toEqual(jsonContent)
      })

      it('should handle S3-like binary response', async () => {
        // Simulate binary file content
        const binaryContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG header
        const body = new Readable()
        body.push(Buffer.from(binaryContent))
        body.push(null)

        const sdkBody = sdkStreamMixin(body)
        const bytes = await sdkBody.transformToByteArray()

        expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47])
      })
    })
  })
})
