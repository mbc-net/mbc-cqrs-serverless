/**
 * AWS S3 Client Integration Tests
 *
 * This file tests the AWS SDK S3 client commands using aws-sdk-client-mock.
 * It covers input parameters (IN) and return values (OUT) for each command.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ObjectStorageClass,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { sdkStreamMixin } from '@smithy/util-stream'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'
import { Readable } from 'stream'

describe('AWS S3 Client Commands', () => {
  const s3Mock = mockClient(S3Client)
  const client = new S3Client({ region: 'ap-northeast-1' })

  beforeEach(() => {
    s3Mock.reset()
  })

  afterEach(() => {
    s3Mock.reset()
  })

  // ============================================================================
  // PutObjectCommand Tests
  // ============================================================================
  describe('PutObjectCommand', () => {
    describe('Input Parameters - Bucket, Key, Body', () => {
      it('should send PutObjectCommand with Bucket, Key, and Body', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"abc123def456"',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'path/to/object.json',
          Body: JSON.stringify({ data: 'value' }),
        }

        // Act
        await client.send(new PutObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Bucket: 'test-bucket',
          Key: 'path/to/object.json',
          Body: JSON.stringify({ data: 'value' }),
        })
      })

      it('should send PutObjectCommand with ContentType', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"content-type-etag"',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'document.pdf',
          Body: Buffer.from('PDF content'),
          ContentType: 'application/pdf',
        }

        // Act
        await client.send(new PutObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          ContentType: 'application/pdf',
        })
      })

      it('should send PutObjectCommand with Metadata', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"metadata-etag"',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'object-with-metadata.txt',
          Body: 'Content',
          Metadata: {
            'created-by': 'test-user',
            'tenant-id': 'tenant-123',
            'custom-header': 'custom-value',
          },
        }

        // Act
        await client.send(new PutObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Metadata: {
            'created-by': 'test-user',
            'tenant-id': 'tenant-123',
            'custom-header': 'custom-value',
          },
        })
      })

      it('should send PutObjectCommand with ServerSideEncryption', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"encrypted-etag"',
          ServerSideEncryption: 'aws:kms',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'encrypted-object.dat',
          Body: 'Sensitive data',
          ServerSideEncryption: 'aws:kms' as const,
          SSEKMSKeyId: 'arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012',
        }

        // Act
        await client.send(new PutObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: expect.stringContaining('arn:aws:kms'),
        })
      })

      it('should send PutObjectCommand with ACL', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"acl-etag"',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'public-object.txt',
          Body: 'Public content',
          ACL: 'public-read' as const,
        }

        // Act
        await client.send(new PutObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          ACL: 'public-read',
        })
      })

      it('should send PutObjectCommand with CacheControl', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"cache-etag"',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'static/asset.js',
          Body: 'JavaScript content',
          CacheControl: 'max-age=31536000',
          ContentType: 'application/javascript',
        }

        // Act
        await client.send(new PutObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          CacheControl: 'max-age=31536000',
        })
      })

      it('should send PutObjectCommand with Tagging', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"tagged-etag"',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'tagged-object.txt',
          Body: 'Tagged content',
          Tagging: 'environment=production&team=engineering',
        }

        // Act
        await client.send(new PutObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
          Tagging: 'environment=production&team=engineering',
        })
      })
    })

    describe('Return Values - ETag', () => {
      it('should return ETag on successful put', async () => {
        // Arrange
        const expectedETag = '"abc123def456ghi789"'
        s3Mock.on(PutObjectCommand).resolves({
          ETag: expectedETag,
        })

        // Act
        const result = await client.send(
          new PutObjectCommand({
            Bucket: 'test-bucket',
            Key: 'object.txt',
            Body: 'Content',
          }),
        )

        // Assert
        expect(result.ETag).toBe(expectedETag)
      })

      it('should return VersionId for versioned bucket', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"etag-versioned"',
          VersionId: 'v1.abc123',
        })

        // Act
        const result = await client.send(
          new PutObjectCommand({
            Bucket: 'versioned-bucket',
            Key: 'versioned-object.txt',
            Body: 'Content',
          }),
        )

        // Assert
        expect(result.ETag).toBe('"etag-versioned"')
        expect(result.VersionId).toBe('v1.abc123')
      })

      it('should return ServerSideEncryption info', async () => {
        // Arrange
        s3Mock.on(PutObjectCommand).resolves({
          ETag: '"encrypted-result-etag"',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: 'arn:aws:kms:ap-northeast-1:123456789012:key/key-id',
        })

        // Act
        const result = await client.send(
          new PutObjectCommand({
            Bucket: 'test-bucket',
            Key: 'encrypted.dat',
            Body: 'Data',
            ServerSideEncryption: 'aws:kms',
          }),
        )

        // Assert
        expect(result.ServerSideEncryption).toBe('aws:kms')
        expect(result.SSEKMSKeyId).toContain('arn:aws:kms')
      })
    })

    describe('Error Cases', () => {
      it('should throw NoSuchBucket when bucket does not exist', async () => {
        // Arrange
        const error = new Error('The specified bucket does not exist')
        error.name = 'NoSuchBucket'
        s3Mock.on(PutObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PutObjectCommand({
              Bucket: 'non-existent-bucket',
              Key: 'object.txt',
              Body: 'Content',
            }),
          ),
        ).rejects.toThrow('The specified bucket does not exist')
      })

      it('should throw AccessDenied when not authorized', async () => {
        // Arrange
        const error = new Error('Access Denied')
        error.name = 'AccessDenied'
        s3Mock.on(PutObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PutObjectCommand({
              Bucket: 'restricted-bucket',
              Key: 'object.txt',
              Body: 'Content',
            }),
          ),
        ).rejects.toThrow('Access Denied')
      })

      it('should throw EntityTooLarge for oversized objects', async () => {
        // Arrange
        const error = new Error('Your proposed upload exceeds the maximum allowed object size')
        error.name = 'EntityTooLarge'
        s3Mock.on(PutObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PutObjectCommand({
              Bucket: 'test-bucket',
              Key: 'huge-object.bin',
              Body: Buffer.alloc(1),
            }),
          ),
        ).rejects.toThrow('Your proposed upload exceeds the maximum allowed object size')
      })
    })
  })

  // ============================================================================
  // GetObjectCommand Tests
  // ============================================================================
  describe('GetObjectCommand', () => {
    describe('Input Parameters - Key', () => {
      it('should send GetObjectCommand with Bucket and Key', async () => {
        // Arrange
        const stream = new Readable()
        stream.push('Object content')
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          ContentType: 'text/plain',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'path/to/object.txt',
        }

        // Act
        await client.send(new GetObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
          Bucket: 'test-bucket',
          Key: 'path/to/object.txt',
        })
      })

      it('should send GetObjectCommand with VersionId', async () => {
        // Arrange
        const stream = new Readable()
        stream.push('Version content')
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          VersionId: 'v1.abc123',
        })

        const params = {
          Bucket: 'versioned-bucket',
          Key: 'versioned-object.txt',
          VersionId: 'v1.abc123',
        }

        // Act
        await client.send(new GetObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
          VersionId: 'v1.abc123',
        })
      })

      it('should send GetObjectCommand with Range for partial content', async () => {
        // Arrange
        const stream = new Readable()
        stream.push('Partial')
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          ContentRange: 'bytes 0-99/1000',
          ContentLength: 100,
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'large-file.bin',
          Range: 'bytes=0-99',
        }

        // Act
        await client.send(new GetObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
          Range: 'bytes=0-99',
        })
      })

      it('should send GetObjectCommand with IfModifiedSince', async () => {
        // Arrange
        const stream = new Readable()
        stream.push('Modified content')
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'conditional-object.txt',
          IfModifiedSince: new Date('2024-01-01'),
        }

        // Act
        await client.send(new GetObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
          IfModifiedSince: expect.any(Date),
        })
      })

      it('should send GetObjectCommand with ResponseContentType', async () => {
        // Arrange
        const stream = new Readable()
        stream.push(JSON.stringify({ data: 'value' }))
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          ContentType: 'application/json',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'data.bin',
          ResponseContentType: 'application/json',
        }

        // Act
        await client.send(new GetObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
          ResponseContentType: 'application/json',
        })
      })
    })

    describe('Return Values - Body Stream Reading', () => {
      it('should return Body stream and read content', async () => {
        // Arrange
        const jsonData = { key: 'value', nested: { prop: 123 } }
        const stream = new Readable()
        stream.push(JSON.stringify(jsonData))
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          ContentType: 'application/json',
          ContentLength: JSON.stringify(jsonData).length,
        })

        // Act
        const result = await client.send(
          new GetObjectCommand({
            Bucket: 'test-bucket',
            Key: 'data.json',
          }),
        )

        // Assert
        expect(result.Body).toBeDefined()
        const bodyContent = await result.Body!.transformToString()
        expect(JSON.parse(bodyContent)).toEqual(jsonData)
        expect(result.ContentType).toBe('application/json')
      })

      it('should return metadata with response', async () => {
        // Arrange
        const stream = new Readable()
        stream.push('Content with metadata')
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          Metadata: {
            'created-by': 'test-user',
            'tenant-id': 'tenant-123',
          },
          ContentType: 'text/plain',
          ContentLength: 21,
          LastModified: new Date('2024-01-15T10:30:00Z'),
          ETag: '"metadata-object-etag"',
        })

        // Act
        const result = await client.send(
          new GetObjectCommand({
            Bucket: 'test-bucket',
            Key: 'object-with-metadata.txt',
          }),
        )

        // Assert
        expect(result.Metadata).toEqual({
          'created-by': 'test-user',
          'tenant-id': 'tenant-123',
        })
        expect(result.LastModified).toEqual(new Date('2024-01-15T10:30:00Z'))
        expect(result.ETag).toBe('"metadata-object-etag"')
      })

      it('should handle binary data from stream', async () => {
        // Arrange
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd])
        const stream = new Readable()
        stream.push(binaryData)
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          ContentType: 'application/octet-stream',
          ContentLength: binaryData.length,
        })

        // Act
        const result = await client.send(
          new GetObjectCommand({
            Bucket: 'test-bucket',
            Key: 'binary.dat',
          }),
        )

        // Assert
        const bodyBytes = await result.Body!.transformToByteArray()
        expect(Buffer.from(bodyBytes)).toEqual(binaryData)
      })

      it('should return VersionId for versioned objects', async () => {
        // Arrange
        const stream = new Readable()
        stream.push('Versioned content')
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)
        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          VersionId: 'v2.xyz789',
          ETag: '"versioned-etag"',
        })

        // Act
        const result = await client.send(
          new GetObjectCommand({
            Bucket: 'versioned-bucket',
            Key: 'versioned.txt',
          }),
        )

        // Assert
        expect(result.VersionId).toBe('v2.xyz789')
      })
    })

    describe('Error Cases', () => {
      it('should throw NoSuchKey when object does not exist', async () => {
        // Arrange
        const error = new Error('The specified key does not exist')
        error.name = 'NoSuchKey'
        s3Mock.on(GetObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new GetObjectCommand({
              Bucket: 'test-bucket',
              Key: 'non-existent-object.txt',
            }),
          ),
        ).rejects.toThrow('The specified key does not exist')
      })

      it('should throw AccessDenied when not authorized', async () => {
        // Arrange
        const error = new Error('Access Denied')
        error.name = 'AccessDenied'
        s3Mock.on(GetObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new GetObjectCommand({
              Bucket: 'restricted-bucket',
              Key: 'private-object.txt',
            }),
          ),
        ).rejects.toThrow('Access Denied')
      })

      it('should throw InvalidObjectState for archived objects', async () => {
        // Arrange
        const error = new Error('The operation is not valid for the object storage class')
        error.name = 'InvalidObjectState'
        s3Mock.on(GetObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new GetObjectCommand({
              Bucket: 'test-bucket',
              Key: 'archived-object.txt',
            }),
          ),
        ).rejects.toThrow('The operation is not valid for the object storage class')
      })
    })
  })

  // ============================================================================
  // DeleteObjectCommand Tests
  // ============================================================================
  describe('DeleteObjectCommand', () => {
    describe('Input Parameters', () => {
      it('should send DeleteObjectCommand with Bucket and Key', async () => {
        // Arrange
        s3Mock.on(DeleteObjectCommand).resolves({})

        const params = {
          Bucket: 'test-bucket',
          Key: 'object-to-delete.txt',
        }

        // Act
        await client.send(new DeleteObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
          Bucket: 'test-bucket',
          Key: 'object-to-delete.txt',
        })
      })

      it('should send DeleteObjectCommand with VersionId', async () => {
        // Arrange
        s3Mock.on(DeleteObjectCommand).resolves({
          DeleteMarker: false,
          VersionId: 'v1.abc123',
        })

        const params = {
          Bucket: 'versioned-bucket',
          Key: 'versioned-object.txt',
          VersionId: 'v1.abc123',
        }

        // Act
        await client.send(new DeleteObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
          VersionId: 'v1.abc123',
        })
      })

      it('should send DeleteObjectCommand with MFA for MFA-enabled bucket', async () => {
        // Arrange
        s3Mock.on(DeleteObjectCommand).resolves({})

        const params = {
          Bucket: 'mfa-protected-bucket',
          Key: 'protected-object.txt',
          MFA: 'arn:aws:iam::123456789012:mfa/user 123456',
        }

        // Act
        await client.send(new DeleteObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
          MFA: expect.stringContaining('arn:aws:iam'),
        })
      })
    })

    describe('Return Values - Deletion Success', () => {
      it('should return success with httpStatusCode 204', async () => {
        // Arrange
        s3Mock.on(DeleteObjectCommand).resolves({
          $metadata: { httpStatusCode: 204 },
        })

        // Act
        const result = await client.send(
          new DeleteObjectCommand({
            Bucket: 'test-bucket',
            Key: 'object.txt',
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(204)
      })

      it('should return DeleteMarker for versioned bucket deletion', async () => {
        // Arrange
        s3Mock.on(DeleteObjectCommand).resolves({
          DeleteMarker: true,
          VersionId: 'delete-marker-version-id',
        })

        // Act
        const result = await client.send(
          new DeleteObjectCommand({
            Bucket: 'versioned-bucket',
            Key: 'object.txt',
          }),
        )

        // Assert
        expect(result.DeleteMarker).toBe(true)
        expect(result.VersionId).toBe('delete-marker-version-id')
      })

      it('should succeed even when object does not exist (idempotent)', async () => {
        // S3 delete is idempotent - deleting non-existent object succeeds
        s3Mock.on(DeleteObjectCommand).resolves({
          $metadata: { httpStatusCode: 204 },
        })

        // Act
        const result = await client.send(
          new DeleteObjectCommand({
            Bucket: 'test-bucket',
            Key: 'non-existent-object.txt',
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(204)
      })
    })

    describe('Error Cases', () => {
      it('should throw NoSuchBucket when bucket does not exist', async () => {
        // Arrange
        const error = new Error('The specified bucket does not exist')
        error.name = 'NoSuchBucket'
        s3Mock.on(DeleteObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new DeleteObjectCommand({
              Bucket: 'non-existent-bucket',
              Key: 'object.txt',
            }),
          ),
        ).rejects.toThrow('The specified bucket does not exist')
      })

      it('should throw AccessDenied when not authorized', async () => {
        // Arrange
        const error = new Error('Access Denied')
        error.name = 'AccessDenied'
        s3Mock.on(DeleteObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new DeleteObjectCommand({
              Bucket: 'restricted-bucket',
              Key: 'protected-object.txt',
            }),
          ),
        ).rejects.toThrow('Access Denied')
      })
    })
  })

  // ============================================================================
  // HeadObjectCommand Tests
  // ============================================================================
  describe('HeadObjectCommand', () => {
    describe('Input Parameters', () => {
      it('should send HeadObjectCommand with Bucket and Key', async () => {
        // Arrange
        s3Mock.on(HeadObjectCommand).resolves({
          ContentType: 'text/plain',
          ContentLength: 1024,
          ETag: '"head-object-etag"',
        })

        const params = {
          Bucket: 'test-bucket',
          Key: 'object.txt',
        }

        // Act
        await client.send(new HeadObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(HeadObjectCommand, {
          Bucket: 'test-bucket',
          Key: 'object.txt',
        })
      })

      it('should send HeadObjectCommand with VersionId', async () => {
        // Arrange
        s3Mock.on(HeadObjectCommand).resolves({
          VersionId: 'v1.abc123',
          ETag: '"versioned-etag"',
        })

        const params = {
          Bucket: 'versioned-bucket',
          Key: 'versioned-object.txt',
          VersionId: 'v1.abc123',
        }

        // Act
        await client.send(new HeadObjectCommand(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(HeadObjectCommand, {
          VersionId: 'v1.abc123',
        })
      })
    })

    describe('Return Values - Metadata', () => {
      it('should return object metadata without body', async () => {
        // Arrange
        const lastModified = new Date('2024-01-15T10:30:00Z')
        s3Mock.on(HeadObjectCommand).resolves({
          ContentType: 'application/json',
          ContentLength: 2048,
          ETag: '"metadata-etag"',
          LastModified: lastModified,
          AcceptRanges: 'bytes',
        })

        // Act
        const result = await client.send(
          new HeadObjectCommand({
            Bucket: 'test-bucket',
            Key: 'data.json',
          }),
        )

        // Assert
        expect(result.ContentType).toBe('application/json')
        expect(result.ContentLength).toBe(2048)
        expect(result.ETag).toBe('"metadata-etag"')
        expect(result.LastModified).toEqual(lastModified)
        expect(result.AcceptRanges).toBe('bytes')
      })

      it('should return custom metadata', async () => {
        // Arrange
        s3Mock.on(HeadObjectCommand).resolves({
          ContentType: 'text/plain',
          Metadata: {
            'x-amz-meta-created-by': 'test-user',
            'x-amz-meta-environment': 'production',
            'x-amz-meta-version': '1.0.0',
          },
        })

        // Act
        const result = await client.send(
          new HeadObjectCommand({
            Bucket: 'test-bucket',
            Key: 'object-with-metadata.txt',
          }),
        )

        // Assert
        expect(result.Metadata).toEqual({
          'x-amz-meta-created-by': 'test-user',
          'x-amz-meta-environment': 'production',
          'x-amz-meta-version': '1.0.0',
        })
      })

      it('should return storage class', async () => {
        // Arrange
        s3Mock.on(HeadObjectCommand).resolves({
          StorageClass: 'GLACIER',
          ContentLength: 10000000,
        })

        // Act
        const result = await client.send(
          new HeadObjectCommand({
            Bucket: 'archive-bucket',
            Key: 'archived-object.tar.gz',
          }),
        )

        // Assert
        expect(result.StorageClass).toBe('GLACIER')
      })

      it('should return server-side encryption info', async () => {
        // Arrange
        s3Mock.on(HeadObjectCommand).resolves({
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: 'arn:aws:kms:ap-northeast-1:123456789012:key/key-id',
        })

        // Act
        const result = await client.send(
          new HeadObjectCommand({
            Bucket: 'encrypted-bucket',
            Key: 'encrypted-object.dat',
          }),
        )

        // Assert
        expect(result.ServerSideEncryption).toBe('aws:kms')
        expect(result.SSEKMSKeyId).toContain('arn:aws:kms')
      })

      it('should return content encoding and disposition', async () => {
        // Arrange
        s3Mock.on(HeadObjectCommand).resolves({
          ContentEncoding: 'gzip',
          ContentDisposition: 'attachment; filename="document.pdf"',
          ContentType: 'application/pdf',
        })

        // Act
        const result = await client.send(
          new HeadObjectCommand({
            Bucket: 'test-bucket',
            Key: 'document.pdf.gz',
          }),
        )

        // Assert
        expect(result.ContentEncoding).toBe('gzip')
        expect(result.ContentDisposition).toBe('attachment; filename="document.pdf"')
      })
    })

    describe('Error Cases', () => {
      it('should throw NotFound (404) when object does not exist', async () => {
        // Arrange
        const error = new Error('Not Found')
        error.name = 'NotFound'
        s3Mock.on(HeadObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new HeadObjectCommand({
              Bucket: 'test-bucket',
              Key: 'non-existent-object.txt',
            }),
          ),
        ).rejects.toThrow('Not Found')
      })

      it('should throw AccessDenied when not authorized', async () => {
        // Arrange
        const error = new Error('Access Denied')
        error.name = 'AccessDenied'
        s3Mock.on(HeadObjectCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new HeadObjectCommand({
              Bucket: 'restricted-bucket',
              Key: 'private-object.txt',
            }),
          ),
        ).rejects.toThrow('Access Denied')
      })
    })
  })

  // ============================================================================
  // ListObjectsV2Command Tests
  // ============================================================================
  describe('ListObjectsV2Command', () => {
    describe('Input Parameters - Prefix', () => {
      it('should send ListObjectsV2Command with Bucket only', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
          IsTruncated: false,
        })

        const params = {
          Bucket: 'test-bucket',
        }

        // Act
        await client.send(new ListObjectsV2Command(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(ListObjectsV2Command, {
          Bucket: 'test-bucket',
        })
      })

      it('should send ListObjectsV2Command with Prefix', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
          Prefix: 'documents/',
        })

        const params = {
          Bucket: 'test-bucket',
          Prefix: 'documents/',
        }

        // Act
        await client.send(new ListObjectsV2Command(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(ListObjectsV2Command, {
          Prefix: 'documents/',
        })
      })

      it('should send ListObjectsV2Command with MaxKeys', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
          MaxKeys: 100,
        })

        const params = {
          Bucket: 'test-bucket',
          MaxKeys: 100,
        }

        // Act
        await client.send(new ListObjectsV2Command(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(ListObjectsV2Command, {
          MaxKeys: 100,
        })
      })

      it('should send ListObjectsV2Command with Delimiter for folder-like listing', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
          CommonPrefixes: [{ Prefix: 'folder1/' }, { Prefix: 'folder2/' }],
          Delimiter: '/',
        })

        const params = {
          Bucket: 'test-bucket',
          Delimiter: '/',
        }

        // Act
        await client.send(new ListObjectsV2Command(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(ListObjectsV2Command, {
          Delimiter: '/',
        })
      })

      it('should send ListObjectsV2Command with ContinuationToken for pagination', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
          IsTruncated: false,
        })

        const params = {
          Bucket: 'test-bucket',
          ContinuationToken: 'abc123continuationtoken',
        }

        // Act
        await client.send(new ListObjectsV2Command(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(ListObjectsV2Command, {
          ContinuationToken: 'abc123continuationtoken',
        })
      })

      it('should send ListObjectsV2Command with StartAfter', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
          StartAfter: 'file-100.txt',
        })

        const params = {
          Bucket: 'test-bucket',
          StartAfter: 'file-100.txt',
        }

        // Act
        await client.send(new ListObjectsV2Command(params))

        // Assert
        expect(s3Mock).toHaveReceivedCommandWith(ListObjectsV2Command, {
          StartAfter: 'file-100.txt',
        })
      })
    })

    describe('Return Values - Contents', () => {
      it('should return Contents array with object details', async () => {
        // Arrange
        const objects = [
          {
            Key: 'documents/file1.txt',
            Size: 1024,
            LastModified: new Date('2024-01-10T10:00:00Z'),
            ETag: '"etag1"',
            StorageClass: ObjectStorageClass.STANDARD,
          },
          {
            Key: 'documents/file2.pdf',
            Size: 2048,
            LastModified: new Date('2024-01-15T15:30:00Z'),
            ETag: '"etag2"',
            StorageClass: ObjectStorageClass.STANDARD,
          },
          {
            Key: 'documents/file3.json',
            Size: 512,
            LastModified: new Date('2024-01-20T08:45:00Z'),
            ETag: '"etag3"',
            StorageClass: ObjectStorageClass.STANDARD_IA,
          },
        ]
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: objects,
          KeyCount: 3,
          IsTruncated: false,
        })

        // Act
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: 'test-bucket',
            Prefix: 'documents/',
          }),
        )

        // Assert
        expect(result.Contents).toHaveLength(3)
        expect(result.Contents![0].Key).toBe('documents/file1.txt')
        expect(result.Contents![0].Size).toBe(1024)
        expect(result.Contents![1].Key).toBe('documents/file2.pdf')
        expect(result.Contents![2].StorageClass).toBe('STANDARD_IA')
        expect(result.KeyCount).toBe(3)
      })

      it('should return empty Contents for non-existent prefix', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [],
          KeyCount: 0,
          IsTruncated: false,
        })

        // Act
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: 'test-bucket',
            Prefix: 'non-existent-prefix/',
          }),
        )

        // Assert
        expect(result.Contents).toEqual([])
        expect(result.KeyCount).toBe(0)
      })

      it('should return NextContinuationToken when IsTruncated is true', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: Array.from({ length: 1000 }, (_, i) => ({
            Key: `file-${i}.txt`,
            Size: 100,
          })),
          IsTruncated: true,
          NextContinuationToken: 'next-page-token-123',
          KeyCount: 1000,
        })

        // Act
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: 'large-bucket',
            MaxKeys: 1000,
          }),
        )

        // Assert
        expect(result.IsTruncated).toBe(true)
        expect(result.NextContinuationToken).toBe('next-page-token-123')
        expect(result.Contents).toHaveLength(1000)
      })

      it('should return CommonPrefixes when using Delimiter', async () => {
        // Arrange
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [{ Key: 'root-file.txt', Size: 100 }],
          CommonPrefixes: [
            { Prefix: 'folder1/' },
            { Prefix: 'folder2/' },
            { Prefix: 'folder3/' },
          ],
          Delimiter: '/',
        })

        // Act
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: 'test-bucket',
            Delimiter: '/',
          }),
        )

        // Assert
        expect(result.CommonPrefixes).toHaveLength(3)
        expect(result.CommonPrefixes![0].Prefix).toBe('folder1/')
        expect(result.CommonPrefixes![1].Prefix).toBe('folder2/')
        expect(result.Contents).toHaveLength(1)
      })
    })

    describe('Error Cases', () => {
      it('should throw NoSuchBucket when bucket does not exist', async () => {
        // Arrange
        const error = new Error('The specified bucket does not exist')
        error.name = 'NoSuchBucket'
        s3Mock.on(ListObjectsV2Command).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new ListObjectsV2Command({
              Bucket: 'non-existent-bucket',
            }),
          ),
        ).rejects.toThrow('The specified bucket does not exist')
      })

      it('should throw AccessDenied when not authorized', async () => {
        // Arrange
        const error = new Error('Access Denied')
        error.name = 'AccessDenied'
        s3Mock.on(ListObjectsV2Command).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new ListObjectsV2Command({
              Bucket: 'restricted-bucket',
            }),
          ),
        ).rejects.toThrow('Access Denied')
      })
    })
  })

  // ============================================================================
  // Additional Test Cases for Edge Scenarios
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle concurrent put operations', async () => {
      // Arrange
      s3Mock.on(PutObjectCommand).resolves({
        ETag: '"concurrent-etag"',
      })

      // Act
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.send(
          new PutObjectCommand({
            Bucket: 'test-bucket',
            Key: `concurrent-${i}.txt`,
            Body: `Content ${i}`,
          }),
        ),
      )

      const results = await Promise.all(promises)

      // Assert
      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.ETag).toBe('"concurrent-etag"')
      })
      expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 5)
    })

    it('should handle object keys with special characters', async () => {
      // Arrange
      s3Mock.on(PutObjectCommand).resolves({
        ETag: '"special-key-etag"',
      })

      const specialKey = 'path/with spaces/file (1).txt'

      // Act
      const result = await client.send(
        new PutObjectCommand({
          Bucket: 'test-bucket',
          Key: specialKey,
          Body: 'Content',
        }),
      )

      // Assert
      expect(result.ETag).toBe('"special-key-etag"')
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Key: specialKey,
      })
    })

    it('should handle unicode characters in object key', async () => {
      // Arrange
      s3Mock.on(PutObjectCommand).resolves({
        ETag: '"unicode-etag"',
      })

      const unicodeKey = 'documents/Japanese folder/file.txt'

      // Act
      const result = await client.send(
        new PutObjectCommand({
          Bucket: 'test-bucket',
          Key: unicodeKey,
          Body: 'Unicode content',
        }),
      )

      // Assert
      expect(result.ETag).toBe('"unicode-etag"')
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Key: unicodeKey,
      })
    })

    it('should handle large list pagination', async () => {
      // Chain resolvesOnce calls for sequential responses
      s3Mock.on(ListObjectsV2Command)
        // First page
        .resolvesOnce({
          Contents: Array.from({ length: 1000 }, (_, i) => ({
            Key: `page1-file-${i}.txt`,
            Size: 100,
          })),
          IsTruncated: true,
          NextContinuationToken: 'token-page-2',
        })
        // Second page
        .resolvesOnce({
          Contents: Array.from({ length: 500 }, (_, i) => ({
            Key: `page2-file-${i}.txt`,
            Size: 100,
          })),
          IsTruncated: false,
        })

      // Act - First page
      const result1 = await client.send(
        new ListObjectsV2Command({
          Bucket: 'large-bucket',
          MaxKeys: 1000,
        }),
      )

      // Assert first page
      expect(result1.Contents).toHaveLength(1000)
      expect(result1.IsTruncated).toBe(true)
      expect(result1.NextContinuationToken).toBe('token-page-2')

      // Act - Second page
      const result2 = await client.send(
        new ListObjectsV2Command({
          Bucket: 'large-bucket',
          MaxKeys: 1000,
          ContinuationToken: result1.NextContinuationToken,
        }),
      )

      // Assert second page
      expect(result2.Contents).toHaveLength(500)
      expect(result2.IsTruncated).toBe(false)
    })
  })
})
