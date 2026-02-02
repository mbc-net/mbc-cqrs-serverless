/**
 * Third-party Integration Tests: ulid
 *
 * This test suite validates the ulid package's input/output behavior
 * to ensure compatibility with the MBC CQRS Serverless framework.
 *
 * Package: ulid (^2.3.0)
 * Purpose: Generate Universally Unique Lexicographically Sortable Identifiers
 *
 * Test coverage:
 * - Basic ULID generation
 * - Sequential ordering guarantee (lexicographic sort)
 * - Monotonic ULID generation
 * - Timestamp decoding
 * - ULID format validation (26 characters, Crockford Base32)
 * - Seed time option
 * - Factory pattern for monotonic IDs
 */

import { ulid, decodeTime, monotonicFactory } from 'ulid'

describe('ulid Integration Tests', () => {
  describe('Basic ULID Generation', () => {
    it('should generate a valid ULID string', () => {
      // Input: No parameters
      // Output: 26-character ULID string
      const id = ulid()

      expect(typeof id).toBe('string')
      expect(id).toHaveLength(26)
    })

    it('should generate unique IDs on each call', () => {
      // Generate multiple IDs
      const ids = new Set<string>()
      const count = 1000

      for (let i = 0; i < count; i++) {
        ids.add(ulid())
      }

      // All IDs should be unique
      expect(ids.size).toBe(count)
    })

    it('should generate IDs with Crockford Base32 characters only', () => {
      // Crockford Base32 alphabet (excludes I, L, O, U)
      const crockfordRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/

      const id = ulid()

      expect(id).toMatch(crockfordRegex)
    })
  })

  describe('ULID Format Validation', () => {
    it('should have correct structure: 10 chars timestamp + 16 chars randomness', () => {
      const id = ulid()

      // First 10 characters: timestamp component
      const timestamp = id.substring(0, 10)
      expect(timestamp).toHaveLength(10)

      // Remaining 16 characters: randomness component
      const randomness = id.substring(10)
      expect(randomness).toHaveLength(16)
    })

    it('should generate uppercase characters', () => {
      const id = ulid()

      // ULID should be uppercase
      expect(id).toBe(id.toUpperCase())
    })

    it('should not contain ambiguous characters (I, L, O, U)', () => {
      // Generate multiple IDs to increase chance of catching issues
      for (let i = 0; i < 100; i++) {
        const id = ulid()

        expect(id).not.toMatch(/[ILOU]/)
      }
    })
  })

  describe('Lexicographic Sort Order', () => {
    it('should maintain chronological order when sorted lexicographically', async () => {
      const ids: string[] = []

      // Generate IDs with small delays to ensure different timestamps
      for (let i = 0; i < 5; i++) {
        ids.push(ulid())
        // Small delay to ensure different timestamp
        await new Promise((resolve) => setTimeout(resolve, 2))
      }

      const sortedIds = [...ids].sort()

      // Lexicographically sorted IDs should match generation order
      expect(sortedIds).toEqual(ids)
    })

    it('should generate IDs that sort correctly for database queries', () => {
      const oldId = ulid(Date.now() - 10000) // 10 seconds ago
      const newId = ulid() // Now

      // String comparison should maintain chronological order
      expect(oldId < newId).toBe(true)

      // Array sort should put older ID first
      const sorted = [newId, oldId].sort()
      expect(sorted).toEqual([oldId, newId])
    })
  })

  describe('Monotonic ULID Factory', () => {
    it('should create monotonic IDs within same millisecond', () => {
      const monotonic = monotonicFactory()

      // Generate IDs rapidly (likely same millisecond)
      const ids: string[] = []
      for (let i = 0; i < 100; i++) {
        ids.push(monotonic())
      }

      // All IDs should be unique
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(100)

      // IDs should already be in sorted order (monotonically increasing)
      const sortedIds = [...ids].sort()
      expect(ids).toEqual(sortedIds)
    })

    it('should increment randomness within same millisecond', () => {
      const monotonic = monotonicFactory()

      // Generate IDs in rapid succession
      const id1 = monotonic()
      const id2 = monotonic()
      const id3 = monotonic()

      // Timestamps may be the same
      const ts1 = id1.substring(0, 10)
      const ts2 = id2.substring(0, 10)
      const ts3 = id3.substring(0, 10)

      if (ts1 === ts2 && ts2 === ts3) {
        // If timestamps are same, randomness should increment
        const rand1 = id1.substring(10)
        const rand2 = id2.substring(10)
        const rand3 = id3.substring(10)

        expect(rand1 < rand2).toBe(true)
        expect(rand2 < rand3).toBe(true)
      }

      // Regardless, IDs should be strictly increasing
      expect(id1 < id2).toBe(true)
      expect(id2 < id3).toBe(true)
    })

    it('should maintain ordering across millisecond boundaries', async () => {
      const monotonic = monotonicFactory()

      const id1 = monotonic()
      await new Promise((resolve) => setTimeout(resolve, 5))
      const id2 = monotonic()

      expect(id1 < id2).toBe(true)
    })

    it('should generate monotonic IDs with factory defaults', () => {
      // monotonicFactory without arguments uses Date.now() internally
      const monotonic = monotonicFactory()

      const ids: string[] = []
      for (let i = 0; i < 10; i++) {
        ids.push(monotonic())
      }

      // All IDs should be unique
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(10)

      // IDs should be in sorted order (monotonically increasing)
      expect(ids).toEqual([...ids].sort())
    })
  })

  describe('Timestamp Decoding', () => {
    it('should decode timestamp from ULID', () => {
      const now = Date.now()
      const id = ulid(now)

      // Input: ULID string
      // Output: Unix timestamp in milliseconds
      const decodedTime = decodeTime(id)

      expect(typeof decodedTime).toBe('number')
      expect(decodedTime).toBe(now)
    })

    it('should decode timestamp with millisecond precision', () => {
      const timestamp = 1700000000123 // Specific timestamp with ms
      const id = ulid(timestamp)

      const decodedTime = decodeTime(id)

      expect(decodedTime).toBe(timestamp)
    })

    it('should decode timestamps correctly for date range queries', () => {
      const startDate = new Date('2024-01-01T00:00:00.000Z')
      const endDate = new Date('2024-01-02T00:00:00.000Z')

      const startId = ulid(startDate.getTime())
      const endId = ulid(endDate.getTime())

      const decodedStart = decodeTime(startId)
      const decodedEnd = decodeTime(endId)

      expect(decodedStart).toBe(startDate.getTime())
      expect(decodedEnd).toBe(endDate.getTime())
      expect(decodedEnd - decodedStart).toBe(24 * 60 * 60 * 1000) // 24 hours
    })

    it('should return Date object from decoded timestamp', () => {
      const originalDate = new Date('2024-06-15T12:30:45.678Z')
      const id = ulid(originalDate.getTime())

      const decodedTime = decodeTime(id)
      const decodedDate = new Date(decodedTime)

      expect(decodedDate.getTime()).toBe(originalDate.getTime())
      expect(decodedDate.toISOString()).toBe(originalDate.toISOString())
    })
  })

  describe('Seed Time Option', () => {
    it('should generate ULID with specific timestamp', () => {
      // Input: seedTime parameter (Unix timestamp in milliseconds)
      const seedTime = 1700000000000
      const id = ulid(seedTime)

      // Output: ULID with encoded timestamp
      const decodedTime = decodeTime(id)
      expect(decodedTime).toBe(seedTime)
    })

    it('should generate different IDs with same seed time', () => {
      const seedTime = 1700000000000

      const id1 = ulid(seedTime)
      const id2 = ulid(seedTime)

      // IDs should be different (random component differs)
      expect(id1).not.toBe(id2)

      // But timestamps should be the same
      expect(id1.substring(0, 10)).toBe(id2.substring(0, 10))
    })

    it('should generate IDs in past and future', () => {
      const past = Date.now() - 86400000 // 24 hours ago
      const future = Date.now() + 86400000 // 24 hours from now

      const pastId = ulid(past)
      const futureId = ulid(future)

      expect(decodeTime(pastId)).toBe(past)
      expect(decodeTime(futureId)).toBe(future)
      expect(pastId < futureId).toBe(true)
    })

    it('should handle epoch timestamp', () => {
      const epoch = 0 // Unix epoch
      const id = ulid(epoch)

      expect(decodeTime(id)).toBe(epoch)
    })

    it('should handle max safe timestamp', () => {
      // ULID supports timestamps up to 10889-08-02
      const maxTimestamp = 281474976710655 // 48-bit max value
      const id = ulid(maxTimestamp)

      expect(decodeTime(id)).toBe(maxTimestamp)
    })
  })

  describe('Performance Characteristics', () => {
    it('should generate ULIDs quickly', () => {
      const count = 10000
      const start = performance.now()

      for (let i = 0; i < count; i++) {
        ulid()
      }

      const elapsed = performance.now() - start

      // Should generate 10000 IDs in less than 2 seconds (relaxed for CI)
      expect(elapsed).toBeLessThan(2000)
    })

    it('should generate monotonic ULIDs quickly', () => {
      const monotonic = monotonicFactory()
      const count = 10000
      const start = performance.now()

      for (let i = 0; i < count; i++) {
        monotonic()
      }

      const elapsed = performance.now() - start

      // Should generate 10000 monotonic IDs in less than 2 seconds (relaxed for CI)
      expect(elapsed).toBeLessThan(2000)
    })
  })

  describe('Collision Resistance', () => {
    it('should have extremely low collision probability', () => {
      const ids = new Set<string>()
      const count = 100000

      for (let i = 0; i < count; i++) {
        const id = ulid()
        if (ids.has(id)) {
          fail(`Collision detected at iteration ${i}`)
        }
        ids.add(id)
      }

      expect(ids.size).toBe(count)
    })

    it('should not collide even with same timestamp', () => {
      const seedTime = Date.now()
      const ids = new Set<string>()
      const count = 10000

      for (let i = 0; i < count; i++) {
        const id = ulid(seedTime)
        if (ids.has(id)) {
          fail(`Collision detected at iteration ${i} with same timestamp`)
        }
        ids.add(id)
      }

      expect(ids.size).toBe(count)
    })
  })

  describe('Usage Patterns in MBC Framework', () => {
    /**
     * This test demonstrates the pattern used in various services
     * for generating unique identifiers
     */
    it('should work as task code generator', () => {
      // Pattern used in ImportService, TaskService, etc.
      const taskCode = ulid()

      expect(taskCode).toHaveLength(26)
      expect(typeof taskCode).toBe('string')

      // Can be used directly in pk/sk
      const pk = `CSV_IMPORT#tenant001`
      const sk = `building#${taskCode}`
      const id = `${pk}#${sk}`

      expect(id).toContain(taskCode)
    })

    it('should work for entity code generation with timestamp tracking', () => {
      const beforeCreation = Date.now()
      const entityCode = ulid()
      const afterCreation = Date.now()

      // Can extract creation time from code
      const createdAt = decodeTime(entityCode)

      expect(createdAt).toBeGreaterThanOrEqual(beforeCreation)
      expect(createdAt).toBeLessThanOrEqual(afterCreation)
    })

    it('should enable time-range queries on entity codes', () => {
      // Generate IDs at different times
      const yesterday = Date.now() - 86400000
      const now = Date.now()

      const oldEntityCode = ulid(yesterday)
      const newEntityCode = ulid(now)

      // Can query entities created after certain time
      const queryStartTime = yesterday + 1000
      const queryStartCode = ulid(queryStartTime)

      // Only new entity should be after query start
      expect(oldEntityCode < queryStartCode).toBe(true)
      expect(newEntityCode > queryStartCode).toBe(true)
    })

    it('should maintain order for DynamoDB sort keys', () => {
      const monotonic = monotonicFactory()

      // Generate ordered IDs for sort key
      const skValues = Array.from({ length: 100 }, () => monotonic())

      // Verify DynamoDB BEGINS_WITH would work correctly
      const prefix = 'ITEM#'
      const fullSks = skValues.map((sk) => `${prefix}${sk}`)

      // Lexicographic sort should maintain insertion order
      const sorted = [...fullSks].sort()
      expect(sorted).toEqual(fullSks)
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent generation', async () => {
      // Simulate concurrent ULID generation
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(ulid()),
      )

      const ids = await Promise.all(promises)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(100)
    })

    it('should handle very old timestamps', () => {
      // Year 2000
      const y2k = new Date('2000-01-01T00:00:00.000Z').getTime()
      const id = ulid(y2k)

      expect(decodeTime(id)).toBe(y2k)
    })

    it('should handle recent timestamps accurately', () => {
      const recent = Date.now()
      const id = ulid(recent)

      // Should decode to exact same timestamp
      expect(decodeTime(id)).toBe(recent)
    })
  })
})
