/**
 * Performance Regression Tests
 *
 * These tests establish baseline performance expectations for critical operations.
 * When a dependency package update causes significant performance degradation,
 * these tests will fail, alerting developers to investigate.
 *
 * Note: These are not microbenchmarks. They test that operations complete within
 * reasonable time bounds to catch severe performance regressions, not to measure
 * exact performance characteristics.
 */

import 'reflect-metadata'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  plainToInstance,
  instanceToPlain,
  Expose,
  Type,
  Transform,
} from 'class-transformer'
import {
  validate,
  validateSync,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator'
import { Observable, Subject, BehaviorSubject, firstValueFrom } from 'rxjs'
import { map, filter, take, toArray } from 'rxjs/operators'
import { ulid, monotonicFactory } from 'ulid'
import { Sha256 } from '@aws-crypto/sha256-js'

// Test data generators
function generateLargeObject(
  depth: number,
  breadth: number,
): Record<string, unknown> {
  if (depth === 0) {
    return {
      string: 'value',
      number: 42,
      boolean: true,
      array: [1, 2, 3, 4, 5],
    }
  }

  const obj: Record<string, unknown> = {}
  for (let i = 0; i < breadth; i++) {
    obj[`child${i}`] = generateLargeObject(depth - 1, breadth)
  }
  return obj
}

function generateItemsArray(
  count: number,
): Array<{ id: string; value: number; data: string }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    value: i * 100,
    data: `data-${i}-${'x'.repeat(50)}`,
  }))
}

// Test DTOs
class ItemDto {
  @Expose()
  @IsString()
  id: string

  @Expose()
  @IsNumber()
  value: number

  @Expose()
  @IsString()
  data: string
}

class ContainerDto {
  @Expose()
  @IsString()
  id: string

  @Expose()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  @IsArray()
  items: ItemDto[]

  @Expose()
  @IsNumber()
  @IsOptional()
  count?: number

  @Expose()
  @IsBoolean()
  active: boolean
}

class TransformDto {
  @Expose()
  @Transform(({ value }) => value?.toUpperCase())
  name: string

  @Expose()
  @Transform(({ value }) => value * 2)
  value: number

  @Expose()
  @Type(() => Date)
  date: Date
}

