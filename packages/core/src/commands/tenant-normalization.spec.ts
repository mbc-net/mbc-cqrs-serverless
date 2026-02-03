import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { createMock } from '@golevelup/ts-jest'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'
import { HEADER_TENANT_CODE, ROLE_SYSTEM_ADMIN } from '../constants'
import { IInvoke, JwtClaims } from '../context/invoke'
import { getUserContext } from '../context/user'
import { DynamoDbService, S3Service } from '../data-store'

/**
 * Tenant Code Normalization Tests for Data Operations
 *
 * These tests verify that tenant code normalization works correctly
 * when integrated with data services (DynamoDB operations).
 *
 * Focus areas:
 * 1. Partition key generation with normalized tenant codes
 * 2. Data retrieval with different case combinations
 * 3. Consistency between write and read operations
 */
describe('Tenant Code Normalization - Data Operations', () => {
  const dynamoDBMock = mockClient(DynamoDBClient)
  const s3Mock = mockClient(S3Client)

  let dynamoDbService: DynamoDbService

  const keys = {
    NODE_ENV: 'local',
    APP_NAME: 'test-app',
    ATTRIBUTE_LIMIT_SIZE: 400000,
    S3_BUCKET_NAME: 'test-bucket',
  }

  beforeEach(async () => {
    dynamoDBMock.reset()
    s3Mock.reset()

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DynamoDbService,
        S3Service,
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>({
            get: jest.fn((key) => keys[key]),
          }),
        },
      ],
    }).compile()

    dynamoDbService = moduleRef.get<DynamoDbService>(DynamoDbService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const createMockContext = (
    claims: Partial<JwtClaims>,
    headers: Record<string, string> = {},
  ): IInvoke => ({
    event: {
      headers,
      requestContext: {
        authorizer: {
          jwt: {
            claims: claims as JwtClaims,
          },
        },
      },
    },
  })

  describe('Partition key generation with tenant codes', () => {
    it('should generate consistent pk for uppercase and lowercase tenant codes', () => {
      // Get user context with uppercase tenant
      const ctx1 = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'TENANT_ABC',
        'custom:roles': JSON.stringify([]),
      })

      // Get user context with lowercase tenant
      const ctx2 = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant_abc',
        'custom:roles': JSON.stringify([]),
      })

      const userContext1 = getUserContext(ctx1)
      const userContext2 = getUserContext(ctx2)

      // Both should produce the same tenantCode
      expect(userContext1.tenantCode).toBe(userContext2.tenantCode)
      expect(userContext1.tenantCode).toBe('tenant_abc')

      // Therefore, partition keys generated with these would be identical
      const pk1 = `ENTITY#${userContext1.tenantCode}`
      const pk2 = `ENTITY#${userContext2.tenantCode}`
      expect(pk1).toBe(pk2)
    })

    it('should generate same pk regardless of tenant code case in header', () => {
      const testCases = ['Tenant-A', 'TENANT-A', 'tenant-a', 'TeNaNt-A']
      const pks: string[] = []

      for (const headerTenant of testCases) {
        const ctx = createMockContext(
          {
            sub: 'admin-123',
            'custom:roles': JSON.stringify([
              { tenant: '', role: ROLE_SYSTEM_ADMIN },
            ]),
          },
          { [HEADER_TENANT_CODE]: headerTenant },
        )

        const userContext = getUserContext(ctx)
        pks.push(`ENTITY#${userContext.tenantCode}`)
      }

      // All partition keys should be identical
      expect(new Set(pks).size).toBe(1)
      expect(pks[0]).toBe('ENTITY#tenant-a')
    })
  })

  describe('Data consistency with tenant code normalization', () => {
    it('should write and read with same tenant code after normalization', async () => {
      // User creates data with uppercase tenant
      const createCtx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MY_TENANT',
        'custom:roles': JSON.stringify([{ tenant: 'my_tenant', role: 'admin' }]),
      })

      const createUserContext = getUserContext(createCtx)
      const pk = `TODO#${createUserContext.tenantCode}`
      const sk = 'item-001'

      // Write operation
      const writeItem = {
        pk,
        sk,
        tenantCode: createUserContext.tenantCode,
        name: 'Test Item',
      }

      await dynamoDbService.putItem('test-table', writeItem)

      expect(dynamoDBMock).toHaveReceivedCommandWith(PutItemCommand, {
        TableName: 'test-table',
        Item: {
          pk: { S: 'TODO#my_tenant' },
          sk: { S: 'item-001' },
          tenantCode: { S: 'my_tenant' },
          name: { S: 'Test Item' },
        },
      })
    })

    it('should retrieve data using different case tenant code', () => {
      // Data was written with lowercase tenant
      const writtenPk = 'TODO#my_tenant'

      // User tries to read with uppercase tenant
      const readCtx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MY_TENANT',
        'custom:roles': JSON.stringify([{ tenant: 'MY_TENANT', role: 'admin' }]),
      })

      const readUserContext = getUserContext(readCtx)
      const readPk = `TODO#${readUserContext.tenantCode}`

      // The generated pk should match the written pk
      expect(readPk).toBe(writtenPk)
    })
  })

  describe('Table name generation with tenant codes', () => {
    it('should generate consistent table names', () => {
      const tableName1 = dynamoDbService.getTableName('todo')
      const tableName2 = dynamoDbService.getTableName('todo')

      expect(tableName1).toBe(tableName2)
      expect(tableName1).toBe('local-test-app-todo')
    })
  })

  describe('Backward compatibility with existing data', () => {
    it('should handle scenario where old data has uppercase tenant in pk', () => {
      // Simulates scenario:
      // - Old data was written with uppercase: pk = 'TODO#MY_TENANT'
      // - New code normalizes to lowercase: tenantCode = 'my_tenant'
      // - This is a BREAKING CHANGE if not handled properly

      const oldDataPk = 'TODO#MY_TENANT' // Old format (hypothetical)
      const newCodeTenantCode = 'my_tenant' // New normalized format
      const newDataPk = `TODO#${newCodeTenantCode}`

      // These would NOT match - this documents the expected behavior
      // Framework users need to migrate their data or handle both formats
      expect(oldDataPk).not.toBe(newDataPk)

      // Recommendation: Users should migrate data to use lowercase tenant codes
      // or implement custom logic to handle both formats during transition
    })

    it('should document the expected pk format after normalization', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MyCompany',
        'custom:roles': JSON.stringify([]),
      })

      const userContext = getUserContext(ctx)

      // Documented behavior: tenantCode is always lowercase
      expect(userContext.tenantCode).toBe('mycompany')

      // Expected pk format
      const expectedPkPattern = /^[A-Z_]+#[a-z0-9_-]+$/
      const pk = `TODO#${userContext.tenantCode}`
      expect(pk).toMatch(expectedPkPattern)
    })
  })

  describe('Multi-tenant data isolation', () => {
    it('should ensure different tenants have different pks', () => {
      const tenants = ['tenant-a', 'tenant-b', 'TENANT-A'] // Note: TENANT-A normalizes to tenant-a

      const pks = tenants.map((tenant) => {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': tenant,
          'custom:roles': JSON.stringify([]),
        })
        const userContext = getUserContext(ctx)
        return `TODO#${userContext.tenantCode}`
      })

      // tenant-a and TENANT-A should produce the same pk
      expect(pks[0]).toBe(pks[2])
      expect(pks[0]).toBe('TODO#tenant-a')

      // tenant-b should be different
      expect(pks[1]).toBe('TODO#tenant-b')
      expect(pks[0]).not.toBe(pks[1])
    })

    it('should isolate data between tenants even with case differences', () => {
      // Tenant A user
      const ctxA = createMockContext({
        sub: 'user-a',
        'custom:tenant': 'TenantA',
        'custom:roles': JSON.stringify([{ tenant: 'tenanta', role: 'admin' }]),
      })

      // Tenant B user trying to use similar-looking tenant code
      const ctxB = createMockContext({
        sub: 'user-b',
        'custom:tenant': 'TenantB',
        'custom:roles': JSON.stringify([{ tenant: 'tenantb', role: 'admin' }]),
      })

      const userContextA = getUserContext(ctxA)
      const userContextB = getUserContext(ctxB)

      const pkA = `DATA#${userContextA.tenantCode}`
      const pkB = `DATA#${userContextB.tenantCode}`

      // Different tenants should have different pks
      expect(pkA).not.toBe(pkB)
      expect(pkA).toBe('DATA#tenanta')
      expect(pkB).toBe('DATA#tenantb')
    })
  })

  describe('ID generation with tenant codes', () => {
    it('should generate consistent IDs with normalized tenant codes', () => {
      const KEY_SEPARATOR = '#'

      // Helper function similar to framework's generateId
      const generateId = (pk: string, sk: string): string =>
        `${pk}${KEY_SEPARATOR}${sk}`

      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MY_TENANT',
        'custom:roles': JSON.stringify([]),
      })

      const userContext = getUserContext(ctx)
      const pk = `TODO#${userContext.tenantCode}`
      const sk = 'item-001'
      const id = generateId(pk, sk)

      // ID should contain normalized tenant code
      expect(id).toBe('TODO#my_tenant#item-001')
      expect(id).not.toContain('MY_TENANT')
    })
  })

  describe('Query patterns with tenant codes', () => {
    it('should query with normalized tenant code in pk', () => {
      const testCases = [
        { input: 'TENANT_ABC', expectedPkPrefix: 'TODO#tenant_abc' },
        { input: 'Tenant-XYZ', expectedPkPrefix: 'TODO#tenant-xyz' },
        { input: 'tenant_123', expectedPkPrefix: 'TODO#tenant_123' },
      ]

      for (const { input, expectedPkPrefix } of testCases) {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': input,
          'custom:roles': JSON.stringify([]),
        })

        const userContext = getUserContext(ctx)
        const pkPrefix = `TODO#${userContext.tenantCode}`

        expect(pkPrefix).toBe(expectedPkPrefix)
      }
    })
  })
})

