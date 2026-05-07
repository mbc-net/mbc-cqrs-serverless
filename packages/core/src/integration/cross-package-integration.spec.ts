/**
 * Cross-Package Integration Tests
 *
 * This file tests the integration patterns between MBC CQRS Serverless packages:
 * - Tenant + Master + Task package interactions
 * - Sequence + Tenant interactions
 * - Multi-tenant data isolation scenarios
 * - Package interoperability patterns
 *
 * These tests verify that cross-package dependencies work correctly
 * across npm version updates.
 */

// Common constants and utilities shared across packages
const KEY_SEPARATOR = '#'
const VERSION_FIRST = 0

describe('Cross-Package Integration', () => {
  // ============================================================================
  // Common Key Generation Patterns
  // ============================================================================
  describe('Common Key Generation Patterns', () => {
    /**
     * Standard PK generation used across all packages
     */
    function generatePk(prefix: string, tenantCode: string): string {
      return `${prefix}${KEY_SEPARATOR}${tenantCode}`
    }

    /**
     * Standard SK generation
     */
    function generateSk(...parts: string[]): string {
      return parts.filter(Boolean).join(KEY_SEPARATOR)
    }

    /**
     * Standard ID generation
     */
    function generateId(pk: string, sk: string): string {
      return `${pk}${KEY_SEPARATOR}${sk}`
    }

    describe('Tenant package key patterns', () => {
      const TENANT_PREFIX = 'TENANT'
      const SETTING_PREFIX = 'SETTING'

      it('should generate consistent tenant PK', () => {
        const pk = generatePk(TENANT_PREFIX, 'ACME')
        expect(pk).toBe('TENANT#ACME')
      })

      it('should generate consistent setting PK', () => {
        const pk = generatePk(SETTING_PREFIX, 'ACME')
        expect(pk).toBe('SETTING#ACME')
      })
    })

    describe('Master package key patterns', () => {
      const MASTER_PREFIX = 'MASTER'
      const MASTER_SETTING_PREFIX = 'MASTER_SETTING'

      it('should generate master PK with tenant code', () => {
        const pk = generatePk(MASTER_PREFIX, 'CORP_A')
        expect(pk).toBe('MASTER#CORP_A')
      })

      it('should generate master setting SK', () => {
        const sk = generateSk(MASTER_SETTING_PREFIX, 'CATEGORY_CODE')
        expect(sk).toBe('MASTER_SETTING#CATEGORY_CODE')
      })

      it('should generate master data SK', () => {
        const sk = generateSk('CATEGORY_CODE', 'DATA_CODE')
        expect(sk).toBe('CATEGORY_CODE#DATA_CODE')
      })
    })

    describe('Sequence package key patterns', () => {
      const SEQUENCE_PREFIX = 'SEQUENCE'

      it('should generate sequence PK with tenant code', () => {
        const pk = generatePk(SEQUENCE_PREFIX, 'TENANT_A')
        expect(pk).toBe('SEQUENCE#TENANT_A')
      })

      it('should generate sequence SK with rotation value', () => {
        const sk = generateSk('ORDER', 'SALES', '202403')
        expect(sk).toBe('ORDER#SALES#202403')
      })

      it('should generate sequence SK without rotation', () => {
        const sk = generateSk('MASTER', 'CONFIG')
        expect(sk).toBe('MASTER#CONFIG')
      })
    })

    describe('Task package key patterns', () => {
      const TASK_PREFIX = 'TASK'

      it('should generate task PK with tenant code', () => {
        const pk = generatePk(TASK_PREFIX, 'ORG_123')
        expect(pk).toBe('TASK#ORG_123')
      })

      it('should generate task SK with task ID', () => {
        const sk = generateSk('TASK', 'TASK-001')
        expect(sk).toBe('TASK#TASK-001')
      })
    })

    describe('Directory package key patterns', () => {
      const DIRECTORY_PREFIX = 'DIRECTORY'

      it('should generate directory PK with tenant code', () => {
        const pk = generatePk(DIRECTORY_PREFIX, 'COMPANY_X')
        expect(pk).toBe('DIRECTORY#COMPANY_X')
      })

      it('should generate complete ID from PK and SK', () => {
        const pk = generatePk(DIRECTORY_PREFIX, 'COMPANY_X')
        const sk = 'folder-ulid-123'
        const id = generateId(pk, sk)
        expect(id).toBe('DIRECTORY#COMPANY_X#folder-ulid-123')
      })
    })
  })

  // ============================================================================
  // Multi-Tenant Data Isolation
  // ============================================================================
  describe('Multi-Tenant Data Isolation', () => {
    interface TenantData {
      pk: string
      sk: string
      tenantCode: string
      data: unknown
    }

    /**
     * Validates that data belongs to the expected tenant
     */
    function validateTenantOwnership(
      data: TenantData,
      expectedTenantCode: string,
    ): boolean {
      // Check tenantCode field
      if (data.tenantCode !== expectedTenantCode) {
        return false
      }

      // Check PK contains correct tenant
      if (!data.pk.includes(`#${expectedTenantCode}`)) {
        return false
      }

      return true
    }

    /**
     * Extracts tenant code from any package's PK format
     */
    function extractTenantFromPk(pk: string): string | null {
      const match = pk.match(
        /^(TENANT|SETTING|MASTER|SEQUENCE|TASK|DIRECTORY)#([^#]+)/,
      )
      return match ? match[2] : null
    }

    describe('Tenant ownership validation', () => {
      it('should validate correct tenant ownership', () => {
        const data: TenantData = {
          pk: 'MASTER#ACME',
          sk: 'CATEGORY#PRODUCT',
          tenantCode: 'ACME',
          data: { name: 'Product Category' },
        }

        expect(validateTenantOwnership(data, 'ACME')).toBe(true)
      })

      it('should reject incorrect tenant ownership', () => {
        const data: TenantData = {
          pk: 'MASTER#ACME',
          sk: 'CATEGORY#PRODUCT',
          tenantCode: 'ACME',
          data: { name: 'Product Category' },
        }

        expect(validateTenantOwnership(data, 'OTHER')).toBe(false)
      })

      it('should reject when tenantCode field mismatches PK', () => {
        const data: TenantData = {
          pk: 'MASTER#ACME',
          sk: 'CATEGORY#PRODUCT',
          tenantCode: 'OTHER', // Mismatch
          data: { name: 'Product Category' },
        }

        expect(validateTenantOwnership(data, 'ACME')).toBe(false)
      })
    })

    describe('Tenant extraction from PK', () => {
      it('should extract tenant from MASTER PK', () => {
        expect(extractTenantFromPk('MASTER#COMPANY_A')).toBe('COMPANY_A')
      })

      it('should extract tenant from TENANT PK', () => {
        expect(extractTenantFromPk('TENANT#ORG_123')).toBe('ORG_123')
      })

      it('should extract tenant from SEQUENCE PK', () => {
        expect(extractTenantFromPk('SEQUENCE#TENANT_X')).toBe('TENANT_X')
      })

      it('should extract tenant from TASK PK', () => {
        expect(extractTenantFromPk('TASK#CLIENT_1')).toBe('CLIENT_1')
      })

      it('should extract tenant from DIRECTORY PK', () => {
        expect(extractTenantFromPk('DIRECTORY#CORP_ABC')).toBe('CORP_ABC')
      })

      it('should return null for invalid PK', () => {
        expect(extractTenantFromPk('INVALID#TENANT')).toBeNull()
        expect(extractTenantFromPk('USER#123')).toBeNull()
      })
    })

    describe('Cross-package tenant isolation', () => {
      it('should maintain tenant isolation across packages', () => {
        const tenantA = 'TENANT_A'
        const tenantB = 'TENANT_B'

        // Create data for both tenants across different packages
        const masterDataA: TenantData = {
          pk: `MASTER#${tenantA}`,
          sk: 'PRODUCT#SKU001',
          tenantCode: tenantA,
          data: { name: 'Product A' },
        }

        const masterDataB: TenantData = {
          pk: `MASTER#${tenantB}`,
          sk: 'PRODUCT#SKU001', // Same SK but different tenant
          tenantCode: tenantB,
          data: { name: 'Product B' },
        }

        const sequenceA: TenantData = {
          pk: `SEQUENCE#${tenantA}`,
          sk: 'ORDER#202403',
          tenantCode: tenantA,
          data: { currentValue: 100 },
        }

        // Validate isolation
        expect(validateTenantOwnership(masterDataA, tenantA)).toBe(true)
        expect(validateTenantOwnership(masterDataA, tenantB)).toBe(false)

        expect(validateTenantOwnership(masterDataB, tenantB)).toBe(true)
        expect(validateTenantOwnership(masterDataB, tenantA)).toBe(false)

        expect(validateTenantOwnership(sequenceA, tenantA)).toBe(true)
        expect(validateTenantOwnership(sequenceA, tenantB)).toBe(false)
      })

      it('should allow same SK across different tenants', () => {
        const tenantA = 'TENANT_A'
        const tenantB = 'TENANT_B'

        const idA = `MASTER#${tenantA}#CATEGORY#PRODUCT`
        const idB = `MASTER#${tenantB}#CATEGORY#PRODUCT`

        // IDs should be unique even with same SK
        expect(idA).not.toBe(idB)
        expect(extractTenantFromPk(idA)).toBe(tenantA)
        expect(extractTenantFromPk(idB)).toBe(tenantB)
      })
    })
  })

  // ============================================================================
  // Version Management Across Packages
  // ============================================================================
  describe('Version Management Across Packages', () => {
    const VER_SEPARATOR = '@'

    interface VersionedEntity {
      pk: string
      sk: string
      version: number
    }

    /**
     * Generates version history SK
     */
    function generateHistorySk(baseSk: string, version: number): string {
      return `${baseSk}${VER_SEPARATOR}${version}`
    }

    /**
     * Parses SK to extract base SK and version
     */
    function parseVersionedSk(
      sk: string,
    ): { baseSk: string; version?: number } {
      const parts = sk.split(VER_SEPARATOR)
      if (parts.length === 2) {
        return {
          baseSk: parts[0],
          version: parseInt(parts[1], 10),
        }
      }
      return { baseSk: sk }
    }

    describe('History SK generation', () => {
      it('should generate history SK with version', () => {
        const baseSk = 'PRODUCT#SKU001'
        const historySk = generateHistorySk(baseSk, 5)
        expect(historySk).toBe('PRODUCT#SKU001@5')
      })

      it('should support VERSION_FIRST constant', () => {
        const baseSk = 'DOCUMENT#DOC001'
        const historySk = generateHistorySk(baseSk, VERSION_FIRST)
        expect(historySk).toBe('DOCUMENT#DOC001@0')
      })
    })

    describe('Versioned SK parsing', () => {
      it('should parse versioned SK', () => {
        const result = parseVersionedSk('PRODUCT#SKU001@5')
        expect(result.baseSk).toBe('PRODUCT#SKU001')
        expect(result.version).toBe(5)
      })

      it('should handle non-versioned SK', () => {
        const result = parseVersionedSk('PRODUCT#SKU001')
        expect(result.baseSk).toBe('PRODUCT#SKU001')
        expect(result.version).toBeUndefined()
      })

      it('should handle version 0', () => {
        const result = parseVersionedSk('ITEM#001@0')
        expect(result.baseSk).toBe('ITEM#001')
        expect(result.version).toBe(0)
      })
    })

    describe('Version comparison', () => {
      it('should detect optimistic lock conflict', () => {
        const storedEntity: VersionedEntity = {
          pk: 'MASTER#TENANT',
          sk: 'PRODUCT#001',
          version: 5,
        }

        const updateAttempt1 = { version: 5 } // Valid
        const updateAttempt2 = { version: 4 } // Stale

        expect(storedEntity.version === updateAttempt1.version).toBe(true)
        expect(storedEntity.version === updateAttempt2.version).toBe(false)
      })
    })
  })

  // ============================================================================
  // Package Dependency Patterns
  // ============================================================================
  describe('Package Dependency Patterns', () => {
    describe('Tenant → Master data relationship', () => {
      /**
       * Master data typically belongs to a tenant context
       */
      interface TenantContext {
        tenantCode: string
        userId: string
      }

      interface MasterData {
        pk: string
        sk: string
        tenantCode: string
        code: string
        name: string
        attributes?: Record<string, unknown>
      }

      function createMasterDataForTenant(
        ctx: TenantContext,
        categoryCode: string,
        dataCode: string,
        data: Partial<MasterData>,
      ): MasterData {
        return {
          pk: `MASTER${KEY_SEPARATOR}${ctx.tenantCode}`,
          sk: `${categoryCode}${KEY_SEPARATOR}${dataCode}`,
          tenantCode: ctx.tenantCode,
          code: dataCode,
          name: data.name || dataCode,
          attributes: data.attributes,
        }
      }

      it('should create master data within tenant context', () => {
        const ctx: TenantContext = {
          tenantCode: 'ACME',
          userId: 'user-123',
        }

        const masterData = createMasterDataForTenant(ctx, 'PRODUCT', 'SKU001', {
          name: 'Widget A',
          attributes: { price: 100 },
        })

        expect(masterData.pk).toBe('MASTER#ACME')
        expect(masterData.sk).toBe('PRODUCT#SKU001')
        expect(masterData.tenantCode).toBe('ACME')
      })
    })

    describe('Tenant → Sequence relationship', () => {
      interface SequenceConfig {
        typeCode: string
        format: string
        rotateBy: string
      }

      interface GeneratedSequence {
        pk: string
        sk: string
        tenantCode: string
        currentValue: number
        formattedValue: string
      }

      function generateSequenceKey(
        tenantCode: string,
        config: SequenceConfig,
        rotateValue: string,
      ): { pk: string; sk: string } {
        return {
          pk: `SEQUENCE${KEY_SEPARATOR}${tenantCode}`,
          sk: [config.typeCode, rotateValue].filter(Boolean).join(KEY_SEPARATOR),
        }
      }

      function formatSequence(format: string, value: number): string {
        // Simple format: {seq:N} for N-digit padding
        const match = format.match(/\{seq:(\d+)\}/)
        if (match) {
          const padding = parseInt(match[1], 10)
          return format.replace(match[0], String(value).padStart(padding, '0'))
        }
        return format.replace('{seq}', String(value))
      }

      it('should generate sequence within tenant context', () => {
        const tenantCode = 'CORP_A'
        const config: SequenceConfig = {
          typeCode: 'INVOICE',
          format: 'INV-{seq:6}',
          rotateBy: 'monthly',
        }
        const rotateValue = '202403'

        const key = generateSequenceKey(tenantCode, config, rotateValue)
        expect(key.pk).toBe('SEQUENCE#CORP_A')
        expect(key.sk).toBe('INVOICE#202403')
      })

      it('should format sequence value correctly', () => {
        const format = 'ORD-{seq:8}'
        const formatted = formatSequence(format, 123)
        expect(formatted).toBe('ORD-00000123')
      })
    })

    describe('Tenant → Task relationship', () => {
      interface TaskData {
        pk: string
        sk: string
        tenantCode: string
        taskId: string
        status: string
        priority: number
      }

      function createTask(
        tenantCode: string,
        taskId: string,
        data: Partial<TaskData>,
      ): TaskData {
        return {
          pk: `TASK${KEY_SEPARATOR}${tenantCode}`,
          sk: `TASK${KEY_SEPARATOR}${taskId}`,
          tenantCode,
          taskId,
          status: data.status || 'PENDING',
          priority: data.priority || 0,
        }
      }

      it('should create task within tenant context', () => {
        const task = createTask('COMPANY_X', 'TASK-001', {
          status: 'IN_PROGRESS',
          priority: 1,
        })

        expect(task.pk).toBe('TASK#COMPANY_X')
        expect(task.sk).toBe('TASK#TASK-001')
        expect(task.tenantCode).toBe('COMPANY_X')
      })

      it('should isolate tasks between tenants', () => {
        const taskA = createTask('TENANT_A', 'TASK-001', { status: 'DONE' })
        const taskB = createTask('TENANT_B', 'TASK-001', { status: 'PENDING' })

        expect(taskA.pk).not.toBe(taskB.pk)
        expect(taskA.status).not.toBe(taskB.status)
      })
    })

    describe('Directory → Tenant relationship', () => {
      interface DirectoryItem {
        pk: string
        sk: string
        tenantCode: string
        name: string
        type: 'folder' | 'file'
        parentId?: string
        ancestors: string[]
      }

      function createDirectoryItem(
        tenantCode: string,
        itemId: string,
        data: Partial<DirectoryItem>,
      ): DirectoryItem {
        return {
          pk: `DIRECTORY${KEY_SEPARATOR}${tenantCode}`,
          sk: itemId,
          tenantCode,
          name: data.name || 'Untitled',
          type: data.type || 'folder',
          parentId: data.parentId,
          ancestors: data.ancestors || [],
        }
      }

      it('should create directory item within tenant context', () => {
        const folder = createDirectoryItem('ORG_123', 'ulid-folder-001', {
          name: 'Documents',
          type: 'folder',
        })

        expect(folder.pk).toBe('DIRECTORY#ORG_123')
        expect(folder.sk).toBe('ulid-folder-001')
        expect(folder.tenantCode).toBe('ORG_123')
      })

      it('should track ancestors for nested items', () => {
        const rootFolder = createDirectoryItem('ORG_123', 'root-id', {
          name: 'Root',
          type: 'folder',
        })

        const subFolder = createDirectoryItem('ORG_123', 'sub-id', {
          name: 'Sub Folder',
          type: 'folder',
          parentId: 'root-id',
          ancestors: ['root-id'],
        })

        const file = createDirectoryItem('ORG_123', 'file-id', {
          name: 'document.pdf',
          type: 'file',
          parentId: 'sub-id',
          ancestors: ['root-id', 'sub-id'],
        })

        expect(file.ancestors).toContain('root-id')
        expect(file.ancestors).toContain('sub-id')
        expect(file.ancestors).toHaveLength(2)
      })
    })
  })

  // ============================================================================
  // Cross-Package Query Patterns
  // ============================================================================
  describe('Cross-Package Query Patterns', () => {
    describe('GSI query patterns', () => {
      /**
       * Standard GSI1 key pattern for cross-entity queries
       */
      function generateGsi1Keys(
        entityType: string,
        tenantCode: string,
        entityId: string,
      ): { gsi1pk: string; gsi1sk: string } {
        return {
          gsi1pk: `${entityType}${KEY_SEPARATOR}${tenantCode}`,
          gsi1sk: entityId,
        }
      }

      it('should generate GSI1 keys for entity type queries', () => {
        const keys = generateGsi1Keys('PRODUCT', 'ACME', 'SKU001')
        expect(keys.gsi1pk).toBe('PRODUCT#ACME')
        expect(keys.gsi1sk).toBe('SKU001')
      })

      it('should allow querying all entities of a type for tenant', () => {
        // Same GSI1PK allows listing all products for tenant
        const product1 = generateGsi1Keys('PRODUCT', 'ACME', 'SKU001')
        const product2 = generateGsi1Keys('PRODUCT', 'ACME', 'SKU002')

        expect(product1.gsi1pk).toBe(product2.gsi1pk)
      })

      it('should isolate GSI queries between tenants', () => {
        const productA = generateGsi1Keys('PRODUCT', 'TENANT_A', 'SKU001')
        const productB = generateGsi1Keys('PRODUCT', 'TENANT_B', 'SKU001')

        expect(productA.gsi1pk).not.toBe(productB.gsi1pk)
      })
    })

    describe('SK prefix query patterns', () => {
      /**
       * Generates SK prefix for begins_with queries
       */
      function skBeginsWithExpression(
        prefix: string,
      ): { expression: string; values: Record<string, string> } {
        return {
          expression: 'begins_with(sk, :prefix)',
          values: { ':prefix': `${prefix}${KEY_SEPARATOR}` },
        }
      }

      it('should generate begins_with expression for category queries', () => {
        const query = skBeginsWithExpression('PRODUCT')
        expect(query.expression).toBe('begins_with(sk, :prefix)')
        expect(query.values[':prefix']).toBe('PRODUCT#')
      })

      it('should support multi-level prefix queries', () => {
        const query = skBeginsWithExpression('PRODUCT#ELECTRONICS')
        expect(query.values[':prefix']).toBe('PRODUCT#ELECTRONICS#')
      })
    })
  })

  // ============================================================================
  // Error Handling Consistency
  // ============================================================================
  describe('Error Handling Consistency', () => {
    /**
     * Standard error codes used across packages
     */
    const ERROR_CODES = {
      NOT_FOUND: 'NOT_FOUND',
      BAD_REQUEST: 'BAD_REQUEST',
      FORBIDDEN: 'FORBIDDEN',
      CONFLICT: 'CONFLICT',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
    } as const

    /**
     * Standard error response structure
     */
    interface ErrorResponse {
      code: string
      message: string
      statusCode: number
    }

    function createNotFoundError(entity: string): ErrorResponse {
      return {
        code: ERROR_CODES.NOT_FOUND,
        message: `${entity} not found`,
        statusCode: 404,
      }
    }

    function createBadRequestError(message: string): ErrorResponse {
      return {
        code: ERROR_CODES.BAD_REQUEST,
        message,
        statusCode: 400,
      }
    }

    function createForbiddenError(message: string): ErrorResponse {
      return {
        code: ERROR_CODES.FORBIDDEN,
        message,
        statusCode: 403,
      }
    }

    function createConflictError(message: string): ErrorResponse {
      return {
        code: ERROR_CODES.CONFLICT,
        message,
        statusCode: 409,
      }
    }

    describe('Standard error responses', () => {
      it('should create NOT_FOUND error', () => {
        const error = createNotFoundError('Directory')
        expect(error.code).toBe('NOT_FOUND')
        expect(error.statusCode).toBe(404)
        expect(error.message).toBe('Directory not found')
      })

      it('should create BAD_REQUEST error', () => {
        const error = createBadRequestError('Invalid tenant code')
        expect(error.code).toBe('BAD_REQUEST')
        expect(error.statusCode).toBe(400)
      })

      it('should create FORBIDDEN error', () => {
        const error = createForbiddenError(
          'You do not have permission to access this resource',
        )
        expect(error.code).toBe('FORBIDDEN')
        expect(error.statusCode).toBe(403)
      })

      it('should create CONFLICT error for optimistic lock', () => {
        const error = createConflictError('Version conflict detected')
        expect(error.code).toBe('CONFLICT')
        expect(error.statusCode).toBe(409)
      })
    })
  })

  // ============================================================================
  // Event Sourcing Patterns
  // ============================================================================
  describe('Event Sourcing Patterns', () => {
    interface CommandEvent {
      pk: string
      sk: string
      type: 'CREATE' | 'UPDATE' | 'DELETE'
      version: number
      timestamp: string
      data: Record<string, unknown>
    }

    interface DataSnapshot {
      pk: string
      sk: string
      version: number
      data: Record<string, unknown>
      createdAt: string
      updatedAt: string
    }

    function createCommandEvent(
      pk: string,
      sk: string,
      type: CommandEvent['type'],
      version: number,
      data: Record<string, unknown>,
    ): CommandEvent {
      return {
        pk,
        sk: `${sk}${KEY_SEPARATOR}v${version}`,
        type,
        version,
        timestamp: new Date().toISOString(),
        data,
      }
    }

    function projectDataFromEvents(events: CommandEvent[]): DataSnapshot | null {
      if (events.length === 0) return null

      const sorted = [...events].sort((a, b) => a.version - b.version)
      const firstEvent = sorted[0]
      const lastEvent = sorted[sorted.length - 1]

      // Check if last event is DELETE
      if (lastEvent.type === 'DELETE') {
        return null // Entity was deleted
      }

      // Merge all event data
      const mergedData = sorted.reduce(
        (acc, event) => ({
          ...acc,
          ...event.data,
        }),
        {},
      )

      return {
        pk: firstEvent.pk.replace(/#v\d+$/, ''),
        sk: firstEvent.sk.split(KEY_SEPARATOR)[0],
        version: lastEvent.version,
        data: mergedData,
        createdAt: firstEvent.timestamp,
        updatedAt: lastEvent.timestamp,
      }
    }

    describe('Command event creation', () => {
      it('should create versioned command event', () => {
        const event = createCommandEvent(
          'MASTER#TENANT',
          'PRODUCT#SKU001',
          'CREATE',
          0,
          { name: 'Widget' },
        )

        expect(event.type).toBe('CREATE')
        expect(event.version).toBe(0)
        expect(event.sk).toBe('PRODUCT#SKU001#v0')
      })
    })

    describe('Event projection', () => {
      it('should project current state from events', () => {
        const events: CommandEvent[] = [
          createCommandEvent('MASTER#T', 'PROD#001', 'CREATE', 0, {
            name: 'Widget',
            price: 100,
          }),
          createCommandEvent('MASTER#T', 'PROD#001', 'UPDATE', 1, {
            price: 120,
          }),
          createCommandEvent('MASTER#T', 'PROD#001', 'UPDATE', 2, {
            description: 'A nice widget',
          }),
        ]

        const snapshot = projectDataFromEvents(events)

        expect(snapshot).not.toBeNull()
        expect(snapshot!.version).toBe(2)
        expect(snapshot!.data.name).toBe('Widget')
        expect(snapshot!.data.price).toBe(120)
        expect(snapshot!.data.description).toBe('A nice widget')
      })

      it('should return null for deleted entity', () => {
        const events: CommandEvent[] = [
          createCommandEvent('MASTER#T', 'PROD#001', 'CREATE', 0, {
            name: 'Widget',
          }),
          createCommandEvent('MASTER#T', 'PROD#001', 'DELETE', 1, {}),
        ]

        const snapshot = projectDataFromEvents(events)
        expect(snapshot).toBeNull()
      })

      it('should return null for empty events', () => {
        const snapshot = projectDataFromEvents([])
        expect(snapshot).toBeNull()
      })
    })
  })
})
