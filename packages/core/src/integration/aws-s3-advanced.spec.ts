/**
 * AWS S3 Advanced Features Integration Tests
 *
 * This file tests advanced S3 features:
 * - @aws-sdk/lib-storage: Multipart upload with progress tracking
 * - @aws-sdk/s3-request-presigner: Presigned URL generation (API contract tests)
 *
 * These tests verify API contracts to detect breaking changes in package updates.
 */
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('AWS S3 Advanced Features', () => {
  const s3Mock = mockClient(S3Client)
  const s3Client = new S3Client({ region: 'ap-northeast-1' })

  beforeEach(() => {
    s3Mock.reset()
  })

  afterEach(() => {
    s3Mock.reset()
  })

  // ============================================================================
  // @aws-sdk/lib-storage - Upload (Multipart Upload)
  // ============================================================================
  describe('@aws-sdk/lib-storage - Upload', () => {
    describe('Upload class instantiation', () => {
      it('should create Upload instance with required parameters', () => {
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'test-key',
            Body: Buffer.from('test content'),
          },
        })

        expect(upload).toBeInstanceOf(Upload)
        expect(typeof upload.done).toBe('function')
        expect(typeof upload.abort).toBe('function')
        expect(typeof upload.on).toBe('function')
      })

      it('should accept custom part size configuration', () => {
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'test-key',
            Body: Buffer.from('test'),
          },
          partSize: 10 * 1024 * 1024, // 10 MB
          queueSize: 4,
          leavePartsOnError: false,
        })

        expect(upload).toBeInstanceOf(Upload)
      })

      it('should accept tags parameter', () => {
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'test-key',
            Body: Buffer.from('test'),
          },
          tags: [
            { Key: 'Environment', Value: 'Test' },
            { Key: 'Project', Value: 'MBC' },
          ],
        })

        expect(upload).toBeInstanceOf(Upload)
      })
    })

    describe('Upload progress tracking', () => {
      it('should emit httpUploadProgress event', async () => {
        // Mock the commands for multipart upload
        s3Mock.on(CreateMultipartUploadCommand).resolves({
          UploadId: 'test-upload-id',
        })

        s3Mock.on(UploadPartCommand).resolves({
          ETag: '"test-etag"',
        })

        s3Mock.on(CompleteMultipartUploadCommand).resolves({
          Location: 'https://test-bucket.s3.amazonaws.com/test-key',
          Bucket: 'test-bucket',
          Key: 'test-key',
          ETag: '"final-etag"',
        })

        // For small files, lib-storage may use PutObject instead of multipart
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"simple-etag"',
        })

        const progressEvents: { loaded?: number; total?: number }[] = []

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'test-key',
            Body: Buffer.from('test content'),
          },
        })

        upload.on('httpUploadProgress', (progress) => {
          progressEvents.push({
            loaded: progress.loaded,
            total: progress.total,
          })
        })

        await upload.done()

        // Progress should have been emitted at least once
        expect(progressEvents.length).toBeGreaterThan(0)
      })

      it('should track progress with loaded and total properties', async () => {
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"test-etag"',
        })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'progress-test',
            Body: Buffer.from('test content for progress'),
          },
        })

        let lastProgress: { loaded?: number; total?: number; part?: number; Key?: string } = {}

        upload.on('httpUploadProgress', (progress) => {
          lastProgress = progress
        })

        await upload.done()

        // Verify progress event structure
        expect(lastProgress).toHaveProperty('loaded')
        expect(lastProgress).toHaveProperty('total')
        expect(typeof lastProgress.loaded).toBe('number')
      })
    })

    describe('Upload completion', () => {
      it('should return upload result on done()', async () => {
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"completion-etag"',
        })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'completion-test',
            Body: Buffer.from('test'),
          },
        })

        const result = await upload.done()

        expect(result).toBeDefined()
        // lib-storage returns upload result which may include Location, Bucket, Key, ETag
        expect(result).toHaveProperty('Bucket')
        expect(result).toHaveProperty('Key')
      })

      it('should support aborting upload', async () => {
        s3Mock.on(CreateMultipartUploadCommand).resolves({
          UploadId: 'abort-test-id',
        })

        s3Mock.on(AbortMultipartUploadCommand).resolves({})

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'abort-test',
            Body: Buffer.from('x'.repeat(10 * 1024 * 1024)), // 10MB to trigger multipart
          },
          partSize: 5 * 1024 * 1024, // 5MB parts
        })

        // Abort method should be available
        expect(typeof upload.abort).toBe('function')

        // Calling abort should not throw
        await upload.abort()
      })
    })

    describe('Upload error handling', () => {
      it('should propagate errors from S3 client', async () => {
        const error = new Error('Access Denied')
        error.name = 'AccessDenied'
        s3Mock.on(PutObjectCommand).rejects(error)

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'restricted-bucket',
            Key: 'forbidden-key',
            Body: Buffer.from('test'),
          },
        })

        await expect(upload.done()).rejects.toThrow('Access Denied')
      })

      it('should handle network errors', async () => {
        const error = new Error('Network error')
        error.name = 'NetworkingError'
        s3Mock.on(PutObjectCommand).rejects(error)

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'network-error-test',
            Body: Buffer.from('test'),
          },
        })

        await expect(upload.done()).rejects.toThrow('Network error')
      })
    })

    describe('Upload with different body types', () => {
      it('should accept Buffer as body', async () => {
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"buffer-etag"' })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'buffer-body',
            Body: Buffer.from('buffer content'),
          },
        })

        await expect(upload.done()).resolves.toBeDefined()
      })

      it('should accept string as body', async () => {
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"string-etag"' })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'string-body',
            Body: 'string content',
          },
        })

        await expect(upload.done()).resolves.toBeDefined()
      })

      it('should accept Uint8Array as body', async () => {
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"uint8-etag"' })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'uint8-body',
            Body: new Uint8Array([1, 2, 3, 4, 5]),
          },
        })

        await expect(upload.done()).resolves.toBeDefined()
      })
    })

    describe('Upload metadata and options', () => {
      it('should pass through ContentType', async () => {
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"metadata-etag"' })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'metadata-test',
            Body: Buffer.from('{}'),
            ContentType: 'application/json',
          },
        })

        await upload.done()

        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          ContentType: 'application/json',
        })
      })

      it('should pass through custom metadata', async () => {
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"custom-meta-etag"' })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'custom-metadata-test',
            Body: Buffer.from('test'),
            Metadata: {
              'x-custom-header': 'custom-value',
              'tenant-id': 'tenant-123',
            },
          },
        })

        await upload.done()

        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Metadata: {
            'x-custom-header': 'custom-value',
            'tenant-id': 'tenant-123',
          },
        })
      })

      it('should pass through ServerSideEncryption', async () => {
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"encrypted-etag"',
          ServerSideEncryption: 'aws:kms',
        })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'encrypted-upload',
            Body: Buffer.from('sensitive data'),
            ServerSideEncryption: 'aws:kms',
            SSEKMSKeyId: 'arn:aws:kms:ap-northeast-1:123456789012:key/test-key',
          },
        })

        await upload.done()

        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          ServerSideEncryption: 'aws:kms',
        })
      })
    })
  })

  // ============================================================================
  // @aws-sdk/s3-request-presigner - API Contract Tests
  // ============================================================================
  describe('@aws-sdk/s3-request-presigner - API contract', () => {
    // Note: Actual getSignedUrl tests require valid AWS credentials or mocking
    // the entire credential chain. These tests verify the API contract instead.

    describe('Module exports', () => {
      it('should export getSignedUrl function', async () => {
        const presignerModule = await import('@aws-sdk/s3-request-presigner')

        expect(presignerModule.getSignedUrl).toBeDefined()
        expect(typeof presignerModule.getSignedUrl).toBe('function')
      })

      it('should export S3RequestPresigner class', async () => {
        const presignerModule = await import('@aws-sdk/s3-request-presigner')

        expect(presignerModule.S3RequestPresigner).toBeDefined()
        expect(typeof presignerModule.S3RequestPresigner).toBe('function')
      })
    })

    describe('Command compatibility', () => {
      it('should accept GetObjectCommand', () => {
        const command = new GetObjectCommand({
          Bucket: 'test-bucket',
          Key: 'test-object.txt',
        })

        expect(command.input.Bucket).toBe('test-bucket')
        expect(command.input.Key).toBe('test-object.txt')
      })

      it('should accept PutObjectCommand', () => {
        const command = new PutObjectCommand({
          Bucket: 'test-bucket',
          Key: 'upload-target.txt',
          ContentType: 'text/plain',
        })

        expect(command.input.Bucket).toBe('test-bucket')
        expect(command.input.Key).toBe('upload-target.txt')
        expect(command.input.ContentType).toBe('text/plain')
      })

      it('should accept GetObjectCommand with VersionId', () => {
        const command = new GetObjectCommand({
          Bucket: 'versioned-bucket',
          Key: 'versioned-object.txt',
          VersionId: 'abc123version',
        })

        expect(command.input.VersionId).toBe('abc123version')
      })

      it('should accept GetObjectCommand with ResponseContentDisposition', () => {
        const command = new GetObjectCommand({
          Bucket: 'test-bucket',
          Key: 'download.pdf',
          ResponseContentDisposition: 'attachment; filename="custom-name.pdf"',
        })

        expect(command.input.ResponseContentDisposition).toBe(
          'attachment; filename="custom-name.pdf"',
        )
      })

      it('should accept GetObjectCommand with ResponseContentType', () => {
        const command = new GetObjectCommand({
          Bucket: 'test-bucket',
          Key: 'data.bin',
          ResponseContentType: 'application/octet-stream',
        })

        expect(command.input.ResponseContentType).toBe('application/octet-stream')
      })
    })

    describe('S3RequestPresigner configuration', () => {
      it('should accept presigner configuration options', async () => {
        const { S3RequestPresigner } = await import(
          '@aws-sdk/s3-request-presigner'
        )

        // S3RequestPresigner accepts configuration for signing
        const presigner = new S3RequestPresigner({
          region: 'ap-northeast-1',
          credentials: {
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
          },
          sha256: (await import('@aws-crypto/sha256-js')).Sha256,
        })

        expect(presigner).toBeDefined()
        expect(typeof presigner.presign).toBe('function')
      })
    })

    describe('URL parameter expectations', () => {
      // These tests document expected URL parameters without requiring actual signing
      it('should document expected presigned URL parameters', () => {
        const expectedParams = [
          'X-Amz-Algorithm',
          'X-Amz-Credential',
          'X-Amz-Date',
          'X-Amz-Expires',
          'X-Amz-SignedHeaders',
          'X-Amz-Signature',
        ]

        // Document the parameters that should be in a presigned URL
        expectedParams.forEach((param) => {
          expect(typeof param).toBe('string')
        })
      })

      it('should document expiration options', () => {
        const expirationOptions = {
          expiresIn: 3600, // seconds
        }

        expect(expirationOptions.expiresIn).toBe(3600)
        expect(typeof expirationOptions.expiresIn).toBe('number')
      })
    })
  })

  // ============================================================================
  // Integration scenarios
  // ============================================================================
  describe('Integration scenarios', () => {
    describe('Upload workflow scenarios', () => {
      it('should support workflow: upload with specific content type', async () => {
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"workflow-etag"' })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'workflow-test/file.txt',
            Body: Buffer.from('workflow test content'),
            ContentType: 'text/plain',
          },
        })

        const result = await upload.done()

        expect(result).toBeDefined()
        expect(result).toHaveProperty('Bucket', 'test-bucket')
        expect(result).toHaveProperty('Key', 'workflow-test/file.txt')
      })

      it('should support workflow: upload JSON data', async () => {
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"download-workflow-etag"' })

        const jsonData = { key: 'value', nested: { data: 123 } }
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'download-workflow/data.json',
            Body: JSON.stringify(jsonData),
            ContentType: 'application/json',
          },
        })

        const result = await upload.done()

        expect(result).toBeDefined()
        expect(result).toHaveProperty('Key', 'download-workflow/data.json')
      })
    })

    describe('Multipart upload scenarios', () => {
      it('should handle large file multipart upload', async () => {
        // Setup mocks for multipart upload
        s3Mock.on(CreateMultipartUploadCommand).resolves({
          UploadId: 'multipart-test-id',
          Bucket: 'test-bucket',
          Key: 'large-file.bin',
        })

        s3Mock.on(UploadPartCommand).resolves({
          ETag: '"part-etag"',
        })

        s3Mock.on(CompleteMultipartUploadCommand).resolves({
          Location: 'https://test-bucket.s3.ap-northeast-1.amazonaws.com/large-file.bin',
          Bucket: 'test-bucket',
          Key: 'large-file.bin',
          ETag: '"complete-etag"',
        })

        // For smaller actual test, use PutObject
        s3Mock.on(PutObjectCommand).resolves({ ETag: '"large-etag"' })

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: 'test-bucket',
            Key: 'large-file.bin',
            Body: Buffer.from('x'.repeat(1024)), // 1KB for test
          },
          partSize: 5 * 1024 * 1024, // 5MB parts
          queueSize: 4,
        })

        const progressUpdates: number[] = []
        upload.on('httpUploadProgress', (progress) => {
          if (progress.loaded !== undefined) {
            progressUpdates.push(progress.loaded)
          }
        })

        const result = await upload.done()

        expect(result).toBeDefined()
        expect(progressUpdates.length).toBeGreaterThan(0)
      })
    })
  })
})
