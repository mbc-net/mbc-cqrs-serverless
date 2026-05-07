/**
 * AWS Signature V4 Behavioral Tests
 *
 * These tests verify that @aws-sdk/signature-v4 behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 *
 * SignatureV4 is used for signing AWS API requests, particularly
 * for AppSync GraphQL endpoints that require IAM authentication.
 */

import { SignatureV4 } from '@aws-sdk/signature-v4'
import { Sha256 } from '@aws-crypto/sha256-js'
import { HttpRequest } from '@smithy/protocol-http'

describe('AWS Signature V4 Behavioral Tests', () => {
  describe('Module exports', () => {
    it('should export SignatureV4 class', () => {
      expect(SignatureV4).toBeDefined()
      expect(typeof SignatureV4).toBe('function')
    })
  })

  describe('SignatureV4 instantiation', () => {
    it('should create signer with required config', () => {
      const signer = new SignatureV4({
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        region: 'us-east-1',
        service: 'appsync',
        sha256: Sha256,
      })

      expect(signer).toBeInstanceOf(SignatureV4)
    })

    it('should create signer with session token', () => {
      const signer = new SignatureV4({
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          sessionToken: 'AQoDYXdzEJr...',
        },
        region: 'ap-northeast-1',
        service: 'appsync',
        sha256: Sha256,
      })

      expect(signer).toBeInstanceOf(SignatureV4)
    })

    it('should create signer for different AWS services', () => {
      const services = ['appsync', 'execute-api', 's3', 'dynamodb', 'lambda']

      for (const service of services) {
        const signer = new SignatureV4({
          credentials: {
            accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
            secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          },
          region: 'us-east-1',
          service,
          sha256: Sha256,
        })

        expect(signer).toBeInstanceOf(SignatureV4)
      }
    })
  })

  describe('Request signing', () => {
    let signer: SignatureV4

    beforeEach(() => {
      signer = new SignatureV4({
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        region: 'ap-northeast-1',
        service: 'appsync',
        sha256: Sha256,
      })
    })

    it('should sign a basic GET request', async () => {
      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        },
      })

      const signedRequest = await signer.sign(request)

      expect(signedRequest.headers).toBeDefined()
      expect(signedRequest.headers['authorization']).toBeDefined()
      expect(signedRequest.headers['x-amz-date']).toBeDefined()
    })

    it('should sign a POST request with body', async () => {
      const body = JSON.stringify({
        query: '{ listItems { id name } }',
      })

      const request = new HttpRequest({
        method: 'POST',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
          'content-type': 'application/json',
        },
        body,
      })

      const signedRequest = await signer.sign(request)

      expect(signedRequest.headers['authorization']).toBeDefined()
      expect(signedRequest.headers['authorization']).toContain('AWS4-HMAC-SHA256')
      expect(signedRequest.headers['authorization']).toContain('Credential=')
      expect(signedRequest.headers['authorization']).toContain('SignedHeaders=')
      expect(signedRequest.headers['authorization']).toContain('Signature=')
    })

    it('should include x-amz-date header in signed request', async () => {
      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        },
      })

      const signedRequest = await signer.sign(request)

      expect(signedRequest.headers['x-amz-date']).toBeDefined()
      // x-amz-date format: YYYYMMDDTHHMMSSZ
      expect(signedRequest.headers['x-amz-date']).toMatch(
        /^\d{8}T\d{6}Z$/,
      )
    })

    it('should produce consistent signatures for same request', async () => {
      const request1 = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        },
      })

      const request2 = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        },
      })

      // Sign with same signing date to ensure consistency
      const signingDate = new Date('2024-01-15T12:00:00Z')

      const signed1 = await signer.sign(request1, { signingDate })
      const signed2 = await signer.sign(request2, { signingDate })

      expect(signed1.headers['authorization']).toBe(
        signed2.headers['authorization'],
      )
    })

    it('should produce different signatures for different requests', async () => {
      const signingDate = new Date('2024-01-15T12:00:00Z')

      const request1 = new HttpRequest({
        method: 'POST',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
          'content-type': 'application/json',
        },
        body: '{"query": "query1"}',
      })

      const request2 = new HttpRequest({
        method: 'POST',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
          'content-type': 'application/json',
        },
        body: '{"query": "query2"}',
      })

      const signed1 = await signer.sign(request1, { signingDate })
      const signed2 = await signer.sign(request2, { signingDate })

      expect(signed1.headers['authorization']).not.toBe(
        signed2.headers['authorization'],
      )
    })
  })

  describe('Authorization header structure', () => {
    let signer: SignatureV4

    beforeEach(() => {
      signer = new SignatureV4({
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        region: 'ap-northeast-1',
        service: 'appsync',
        sha256: Sha256,
      })
    })

    it('should use AWS4-HMAC-SHA256 algorithm', async () => {
      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        },
      })

      const signedRequest = await signer.sign(request)
      const auth = signedRequest.headers['authorization']

      expect(auth).toMatch(/^AWS4-HMAC-SHA256/)
    })

    it('should include correct credential scope', async () => {
      const signingDate = new Date('2024-01-15T12:00:00Z')

      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        },
      })

      const signedRequest = await signer.sign(request, { signingDate })
      const auth = signedRequest.headers['authorization']

      // Credential format: AKID/date/region/service/aws4_request
      expect(auth).toContain('AKIAIOSFODNN7EXAMPLE')
      expect(auth).toContain('20240115')
      expect(auth).toContain('ap-northeast-1')
      expect(auth).toContain('appsync')
      expect(auth).toContain('aws4_request')
    })

    it('should include SignedHeaders', async () => {
      const request = new HttpRequest({
        method: 'POST',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
          'content-type': 'application/json',
        },
        body: '{}',
      })

      const signedRequest = await signer.sign(request)
      const auth = signedRequest.headers['authorization']

      expect(auth).toContain('SignedHeaders=')
      expect(auth).toContain('host')
    })

    it('should include 64-character hex signature', async () => {
      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.ap-northeast-1.amazonaws.com',
        },
      })

      const signedRequest = await signer.sign(request)
      const auth = signedRequest.headers['authorization']

      // Extract signature from authorization header
      const signatureMatch = auth.match(/Signature=([a-f0-9]+)/)
      expect(signatureMatch).not.toBeNull()
      expect(signatureMatch![1]).toHaveLength(64) // SHA256 produces 64 hex chars
    })
  })

  describe('Session token handling', () => {
    it('should include x-amz-security-token when session token is provided', async () => {
      const signer = new SignatureV4({
        credentials: {
          accessKeyId: 'ASIAXXX',
          secretAccessKey: 'secretXXX',
          sessionToken: 'session-token-value',
        },
        region: 'us-east-1',
        service: 'appsync',
        sha256: Sha256,
      })

      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.us-east-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.us-east-1.amazonaws.com',
        },
      })

      const signedRequest = await signer.sign(request)

      expect(signedRequest.headers['x-amz-security-token']).toBe(
        'session-token-value',
      )
    })

    it('should not include x-amz-security-token when no session token', async () => {
      const signer = new SignatureV4({
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        region: 'us-east-1',
        service: 'appsync',
        sha256: Sha256,
      })

      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'example.appsync-api.us-east-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'example.appsync-api.us-east-1.amazonaws.com',
        },
      })

      const signedRequest = await signer.sign(request)

      expect(signedRequest.headers['x-amz-security-token']).toBeUndefined()
    })
  })

  describe('Request with query parameters', () => {
    let signer: SignatureV4

    beforeEach(() => {
      signer = new SignatureV4({
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        region: 'us-east-1',
        service: 'execute-api',
        sha256: Sha256,
      })
    })

    it('should sign request with query string', async () => {
      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'api.example.com',
        path: '/items',
        query: {
          limit: '10',
          offset: '0',
        },
        headers: {
          host: 'api.example.com',
        },
      })

      const signedRequest = await signer.sign(request)

      expect(signedRequest.headers['authorization']).toBeDefined()
    })

    it('should produce different signatures for different query parameters', async () => {
      const signingDate = new Date('2024-01-15T12:00:00Z')

      const request1 = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'api.example.com',
        path: '/items',
        query: { limit: '10' },
        headers: { host: 'api.example.com' },
      })

      const request2 = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: 'api.example.com',
        path: '/items',
        query: { limit: '20' },
        headers: { host: 'api.example.com' },
      })

      const signed1 = await signer.sign(request1, { signingDate })
      const signed2 = await signer.sign(request2, { signingDate })

      expect(signed1.headers['authorization']).not.toBe(
        signed2.headers['authorization'],
      )
    })
  })

  describe('Real-world AppSync signing pattern', () => {
    it('should sign AppSync GraphQL request', async () => {
      const signer = new SignatureV4({
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        region: 'ap-northeast-1',
        service: 'appsync',
        sha256: Sha256,
      })

      const graphqlQuery = {
        query: `
          mutation PublishEvent($input: EventInput!) {
            publishEvent(input: $input) {
              id
              timestamp
            }
          }
        `,
        variables: {
          input: {
            type: 'USER_CREATED',
            payload: JSON.stringify({ userId: '123' }),
          },
        },
      }

      const request = new HttpRequest({
        method: 'POST',
        protocol: 'https:',
        hostname: 'xxxxx.appsync-api.ap-northeast-1.amazonaws.com',
        path: '/graphql',
        headers: {
          host: 'xxxxx.appsync-api.ap-northeast-1.amazonaws.com',
          'content-type': 'application/json',
        },
        body: JSON.stringify(graphqlQuery),
      })

      const signedRequest = await signer.sign(request)

      // Verify all required headers are present
      expect(signedRequest.headers['authorization']).toBeDefined()
      expect(signedRequest.headers['x-amz-date']).toBeDefined()
      expect(signedRequest.headers['host']).toBeDefined()

      // Verify authorization format
      expect(signedRequest.headers['authorization']).toContain('AWS4-HMAC-SHA256')
      expect(signedRequest.headers['authorization']).toContain('appsync')
    })
  })

  describe('HttpRequest construction', () => {
    it('should export HttpRequest from @smithy/protocol-http', () => {
      expect(HttpRequest).toBeDefined()
      expect(typeof HttpRequest).toBe('function')
    })

    it('should create valid HttpRequest object', () => {
      const request = new HttpRequest({
        method: 'POST',
        protocol: 'https:',
        hostname: 'api.example.com',
        port: 443,
        path: '/resource',
        query: { key: 'value' },
        headers: {
          host: 'api.example.com',
          'content-type': 'application/json',
        },
        body: '{"data": "test"}',
      })

      expect(request.method).toBe('POST')
      expect(request.protocol).toBe('https:')
      expect(request.hostname).toBe('api.example.com')
      expect(request.path).toBe('/resource')
      expect(request.headers['content-type']).toBe('application/json')
      expect(request.body).toBe('{"data": "test"}')
    })
  })
})