describe('Performance Regression Tests', () => {
  // Increase timeout for performance tests
  jest.setTimeout(10000)

  describe('DynamoDB marshall performance', () => {
    it('should marshall 1000 simple items within 200ms', () => {
      const items = generateItemsArray(1000)

      const start = performance.now()
      for (const item of items) {
        marshall(item)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(200)
    })

    it('should marshall 100 complex nested objects within 100ms', () => {
      const complexObjects = Array.from({ length: 100 }, () =>
        generateLargeObject(3, 3),
      )

      const start = performance.now()
      for (const obj of complexObjects) {
        marshall(obj)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })

    it('should marshall object with 100 fields within 10ms', () => {
      const largeObj: Record<string, unknown> = {}
      for (let i = 0; i < 100; i++) {
        largeObj[`field${i}`] = {
          string: `value${i}`,
          number: i,
          boolean: i % 2 === 0,
        }
      }

      const start = performance.now()
      marshall(largeObj)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(10)
    })

    it('should marshall array of 500 strings within 50ms', () => {
      const data = {
        strings: Array.from(
          { length: 500 },
          (_, i) => `string-${i}-${'x'.repeat(20)}`,
        ),
      }

      const start = performance.now()
      marshall(data)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(50)
    })
  })

  describe('DynamoDB unmarshall performance', () => {
    it('should unmarshall 1000 simple items within 200ms', () => {
      const items = generateItemsArray(1000).map((item) => marshall(item))

      const start = performance.now()
      for (const item of items) {
        unmarshall(item)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(200)
    })

    it('should unmarshall 100 complex nested objects within 100ms', () => {
      const marshalledObjects = Array.from({ length: 100 }, () =>
        marshall(generateLargeObject(3, 3)),
      )

      const start = performance.now()
      for (const obj of marshalledObjects) {
        unmarshall(obj)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })
  })

  describe('class-transformer performance', () => {
    it('should transform 500 simple objects within 100ms', () => {
      const plainObjects = generateItemsArray(500)

      const start = performance.now()
      for (const obj of plainObjects) {
        plainToInstance(ItemDto, obj)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })

    it('should transform 100 objects with nested arrays within 100ms', () => {
      const containers = Array.from({ length: 100 }, (_, i) => ({
        id: `container-${i}`,
        items: generateItemsArray(10),
        count: 10,
        active: true,
      }))

      const start = performance.now()
      for (const container of containers) {
        plainToInstance(ContainerDto, container)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })

    it('should apply transforms to 500 objects within 100ms', () => {
      const objects = Array.from({ length: 500 }, (_, i) => ({
        name: 'test',
        value: i,
        date: '2024-01-01T00:00:00Z',
      }))

      const start = performance.now()
      for (const obj of objects) {
        plainToInstance(TransformDto, obj)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })

    it('should serialize 500 instances to plain within 100ms', () => {
      const instances = generateItemsArray(500).map((obj) =>
        plainToInstance(ItemDto, obj),
      )

      const start = performance.now()
      for (const instance of instances) {
        instanceToPlain(instance)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })
  })

  describe('class-validator performance', () => {
    it('should validate 200 valid objects synchronously within 200ms', () => {
      const instances = generateItemsArray(200).map((obj) => {
        const instance = new ItemDto()
        instance.id = obj.id
        instance.value = obj.value
        instance.data = obj.data
        return instance
      })

      const start = performance.now()
      for (const instance of instances) {
        validateSync(instance)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(200)
    })

    it('should validate 100 objects asynchronously within 300ms', async () => {
      const instances = generateItemsArray(100).map((obj) => {
        const instance = new ItemDto()
        instance.id = obj.id
        instance.value = obj.value
        instance.data = obj.data
        return instance
      })

      const start = performance.now()
      await Promise.all(instances.map((instance) => validate(instance)))
      const duration = performance.now() - start

      expect(duration).toBeLessThan(300)
    })

    it('should validate 50 objects with nested validation within 200ms', async () => {
      const containers = Array.from({ length: 50 }, (_, i) => {
        const container = new ContainerDto()
        container.id = `container-${i}`
        container.items = generateItemsArray(10).map((obj) => {
          const item = new ItemDto()
          item.id = obj.id
          item.value = obj.value
          item.data = obj.data
          return item
        })
        container.count = 10
        container.active = true
        return container
      })

      const start = performance.now()
      await Promise.all(containers.map((container) => validate(container)))
      const duration = performance.now() - start

      expect(duration).toBeLessThan(200)
    })
  })

  describe('RxJS performance', () => {
    it('should process 10000 values through operators within 100ms', async () => {
      const subject = new Subject<number>()
      const processed$ = subject.pipe(
        filter((x) => x % 2 === 0),
        map((x) => x * 2),
        take(5000),
        toArray(),
      )

      const resultPromise = firstValueFrom(processed$)

      const start = performance.now()
      for (let i = 0; i < 10000; i++) {
        subject.next(i)
      }
      await resultPromise
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })

    it('should handle 1000 subscriptions and emissions within 100ms', () => {
      const subject = new Subject<number>()
      const subscriptions: Array<() => void> = []
      let emissionCount = 0

      // Create subscriptions
      for (let i = 0; i < 100; i++) {
        const sub = subject.subscribe(() => {
          emissionCount++
        })
        subscriptions.push(() => sub.unsubscribe())
      }

      const start = performance.now()
      // Emit values
      for (let i = 0; i < 1000; i++) {
        subject.next(i)
      }
      const duration = performance.now() - start

      // Cleanup
      subscriptions.forEach((unsub) => unsub())

      expect(duration).toBeLessThan(100)
      expect(emissionCount).toBe(100 * 1000) // 100 subscribers * 1000 emissions
    })

    it('should create 1000 observables within 50ms', () => {
      const start = performance.now()
      const observables: Observable<number>[] = []

      for (let i = 0; i < 1000; i++) {
        observables.push(
          new Observable<number>((subscriber) => {
            subscriber.next(i)
            subscriber.complete()
          }),
        )
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(50)
      expect(observables.length).toBe(1000)
    })
  })

  describe('ULID generation performance', () => {
    it('should generate 10000 ULIDs within 1000ms', () => {
      const start = performance.now()
      const ids: string[] = []

      for (let i = 0; i < 10000; i++) {
        ids.push(ulid())
      }
      const duration = performance.now() - start

      // Relaxed threshold for CI environments with varying performance
      expect(duration).toBeLessThan(1000)
      expect(ids.length).toBe(10000)

      // Verify uniqueness
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(10000)
    })

    it('should generate 10000 monotonic ULIDs within 1000ms', () => {
      const factory = monotonicFactory()

      const start = performance.now()
      const ids: string[] = []

      for (let i = 0; i < 10000; i++) {
        ids.push(factory())
      }
      const duration = performance.now() - start

      // Relaxed threshold for CI environments with varying performance
      expect(duration).toBeLessThan(1000)
      expect(ids.length).toBe(10000)

      // Verify monotonic ordering
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i] > ids[i - 1]).toBe(true)
      }
    })
  })

  describe('SHA256 hashing performance', () => {
    it('should hash 1000 small strings within 1000ms', async () => {
      const strings = Array.from(
        { length: 1000 },
        (_, i) => `string-to-hash-${i}`,
      )

      const start = performance.now()
      for (const str of strings) {
        const hash = new Sha256()
        hash.update(str)
        await hash.digest()
      }
      const duration = performance.now() - start

      // Relaxed threshold for CI environments with varying performance
      expect(duration).toBeLessThan(1000)
    })

    it('should hash 100 large strings (10KB each) within 1000ms', async () => {
      const largeStrings = Array.from(
        { length: 100 },
        (_, i) => 'x'.repeat(10240) + i,
      )

      const start = performance.now()
      for (const str of largeStrings) {
        const hash = new Sha256()
        hash.update(str)
        await hash.digest()
      }
      const duration = performance.now() - start

      // Relaxed threshold for CI environments with varying performance
      expect(duration).toBeLessThan(1000)
    })

    it('should hash binary data (1MB total) within 500ms', async () => {
      const binaryData = Buffer.alloc(1024 * 1024, 'x') // 1MB

      const start = performance.now()
      const hash = new Sha256()
      hash.update(binaryData)
      await hash.digest()
      const duration = performance.now() - start

      expect(duration).toBeLessThan(500)
    })
  })

  describe('Combined operation performance', () => {
    it('should process full CQRS flow (marshall, transform, validate) within 500ms for 100 items', async () => {
      const rawItems = generateItemsArray(100).map((item) => ({
        pk: `ITEM#${item.id}`,
        sk: 'DATA',
        ...item,
      }))

      const start = performance.now()

      // Step 1: Marshall to DynamoDB format
      const marshalled = rawItems.map((item) => marshall(item))

      // Step 2: Unmarshall (simulating read from DynamoDB)
      const unmarshalled = marshalled.map((item) => unmarshall(item))

      // Step 3: Transform to DTO
      const instances = unmarshalled.map((item) =>
        plainToInstance(ItemDto, {
          id: item.id,
          value: item.value,
          data: item.data,
        }),
      )

      // Step 4: Validate
      await Promise.all(instances.map((instance) => validate(instance)))

      // Step 5: Serialize back to plain
      const plains = instances.map((instance) => instanceToPlain(instance))

      // Step 6: Marshall for storage
      plains.map((plain) => marshall(plain))

      const duration = performance.now() - start

      expect(duration).toBeLessThan(500)
    })

    it('should handle event sourcing pattern within 300ms for 500 events', () => {
      const events = Array.from({ length: 500 }, (_, i) => ({
        eventId: ulid(),
        aggregateId: 'order-001',
        eventType:
          i % 3 === 0
            ? 'ItemAdded'
            : i % 3 === 1
              ? 'ItemRemoved'
              : 'QuantityChanged',
        version: i + 1,
        timestamp: new Date().toISOString(),
        payload: {
          productId: `prod-${i % 10}`,
          quantity: Math.floor(Math.random() * 10) + 1,
        },
      }))

      const start = performance.now()

      // Marshall all events
      const marshalledEvents = events.map((event) => marshall(event))

      // Unmarshall all events
      const unmarshalledEvents = marshalledEvents.map((event) =>
        unmarshall(event),
      )

      // Group by event type
      const grouped = unmarshalledEvents.reduce(
        (acc, event) => {
          const type = event.eventType as string
          if (!acc[type]) acc[type] = []
          acc[type].push(event)
          return acc
        },
        {} as Record<string, unknown[]>,
      )

      const duration = performance.now() - start

      expect(duration).toBeLessThan(300)
      expect(Object.keys(grouped).length).toBe(3)
    })
  })

  describe('Memory-conscious operations', () => {
    it('should not cause memory issues with large batch processing', () => {
      // Process in batches to avoid memory issues
      const batchSize = 100
      const totalItems = 1000
      let processedCount = 0

      const start = performance.now()

      for (let batch = 0; batch < totalItems / batchSize; batch++) {
        const items = generateItemsArray(batchSize)
        const marshalled = items.map((item) => marshall(item))
        const unmarshalled = marshalled.map((item) => unmarshall(item))
        processedCount += unmarshalled.length
      }

      const duration = performance.now() - start

      expect(duration).toBeLessThan(500)
      expect(processedCount).toBe(totalItems)
    })
  })
})
