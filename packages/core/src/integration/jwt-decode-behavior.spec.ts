/**
 * jwt-decode Behavioral Tests
 *
 * These tests verify that jwt-decode behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 *
 * jwt-decode is used for decoding JWT tokens to extract user information
 * from Cognito authentication tokens.
 */

import { jwtDecode, InvalidTokenError, JwtPayload } from 'jwt-decode'

// Extended JWT payload for testing custom claims
interface TestJwtPayload extends JwtPayload {
  name?: string
  email?: string
  email_verified?: boolean
  phone_number_verified?: boolean
  groups?: string[]
  roles?: string[]
  user?: {
    id: string
    profile: {
      name: string
      age: number
    }
  }
  data?: string
  emoji?: string
  mixed?: string
  'cognito:groups'?: string[]
  'cognito:username'?: string
  'custom:attribute'?: string
  'http://example.com/claim'?: string
  'urn:example:claim'?: string
  token_use?: string
  scope?: string
  username?: string
  auth_time?: number
}

describe('jwt-decode Behavioral Tests', () => {
  // Create a simple test JWT token (header.payload.signature)
  // Note: This is NOT a cryptographically valid token, but jwt-decode
  // only decodes the payload without verification
  const createTestToken = (payload: object): string => {
    const header = { alg: 'HS256', typ: 'JWT' }
    const base64UrlEncode = (obj: object): string => {
      const json = JSON.stringify(obj)
      const base64 = Buffer.from(json).toString('base64')
      // Convert to base64url format
      return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    }
    const headerEncoded = base64UrlEncode(header)
    const payloadEncoded = base64UrlEncode(payload)
    const signature = 'test-signature' // jwt-decode doesn't verify signature
    return `${headerEncoded}.${payloadEncoded}.${signature}`
  }

  describe('Module exports', () => {
    it('should export jwtDecode function', () => {
      expect(typeof jwtDecode).toBe('function')
    })

    it('should export InvalidTokenError', () => {
      expect(InvalidTokenError).toBeDefined()
      expect(typeof InvalidTokenError).toBe('function')
    })
  })

  describe('Basic token decoding', () => {
    it('should decode a simple JWT payload', () => {
      const payload = {
        sub: 'user123',
        name: 'Test User',
        email: 'test@example.com',
      }
      const token = createTestToken(payload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded).toMatchObject(payload)
    })

    it('should decode Cognito-style token payload', () => {
      const cognitoPayload = {
        sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'cognito:groups': ['admin', 'users'],
        'cognito:username': 'testuser',
        email_verified: true,
        iss: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxxx',
        origin_jti: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        aud: 'client-id-123',
        event_id: 'event-123',
        token_use: 'id',
        auth_time: 1700000000,
        exp: 1700003600,
        iat: 1700000000,
        email: 'user@example.com',
      }
      const token = createTestToken(cognitoPayload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded).toMatchObject(cognitoPayload)
      expect(decoded['cognito:groups']).toEqual(['admin', 'users'])
      expect(decoded['cognito:username']).toBe('testuser')
    })

    it('should decode numeric values correctly', () => {
      const now = Math.floor(Date.now() / 1000)
      const payload = {
        iat: now,
        exp: now + 3600,
        nbf: now - 60,
        auth_time: now,
      }
      const token = createTestToken(payload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded.iat).toBe(now)
      expect(decoded.exp).toBe(now + 3600)
      expect(decoded.nbf).toBe(now - 60)
    })

    it('should decode boolean values correctly', () => {
      const payload = {
        email_verified: true,
        phone_number_verified: false,
      }
      const token = createTestToken(payload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded.email_verified).toBe(true)
      expect(decoded.phone_number_verified).toBe(false)
    })

    it('should decode array values correctly', () => {
      const payload = {
        groups: ['admin', 'users', 'developers'],
        roles: ['read', 'write'],
      }
      const token = createTestToken(payload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded.groups).toEqual(['admin', 'users', 'developers'])
      expect(decoded.roles).toEqual(['read', 'write'])
    })

    it('should decode nested objects correctly', () => {
      const payload = {
        user: {
          id: '123',
          profile: {
            name: 'Test',
            age: 30,
          },
        },
      }
      const token = createTestToken(payload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded.user).toEqual(payload.user)
    })
  })

  describe('Header decoding', () => {
    it('should decode header when options.header is true', () => {
      const payload = { sub: 'user123' }
      const token = createTestToken(payload)

      const header = jwtDecode(token, { header: true })

      expect(header).toHaveProperty('alg')
      expect(header).toHaveProperty('typ')
      expect(header.alg).toBe('HS256')
      expect(header.typ).toBe('JWT')
    })
  })

  describe('Expiration detection', () => {
    it('should decode tokens with exp claim for manual expiration check', () => {
      const now = Math.floor(Date.now() / 1000)
      const expiredPayload = {
        sub: 'user123',
        exp: now - 3600, // 1 hour ago
      }
      const validPayload = {
        sub: 'user123',
        exp: now + 3600, // 1 hour from now
      }

      const expiredToken = createTestToken(expiredPayload)
      const validToken = createTestToken(validPayload)

      const expiredDecoded = jwtDecode(expiredToken)
      const validDecoded = jwtDecode(validToken)

      // jwt-decode does NOT check expiration - just decodes
      // Application must check exp manually
      expect(expiredDecoded.exp).toBeLessThan(now)
      expect(validDecoded.exp).toBeGreaterThan(now)

      // Manual expiration check
      const isExpired = (exp: number): boolean => exp < now
      expect(isExpired(expiredDecoded.exp as number)).toBe(true)
      expect(isExpired(validDecoded.exp as number)).toBe(false)
    })
  })

  describe('Error handling', () => {
    it('should throw InvalidTokenError for malformed token', () => {
      expect(() => jwtDecode('not-a-jwt')).toThrow(InvalidTokenError)
    })

    it('should throw InvalidTokenError for token with invalid base64', () => {
      expect(() => jwtDecode('invalid.!!!.token')).toThrow(InvalidTokenError)
    })

    it('should throw InvalidTokenError for empty string', () => {
      expect(() => jwtDecode('')).toThrow(InvalidTokenError)
    })

    it('should throw InvalidTokenError for token with only one part', () => {
      expect(() => jwtDecode('onlyonepart')).toThrow(InvalidTokenError)
    })

    it('should handle token with only two parts', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
        'base64',
      )
      const payload = Buffer.from(JSON.stringify({ sub: 'test' })).toString(
        'base64',
      )
      // Note: jwt-decode v4 may accept tokens without signature (2 parts)
      // This test verifies the behavior - it should either throw or decode
      try {
        const decoded = jwtDecode(`${header}.${payload}`)
        // If it doesn't throw, it should have decoded the payload
        expect(decoded).toHaveProperty('sub', 'test')
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidTokenError)
      }
    })

    it('should throw for non-string input', () => {
      expect(() => jwtDecode(null as any)).toThrow()
      expect(() => jwtDecode(undefined as any)).toThrow()
      expect(() => jwtDecode(123 as any)).toThrow()
      expect(() => jwtDecode({} as any)).toThrow()
    })
  })

  describe('Base64URL decoding compatibility', () => {
    it('should handle standard base64 padding', () => {
      // Test that jwt-decode handles base64url encoding properly
      const payload = {
        // Use a value that creates padding in base64
        data: 'ab', // Results in "YWI=" in base64
      }
      const token = createTestToken(payload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded.data).toBe('ab')
    })

    it('should handle unicode characters', () => {
      const payload = {
        name: '日本語テスト',
        emoji: '🎉',
        mixed: 'Hello 世界',
      }
      const token = createTestToken(payload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded.name).toBe('日本語テスト')
      expect(decoded.emoji).toBe('🎉')
      expect(decoded.mixed).toBe('Hello 世界')
    })

    it('should handle special characters in claims', () => {
      const payload = {
        'custom:attribute': 'value',
        'http://example.com/claim': 'custom-claim',
        'urn:example:claim': 'urn-claim',
      }
      const token = createTestToken(payload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded['custom:attribute']).toBe('value')
      expect(decoded['http://example.com/claim']).toBe('custom-claim')
      expect(decoded['urn:example:claim']).toBe('urn-claim')
    })
  })

  describe('Token structure validation', () => {
    it('should decode tokens regardless of signature validity', () => {
      // jwt-decode does NOT verify signatures
      const payload = { sub: 'user123', iat: 1700000000 }
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
        .toString('base64')
        .replace(/=/g, '')
      const payloadEncoded = Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/=/g, '')
      const invalidSignature = 'this-is-not-a-valid-signature'

      const token = `${header}.${payloadEncoded}.${invalidSignature}`

      // Should decode successfully even with invalid signature
      const decoded = jwtDecode(token)
      expect(decoded).toMatchObject(payload)
    })

    it('should handle token with empty signature', () => {
      const payload = { sub: 'user123' }
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
        .toString('base64')
        .replace(/=/g, '')
      const payloadEncoded = Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/=/g, '')

      const token = `${header}.${payloadEncoded}.`

      const decoded = jwtDecode(token)
      expect(decoded).toMatchObject(payload)
    })
  })

  describe('Real-world token patterns', () => {
    it('should decode AWS Cognito ID token structure', () => {
      const cognitoIdTokenPayload = {
        at_hash: 'abcdef123456',
        sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'cognito:groups': ['admin'],
        email_verified: true,
        iss: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_Example',
        'cognito:username': 'user@example.com',
        origin_jti: 'orig-jti-123',
        aud: 'client-id',
        event_id: 'event-123',
        token_use: 'id',
        auth_time: 1700000000,
        exp: 1700003600,
        iat: 1700000000,
        jti: 'jti-123',
        email: 'user@example.com',
      }
      const token = createTestToken(cognitoIdTokenPayload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded.token_use).toBe('id')
      expect(decoded['cognito:username']).toBe('user@example.com')
    })

    it('should decode AWS Cognito Access token structure', () => {
      const cognitoAccessTokenPayload = {
        sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'cognito:groups': ['admin'],
        iss: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_Example',
        version: 2,
        client_id: 'client-id',
        origin_jti: 'orig-jti-123',
        event_id: 'event-123',
        token_use: 'access',
        scope: 'openid email profile',
        auth_time: 1700000000,
        exp: 1700003600,
        iat: 1700000000,
        jti: 'jti-123',
        username: 'user@example.com',
      }
      const token = createTestToken(cognitoAccessTokenPayload)

      const decoded = jwtDecode<TestJwtPayload>(token)

      expect(decoded.token_use).toBe('access')
      expect(decoded.scope).toBe('openid email profile')
      expect(decoded.username).toBe('user@example.com')
    })
  })
})