describe('Tenant Code in Entity Fields', () => {
  const createMockContext = (
    claims: Partial<JwtClaims>,
    headers: Record<string, string> = {},
  ): IInvoke => ({
    event: {
      headers,
      requestContext: {
        authorizer: {
          jwt: {
            claims: claims as JwtClaims,
          },
        },
      },
    },
  })

  describe('Entity tenantCode field consistency', () => {
    it('should use normalized tenantCode in entity fields', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MY_COMPANY',
        'custom:roles': JSON.stringify([{ tenant: 'my_company', role: 'admin' }]),
      })

      const userContext = getUserContext(ctx)

      // Simulating entity creation
      const entity = {
        pk: `TODO#${userContext.tenantCode}`,
        sk: 'item-001',
        tenantCode: userContext.tenantCode,
        createdBy: userContext.userId,
        name: 'Test Item',
      }

      // Entity should have normalized tenantCode
      expect(entity.tenantCode).toBe('my_company')
      expect(entity.pk).toBe('TODO#my_company')
    })

    it('should maintain tenantCode format in search/filter operations', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'SEARCH_TENANT',
        'custom:roles': JSON.stringify([]),
      })

      const userContext = getUserContext(ctx)

      // Search criteria would use normalized tenantCode
      const searchCriteria = {
        tenantCode: userContext.tenantCode,
        isDeleted: false,
      }

      expect(searchCriteria.tenantCode).toBe('search_tenant')
    })
  })

  describe('RDS sync with normalized tenant codes', () => {
    it('should sync to RDS with normalized tenantCode', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'RDS_TENANT',
        'custom:roles': JSON.stringify([]),
      })

      const userContext = getUserContext(ctx)

      // Simulating RDS record
      const rdsRecord = {
        id: 'TODO#rds_tenant#item-001',
        pk: 'TODO#rds_tenant',
        sk: 'item-001',
        tenantCode: userContext.tenantCode,
        name: 'RDS Item',
      }

      // RDS record should have normalized tenantCode
      expect(rdsRecord.tenantCode).toBe('rds_tenant')
    })

    it('should query RDS with normalized tenantCode', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'QUERY_TENANT',
        'custom:roles': JSON.stringify([]),
      })

      const userContext = getUserContext(ctx)

      // Prisma-style query would use normalized tenantCode
      const prismaQuery = {
        where: {
          tenantCode: userContext.tenantCode,
          isDeleted: false,
        },
      }

      expect(prismaQuery.where.tenantCode).toBe('query_tenant')
    })
  })
})
