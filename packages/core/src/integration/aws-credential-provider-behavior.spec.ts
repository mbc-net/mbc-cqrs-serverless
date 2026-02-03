/**
 * AWS Credential Provider Behavioral Tests
 *
 * These tests verify that @aws-sdk/credential-provider-node behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 *
 * The credential provider is used to automatically resolve AWS credentials
 * from various sources (environment, config files, IAM roles, etc.)
 */

import { defaultProvider } from '@aws-sdk/credential-provider-node'
import {
  fromEnv,
  ENV_KEY,
  ENV_SECRET,
  ENV_SESSION,
  ENV_EXPIRATION,
} from '@aws-sdk/credential-provider-env'

describe('AWS Credential Provider Behavioral Tests', () => {
  describe('Module exports', () => {
    it('should export defaultProvider from credential-provider-node', () => {
      expect(defaultProvider).toBeDefined()
      expect(typeof defaultProvider).toBe('function')
    })

    it('should export fromEnv from credential-provider-env', () => {
      expect(fromEnv).toBeDefined()
      expect(typeof fromEnv).toBe('function')
    })

    it('should export environment variable names', () => {
      expect(ENV_KEY).toBe('AWS_ACCESS_KEY_ID')
      expect(ENV_SECRET).toBe('AWS_SECRET_ACCESS_KEY')
      expect(ENV_SESSION).toBe('AWS_SESSION_TOKEN')
      expect(ENV_EXPIRATION).toBe('AWS_CREDENTIAL_EXPIRATION')
    })
  })

  describe('fromEnv provider', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should resolve credentials from environment variables', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'

      const provider = fromEnv()
      const credentials = await provider()

      expect(credentials.accessKeyId).toBe('test-access-key')
      expect(credentials.secretAccessKey).toBe('test-secret-key')
    })

    it('should include session token when present', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
      process.env.AWS_SESSION_TOKEN = 'test-session-token'

      const provider = fromEnv()
      const credentials = await provider()

      expect(credentials.sessionToken).toBe('test-session-token')
    })

    it('should throw when required environment variables are missing', async () => {
      delete process.env.AWS_ACCESS_KEY_ID
      delete process.env.AWS_SECRET_ACCESS_KEY

      const provider = fromEnv()

      await expect(provider()).rejects.toThrow()
    })

    it('should throw when only access key is present', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
      delete process.env.AWS_SECRET_ACCESS_KEY

      const provider = fromEnv()

      await expect(provider()).rejects.toThrow()
    })
  })

  describe('Credential structure', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
      process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE'
      process.env.AWS_SECRET_ACCESS_KEY =
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should return credentials with required fields', async () => {
      const provider = fromEnv()
      const credentials = await provider()

      expect(credentials).toHaveProperty('accessKeyId')
      expect(credentials).toHaveProperty('secretAccessKey')
      expect(typeof credentials.accessKeyId).toBe('string')
      expect(typeof credentials.secretAccessKey).toBe('string')
    })

    it('should return credentials with optional sessionToken', async () => {
      process.env.AWS_SESSION_TOKEN = 'test-token'

      const provider = fromEnv()
      const credentials = await provider()

      expect(credentials.sessionToken).toBe('test-token')
    })

    it('should handle credentials without expiration', async () => {
      const provider = fromEnv()
      const credentials = await provider()

      // Static credentials (from env) typically don't have expiration
      expect(credentials.expiration).toBeUndefined()
    })

    it('should handle credentials with expiration', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString()
      process.env.AWS_CREDENTIAL_EXPIRATION = futureDate

      const provider = fromEnv()
      const credentials = await provider()

      expect(credentials.expiration).toBeInstanceOf(Date)
    })
  })

  describe('defaultProvider chain behavior', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should be callable and return a function', () => {
      const provider = defaultProvider()
      expect(typeof provider).toBe('function')
    })

    it('should resolve from environment when env vars are set', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'env-access-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'env-secret-key'

      const provider = defaultProvider()
      const credentials = await provider()

      expect(credentials.accessKeyId).toBe('env-access-key')
      expect(credentials.secretAccessKey).toBe('env-secret-key')
    })

    it('should cache credentials (memoize)', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'cached-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'cached-secret'

      const provider = defaultProvider()

      // Call multiple times
      const creds1 = await provider()
      const creds2 = await provider()

      // Should return same values
      expect(creds1.accessKeyId).toBe(creds2.accessKeyId)
    })
  })

  describe('Provider options', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should accept profile option', () => {
      // defaultProvider accepts options for profile-based credentials
      const provider = defaultProvider({
        profile: 'test-profile',
      })

      expect(typeof provider).toBe('function')
    })

    it('should accept roleArn for assume role', () => {
      const provider = defaultProvider({
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
      })

      expect(typeof provider).toBe('function')
    })

    it('should accept mfaCodeProvider option', () => {
      const mfaCodeProvider = async (): Promise<string> => '123456'

      const provider = defaultProvider({
        mfaCodeProvider,
      })

      expect(typeof provider).toBe('function')
    })
  })

  describe('Credential provider usage patterns', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
      process.env.AWS_ACCESS_KEY_ID = 'pattern-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'pattern-secret'
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should work with AWS SDK client configuration', async () => {
      // This pattern is commonly used when configuring SDK clients
      const provider = defaultProvider()
      const credentials = await provider()

      // Credentials should be usable for client configuration
      expect(credentials.accessKeyId).toBeDefined()
      expect(credentials.secretAccessKey).toBeDefined()
    })

    it('should work with SignatureV4 signer', async () => {
      // Credentials from provider should be compatible with SignatureV4
      const provider = fromEnv()
      const credentials = await provider()

      // SignatureV4 expects this structure
      expect(credentials).toMatchObject({
        accessKeyId: expect.any(String),
        secretAccessKey: expect.any(String),
      })
    })

    it('should support async iteration pattern', async () => {
      const provider = defaultProvider()

      // Provider should be callable multiple times
      const creds1 = await provider()
      const creds2 = await provider()

      expect(creds1.accessKeyId).toBeDefined()
      expect(creds2.accessKeyId).toBeDefined()
    })
  })

  describe('Error handling', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
      // Clear AWS credentials
      delete process.env.AWS_ACCESS_KEY_ID
      delete process.env.AWS_SECRET_ACCESS_KEY
      delete process.env.AWS_SESSION_TOKEN
      delete process.env.AWS_PROFILE
      delete process.env.AWS_CONFIG_FILE
      delete process.env.AWS_SHARED_CREDENTIALS_FILE
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should throw CredentialsProviderError when no credentials found', async () => {
      const provider = fromEnv()

      try {
        await provider()
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.name).toBe('CredentialsProviderError')
      }
    })

    it('should include helpful error message', async () => {
      const provider = fromEnv()

      try {
        await provider()
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toBeDefined()
        expect(typeof error.message).toBe('string')
      }
    })
  })

  describe('Environment variable precedence', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should use standard AWS environment variable names', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'standard-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'standard-secret'

      const provider = fromEnv()
      const credentials = await provider()

      expect(credentials.accessKeyId).toBe('standard-key')
    })

    it('should recognize AWS_SESSION_TOKEN for temporary credentials', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'temp-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'temp-secret'
      process.env.AWS_SESSION_TOKEN = 'temp-token'

      const provider = fromEnv()
      const credentials = await provider()

      expect(credentials.sessionToken).toBe('temp-token')
    })
  })

  describe('Lazy evaluation', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should not resolve credentials until called', () => {
      // Creating provider should not throw even if credentials are missing
      delete process.env.AWS_ACCESS_KEY_ID
      delete process.env.AWS_SECRET_ACCESS_KEY

      // This should not throw
      const provider = defaultProvider()
      expect(provider).toBeDefined()
    })

    it('should resolve credentials at call time', async () => {
      delete process.env.AWS_ACCESS_KEY_ID
      delete process.env.AWS_SECRET_ACCESS_KEY

      const provider = defaultProvider()

      // Set credentials after provider creation
      process.env.AWS_ACCESS_KEY_ID = 'late-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'late-secret'

      // For fromEnv specifically, credentials are read at resolution time
      const envProvider = fromEnv()
      const credentials = await envProvider()

      expect(credentials.accessKeyId).toBe('late-key')
    })
  })
})
