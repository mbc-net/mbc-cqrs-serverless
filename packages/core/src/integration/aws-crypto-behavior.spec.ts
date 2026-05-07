/**
 * @aws-crypto/sha256-js Behavioral Tests
 *
 * These tests verify that @aws-crypto/sha256-js behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 *
 * This library is used for signing AWS requests, particularly AppSync
 * GraphQL requests that require SigV4 authentication.
 */

import { Sha256 } from '@aws-crypto/sha256-js'

describe('@aws-crypto/sha256-js Behavioral Tests', () => {
  describe('Module exports', () => {
    it('should export Sha256 class', () => {
      expect(Sha256).toBeDefined()
      expect(typeof Sha256).toBe('function')
    })

    it('should be instantiable', () => {
      const hash = new Sha256()
      expect(hash).toBeInstanceOf(Sha256)
    })

    it('should be instantiable with secret key', () => {
      const secretKey = 'my-secret-key'
      const hash = new Sha256(secretKey)
      expect(hash).toBeInstanceOf(Sha256)
    })
  })

  describe('Hash computation', () => {
    it('should compute consistent hash for same input', async () => {
      const input = 'Hello, World!'

      const hash1 = new Sha256()
      hash1.update(input)
      const result1 = await hash1.digest()

      const hash2 = new Sha256()
      hash2.update(input)
      const result2 = await hash2.digest()

      // Results should be identical Uint8Array
      expect(result1).toEqual(result2)
    })

    it('should produce different hashes for different inputs', async () => {
      const hash1 = new Sha256()
      hash1.update('input1')
      const result1 = await hash1.digest()

      const hash2 = new Sha256()
      hash2.update('input2')
      const result2 = await hash2.digest()

      expect(result1).not.toEqual(result2)
    })

    it('should produce 32-byte (256-bit) hash', async () => {
      const hash = new Sha256()
      hash.update('test data')
      const result = await hash.digest()

      // SHA-256 produces 256 bits = 32 bytes
      expect(result.byteLength).toBe(32)
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should compute known SHA-256 hash correctly', async () => {
      // Known test vector: SHA-256 of empty string
      const hash = new Sha256()
      hash.update('')
      const result = await hash.digest()

      // SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const expectedHex =
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      const actualHex = Buffer.from(result).toString('hex')

      expect(actualHex).toBe(expectedHex)
    })

    it('should compute known SHA-256 hash for simple string', async () => {
      // Known test vector: SHA-256 of "abc"
      const hash = new Sha256()
      hash.update('abc')
      const result = await hash.digest()

      // SHA-256('abc') = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
      const expectedHex =
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
      const actualHex = Buffer.from(result).toString('hex')

      expect(actualHex).toBe(expectedHex)
    })
  })

  describe('Streaming (update/digest) pattern', () => {
    it('should support multiple update calls', async () => {
      const hash = new Sha256()
      hash.update('Hello')
      hash.update(', ')
      hash.update('World')
      hash.update('!')
      const result = await hash.digest()

      // Compare with single update
      const hashSingle = new Sha256()
      hashSingle.update('Hello, World!')
      const resultSingle = await hashSingle.digest()

      expect(result).toEqual(resultSingle)
    })

    it('should handle empty updates', async () => {
      const hash = new Sha256()
      hash.update('')
      hash.update('test')
      hash.update('')
      const result = await hash.digest()

      const hashDirect = new Sha256()
      hashDirect.update('test')
      const resultDirect = await hashDirect.digest()

      expect(result).toEqual(resultDirect)
    })

    it('should handle large data through streaming', async () => {
      const largeData = 'x'.repeat(100000) // 100KB of data

      const hash = new Sha256()
      // Stream in chunks
      const chunkSize = 10000
      for (let i = 0; i < largeData.length; i += chunkSize) {
        hash.update(largeData.slice(i, i + chunkSize))
      }
      const streamedResult = await hash.digest()

      // Compare with single update
      const hashSingle = new Sha256()
      hashSingle.update(largeData)
      const singleResult = await hashSingle.digest()

      expect(streamedResult).toEqual(singleResult)
    })
  })

  describe('Binary data hashing', () => {
    it('should hash Uint8Array data', async () => {
      const binaryData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"

      const hash = new Sha256()
      hash.update(binaryData)
      const result = await hash.digest()

      // Compare with string "Hello"
      const hashString = new Sha256()
      hashString.update('Hello')
      const resultString = await hashString.digest()

      expect(result).toEqual(resultString)
    })

    it('should hash Buffer data', async () => {
      const bufferData = Buffer.from('Hello, World!')

      const hash = new Sha256()
      hash.update(bufferData)
      const result = await hash.digest()

      const hashString = new Sha256()
      hashString.update('Hello, World!')
      const resultString = await hashString.digest()

      expect(result).toEqual(resultString)
    })

    it('should hash binary data with null bytes', async () => {
      const binaryWithNull = new Uint8Array([0x00, 0x01, 0x02, 0x00, 0x03])

      const hash = new Sha256()
      hash.update(binaryWithNull)
      const result = await hash.digest()

      expect(result.byteLength).toBe(32)
    })
  })

  describe('HMAC functionality', () => {
    it('should compute HMAC with secret key', async () => {
      const secretKey = 'my-secret-key'
      const message = 'message to authenticate'

      const hmac = new Sha256(secretKey)
      hmac.update(message)
      const result = await hmac.digest()

      expect(result.byteLength).toBe(32)
    })

    it('should produce different HMAC for different keys', async () => {
      const message = 'same message'

      const hmac1 = new Sha256('key1')
      hmac1.update(message)
      const result1 = await hmac1.digest()

      const hmac2 = new Sha256('key2')
      hmac2.update(message)
      const result2 = await hmac2.digest()

      expect(result1).not.toEqual(result2)
    })

    it('should produce same HMAC for same key and message', async () => {
      const secretKey = 'consistent-key'
      const message = 'consistent message'

      const hmac1 = new Sha256(secretKey)
      hmac1.update(message)
      const result1 = await hmac1.digest()

      const hmac2 = new Sha256(secretKey)
      hmac2.update(message)
      const result2 = await hmac2.digest()

      expect(result1).toEqual(result2)
    })

    it('should compute HMAC with binary key', async () => {
      const binaryKey = new Uint8Array([0x01, 0x02, 0x03, 0x04])
      const message = 'message'

      const hmac = new Sha256(binaryKey)
      hmac.update(message)
      const result = await hmac.digest()

      expect(result.byteLength).toBe(32)
    })
  })

  describe('AWS SigV4 signing context', () => {
    it('should hash canonical request as used in SigV4', async () => {
      // Simulating a canonical request hash as used in AWS SigV4
      const canonicalRequest = [
        'POST',
        '/graphql',
        '',
        'content-type:application/json',
        'host:example.appsync-api.ap-northeast-1.amazonaws.com',
        'x-amz-date:20231201T000000Z',
        '',
        'content-type;host;x-amz-date',
        '{"query": "{ listItems { id } }"}',
      ].join('\n')

      const hash = new Sha256()
      hash.update(canonicalRequest)
      const result = await hash.digest()

      // Result should be 32 bytes for use in string to sign
      expect(result.byteLength).toBe(32)

      // Convert to hex for use in SigV4
      const hexHash = Buffer.from(result).toString('hex')
      expect(hexHash).toHaveLength(64) // 32 bytes = 64 hex chars
    })

    it('should hash request payload for content-sha256 header', async () => {
      const requestBody = JSON.stringify({
        query: '{ listItems { id name } }',
        variables: { limit: 10 },
      })

      const hash = new Sha256()
      hash.update(requestBody)
      const result = await hash.digest()

      const contentSha256 = Buffer.from(result).toString('hex')

      expect(contentSha256).toHaveLength(64)
    })
  })

  describe('Edge cases', () => {
    it('should handle very long strings', async () => {
      const veryLongString = 'a'.repeat(1000000) // 1MB

      const hash = new Sha256()
      hash.update(veryLongString)
      const result = await hash.digest()

      expect(result.byteLength).toBe(32)
    })

    it('should handle unicode strings', async () => {
      const unicodeString = '日本語テスト 🎉 こんにちは'

      const hash = new Sha256()
      hash.update(unicodeString)
      const result = await hash.digest()

      expect(result.byteLength).toBe(32)
    })

    it('should handle special characters', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~'

      const hash = new Sha256()
      hash.update(specialChars)
      const result = await hash.digest()

      expect(result.byteLength).toBe(32)
    })

    it('should handle JSON strings with various encodings', async () => {
      const jsonString = JSON.stringify({
        key: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { a: 'b' },
        unicode: '日本語',
      })

      const hash = new Sha256()
      hash.update(jsonString)
      const result = await hash.digest()

      expect(result.byteLength).toBe(32)
    })
  })

  describe('Reset behavior', () => {
    it('should create independent hash instances', async () => {
      // Ensure creating new instances gives independent state
      const hash1 = new Sha256()
      hash1.update('data1')

      const hash2 = new Sha256()
      hash2.update('data2')

      const result1 = await hash1.digest()
      const result2 = await hash2.digest()

      expect(result1).not.toEqual(result2)
    })

    it('should be able to reuse by creating new instance', async () => {
      let hash = new Sha256()
      hash.update('first')
      const result1 = await hash.digest()

      // Create new instance for new computation
      hash = new Sha256()
      hash.update('second')
      const result2 = await hash.digest()

      expect(result1).not.toEqual(result2)
    })
  })
})
