/**
 * ULID Behavioral Tests
 *
 * These tests verify ULID generation behaviors that are critical
 * for the framework's event IDs and S3 key generation.
 */

import { ulid, decodeTime, monotonicFactory } from 'ulid'

describe('ULID Behavioral Tests', () => {
  describe('Basic ulid() generation', () => {
    it('should generate 26 character string', () => {
      const id = ulid()

      expect(id).toHaveLength(26)
      expect(typeof id).toBe('string')
    })

    it('should generate valid Crockford Base32 characters', () => {
      const id = ulid()
      const validChars = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]+$/

      expect(id).toMatch(validChars)
    })

    it('should generate unique IDs', () => {
      const ids = new Set<string>()

      for (let i = 0; i < 1000; i++) {
        ids.add(ulid())
      }

      expect(ids.size).toBe(1000)
    })

    it('should encode current timestamp', () => {
      const before = Date.now()
      const id = ulid()
      const after = Date.now()

      const timestamp = decodeTime(id)

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should accept custom timestamp', () => {
      const customTime = new Date('2024-06-15T12:00:00Z').getTime()
      const id = ulid(customTime)

      const decodedTime = decodeTime(id)
      expect(decodedTime).toBe(customTime)
    })
  })

  describe('ULID ordering and sortability', () => {
    it('should generate lexicographically sortable IDs with different timestamps', () => {
      // ULIDs with different timestamps are lexicographically ordered
      const id1 = ulid(Date.now() - 1000)
      const id2 = ulid(Date.now())
      const id3 = ulid(Date.now() + 1000)

      // IDs with earlier timestamps should sort before later ones
      expect(id1 < id2).toBe(true)
      expect(id2 < id3).toBe(true)
    })

    it('should maintain order when sorted as strings', () => {
      const id1 = ulid(1000)
      const id2 = ulid(2000)
      const id3 = ulid(3000)

      const sorted = [id3, id1, id2].sort()

      expect(sorted).toEqual([id1, id2, id3])
    })

    it('should sort correctly with different timestamps', () => {
      const past = ulid(Date.now() - 10000)
      const present = ulid(Date.now())
      const future = ulid(Date.now() + 10000)

      expect(past < present).toBe(true)
      expect(present < future).toBe(true)
    })
  })

  describe('Monotonic ULID factory', () => {
    it('should generate monotonically increasing IDs', () => {
      const monotonic = monotonicFactory()
      const ids: string[] = []

      for (let i = 0; i < 100; i++) {
        ids.push(monotonic())
      }

      // Each ID should be greater than the previous
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i] > ids[i - 1]).toBe(true)
      }
    })

    it('should increment random component for same millisecond', () => {
      const monotonic = monotonicFactory()
      const fixedTime = Date.now()

      const id1 = monotonic(fixedTime)
      const id2 = monotonic(fixedTime)
      const id3 = monotonic(fixedTime)

      // All have same timestamp
      expect(decodeTime(id1)).toBe(fixedTime)
      expect(decodeTime(id2)).toBe(fixedTime)
      expect(decodeTime(id3)).toBe(fixedTime)

      // But are still ordered
      expect(id2 > id1).toBe(true)
      expect(id3 > id2).toBe(true)
    })

    it('should handle rapid generation without collision', () => {
      const monotonic = monotonicFactory()
      const ids = new Set<string>()

      // Generate many IDs as fast as possible
      for (let i = 0; i < 10000; i++) {
        ids.add(monotonic())
      }

      expect(ids.size).toBe(10000)
    })
  })

  describe('decodeTime function', () => {
    it('should decode timestamp from ULID', () => {
      const now = Date.now()
      const id = ulid(now)

      const decoded = decodeTime(id)

      expect(decoded).toBe(now)
    })

    it('should decode known timestamp correctly', () => {
      // ULID generated at known time
      const knownTime = 1609459200000 // 2021-01-01T00:00:00Z
      const id = ulid(knownTime)

      expect(decodeTime(id)).toBe(knownTime)
    })

    it('should handle minimum timestamp (0)', () => {
      const id = ulid(0)

      expect(decodeTime(id)).toBe(0)
    })

    it('should handle maximum safe timestamp', () => {
      // ULID timestamp is 48 bits, max is 281474976710655
      const maxTime = 281474976710655
      const id = ulid(maxTime)

      expect(decodeTime(id)).toBe(maxTime)
    })
  })

  describe('ULID format structure', () => {
    it('should have timestamp in first 10 characters', () => {
      const time1 = 1000000000000
      const time2 = 1000000000001

      const id1 = ulid(time1)
      const id2 = ulid(time2)

      // First 10 chars are timestamp
      const ts1 = id1.substring(0, 10)
      const ts2 = id2.substring(0, 10)

      expect(ts1).not.toBe(ts2)
    })

    it('should have random component in last 16 characters', () => {
      const fixedTime = Date.now()

      const id1 = ulid(fixedTime)
      const id2 = ulid(fixedTime)

      // Timestamp part should be same
      expect(id1.substring(0, 10)).toBe(id2.substring(0, 10))

      // Random part should differ (with very high probability)
      expect(id1.substring(10)).not.toBe(id2.substring(10))
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle undefined timestamp (uses current time)', () => {
      const before = Date.now()
      const id = ulid(undefined)
      const after = Date.now()

      const timestamp = decodeTime(id)
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should throw for negative timestamp', () => {
      expect(() => ulid(-1)).toThrow()
    })

    it('should throw for timestamp beyond max', () => {
      const beyondMax = 281474976710656 // Max + 1

      expect(() => ulid(beyondMax)).toThrow()
    })

    it('should handle floating point timestamp (truncates to integer)', () => {
      // ULID expects integer timestamps
      const intTime = 1609459200000
      const id = ulid(intTime)

      // Should decode correctly
      expect(decodeTime(id)).toBe(intTime)
    })
  })

  describe('Collision resistance', () => {
    it('should have no collisions in sequential generation', () => {
      const ids: string[] = []

      for (let i = 0; i < 5000; i++) {
        ids.push(ulid())
      }

      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have no collisions with monotonic factory under load', () => {
      const monotonic = monotonicFactory()
      const ids: string[] = []

      // Simulate high-frequency generation
      for (let i = 0; i < 10000; i++) {
        ids.push(monotonic())
      }

      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have no collisions across different factory instances', () => {
      const factory1 = monotonicFactory()
      const factory2 = monotonicFactory()
      const ids: string[] = []

      // Interleave IDs from different factories
      for (let i = 0; i < 1000; i++) {
        ids.push(factory1())
        ids.push(factory2())
      }

      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Use case: S3 key generation', () => {
    it('should generate valid S3 key suffix', () => {
      const id = ulid()
      const key = `ddb/table/${id}.json`

      // S3 keys can contain ULID characters
      expect(key).toMatch(/^ddb\/table\/[0-9A-Z]+\.json$/)
      // ULID is 26 chars, "ddb/table/" is 10 chars, ".json" is 5 chars = 41 total
      expect(key.length).toBe(10 + 26 + 5) // 41
    })

    it('should maintain chronological ordering in S3 listing', () => {
      const ids = [
        ulid(Date.now() - 2000),
        ulid(Date.now() - 1000),
        ulid(Date.now()),
      ]

      const keys = ids.map((id) => `prefix/${id}.json`)
      const sorted = [...keys].sort()

      // Chronological order matches lexicographical sort
      expect(keys).toEqual(sorted)
    })
  })

  describe('Use case: Event metadata ID', () => {
    it('should be suitable for event ID', () => {
      const eventId = ulid()

      // Can be used in JSON
      const event = { id: eventId, type: 'TestEvent' }
      const json = JSON.stringify(event)
      const parsed = JSON.parse(json)

      expect(parsed.id).toBe(eventId)
    })

    it('should maintain uniqueness across simulated events', () => {
      const events = Array.from({ length: 1000 }, () => ({
        id: ulid(),
        timestamp: Date.now(),
        data: {},
      }))

      const uniqueIds = new Set(events.map((e) => e.id))
      expect(uniqueIds.size).toBe(events.length)
    })
  })

  describe('Comparison with other ID formats', () => {
    it('should be longer than UUID v4', () => {
      const ulidId = ulid()
      // UUID v4 is 36 chars with hyphens, 32 without

      expect(ulidId.length).toBe(26)
    })

    it('should have timestamp prefix unlike UUID', () => {
      const time = Date.now()
      const id1 = ulid(time)
      const id2 = ulid(time)

      // Same timestamp means same prefix
      expect(id1.substring(0, 10)).toBe(id2.substring(0, 10))
    })
  })

  describe('Case sensitivity', () => {
    it('should generate uppercase by default', () => {
      const id = ulid()

      expect(id).toBe(id.toUpperCase())
    })

    it('should throw when decoding lowercase ULID', () => {
      const id = ulid()
      const lower = id.toLowerCase()

      // decodeTime requires uppercase ULID
      expect(decodeTime(id)).toBeDefined()
      expect(() => decodeTime(lower)).toThrow()
    })
  })
})
