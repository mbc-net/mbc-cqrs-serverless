/**
 * Package Version Contract Tests
 *
 * These tests verify that external package versions are within expected ranges.
 * When a dependency version changes unexpectedly, these tests will fail,
 * alerting us to review the changes for potential breaking changes.
 */

describe('Package Version Contracts', () => {
  describe('AWS SDK', () => {
    it('should use AWS SDK v3.x for DynamoDB client', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@aws-sdk/client-dynamodb/package.json')
      expect(pkg.version).toMatch(/^3\./)
    })

    it('should use AWS SDK v3.x for util-dynamodb', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@aws-sdk/util-dynamodb/package.json')
      expect(pkg.version).toMatch(/^3\./)
    })

    it('should use AWS SDK v3.x for S3 client', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@aws-sdk/client-s3/package.json')
      expect(pkg.version).toMatch(/^3\./)
    })

    it('should use AWS SDK v3.x for SQS client', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@aws-sdk/client-sqs/package.json')
      expect(pkg.version).toMatch(/^3\./)
    })

    it('should use AWS SDK v3.x for SNS client', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@aws-sdk/client-sns/package.json')
      expect(pkg.version).toMatch(/^3\./)
    })

    it('should use AWS SDK v3.x for Step Functions client', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@aws-sdk/client-sfn/package.json')
      expect(pkg.version).toMatch(/^3\./)
    })
  })

  describe('NestJS', () => {
    it('should use NestJS v10.x for @nestjs/common', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@nestjs/common/package.json')
      expect(pkg.version).toMatch(/^10\./)
    })

    it('should use NestJS v10.x for @nestjs/core', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@nestjs/core/package.json')
      expect(pkg.version).toMatch(/^10\./)
    })
  })

  describe('class-transformer', () => {
    it('should use class-transformer v0.5.x', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('class-transformer/package.json')
      expect(pkg.version).toMatch(/^0\.5\./)
    })
  })

  describe('class-validator', () => {
    it('should use class-validator v0.14.x', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('class-validator/package.json')
      expect(pkg.version).toMatch(/^0\.14\./)
    })
  })

  describe('rxjs', () => {
    it('should use rxjs v7.x', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('rxjs/package.json')
      expect(pkg.version).toMatch(/^7\./)
    })
  })
})
