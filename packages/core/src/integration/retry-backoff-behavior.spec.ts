/**
 * Retry and Backoff Behavioral Tests
 *
 * These tests verify retry strategies and exponential backoff patterns
 * commonly used for handling transient failures in AWS services
 * (DynamoDB, SQS, SNS, etc.)
 */

describe('Retry and Backoff Behavioral Tests', () => {
  describe('Exponential backoff calculation', () => {
    const calculateBackoff = (
      attempt: number,
      baseDelayMs: number,
      maxDelayMs: number,
    ): number => {
      const delay = baseDelayMs * Math.pow(2, attempt)
      return Math.min(delay, maxDelayMs)
    }

    it('should calculate correct exponential delays', () => {
      const baseDelay = 100

      expect(calculateBackoff(0, baseDelay, 10000)).toBe(100) // 100 * 2^0
      expect(calculateBackoff(1, baseDelay, 10000)).toBe(200) // 100 * 2^1
      expect(calculateBackoff(2, baseDelay, 10000)).toBe(400) // 100 * 2^2
      expect(calculateBackoff(3, baseDelay, 10000)).toBe(800) // 100 * 2^3
      expect(calculateBackoff(4, baseDelay, 10000)).toBe(1600) // 100 * 2^4
    })

    it('should cap at maximum delay', () => {
      const baseDelay = 100
      const maxDelay = 1000

      expect(calculateBackoff(0, baseDelay, maxDelay)).toBe(100)
      expect(calculateBackoff(3, baseDelay, maxDelay)).toBe(800)
      expect(calculateBackoff(4, baseDelay, maxDelay)).toBe(1000) // Capped
      expect(calculateBackoff(5, baseDelay, maxDelay)).toBe(1000) // Capped
      expect(calculateBackoff(10, baseDelay, maxDelay)).toBe(1000) // Capped
    })
  })

  describe('Jitter calculation', () => {
    const addJitter = (delayMs: number, jitterFactor: number): number => {
      const jitter = delayMs * jitterFactor * Math.random()
      return Math.floor(delayMs + jitter)
    }

    it('should add jitter within expected range', () => {
      const baseDelay = 1000
      const jitterFactor = 0.5

      for (let i = 0; i < 100; i++) {
        const jitteredDelay = addJitter(baseDelay, jitterFactor)

        expect(jitteredDelay).toBeGreaterThanOrEqual(baseDelay)
        expect(jitteredDelay).toBeLessThanOrEqual(baseDelay * 1.5)
      }
    })

    it('should produce varying delays (decorrelated jitter)', () => {
      const baseDelay = 1000
      const jitterFactor = 0.5
      const delays = new Set<number>()

      for (let i = 0; i < 50; i++) {
        delays.add(addJitter(baseDelay, jitterFactor))
      }

      // With jitter, we should see multiple different values
      expect(delays.size).toBeGreaterThan(10)
    })
  })

  describe('Full jitter strategy (AWS recommended)', () => {
    const fullJitter = (
      attempt: number,
      baseDelayMs: number,
      maxDelayMs: number,
    ): number => {
      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt))
      return Math.floor(Math.random() * exponentialDelay)
    }

    it('should produce delays between 0 and exponential delay', () => {
      const baseDelay = 100
      const maxDelay = 10000

      for (let attempt = 0; attempt < 5; attempt++) {
        for (let i = 0; i < 50; i++) {
          const delay = fullJitter(attempt, baseDelay, maxDelay)
          const maxForAttempt = baseDelay * Math.pow(2, attempt)

          expect(delay).toBeGreaterThanOrEqual(0)
          expect(delay).toBeLessThan(maxForAttempt)
        }
      }
    })
  })

  describe('Retry with exponential backoff implementation', () => {
    interface RetryConfig {
      maxRetries: number
      baseDelayMs: number
      maxDelayMs: number
      shouldRetry?: (error: Error) => boolean
    }

    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms))

    const retryWithBackoff = async <T>(
      operation: () => Promise<T>,
      config: RetryConfig,
    ): Promise<T> => {
      const { maxRetries, baseDelayMs, maxDelayMs, shouldRetry } = config

      let lastError: Error | null = null

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await operation()
        } catch (error: any) {
          lastError = error

          // Check if we should retry this error
          if (shouldRetry && !shouldRetry(error)) {
            throw error
          }

          // Don't wait after last attempt
          if (attempt < maxRetries) {
            const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt))
            await sleep(delay)
          }
        }
      }

      throw lastError
    }

    it('should succeed on first try if no error', async () => {
      let attempts = 0

      const result = await retryWithBackoff(
        async () => {
          attempts++
          return 'success'
        },
        { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 },
      )

      expect(result).toBe('success')
      expect(attempts).toBe(1)
    })

    it('should retry and eventually succeed', async () => {
      let attempts = 0

      const result = await retryWithBackoff(
        async () => {
          attempts++
          if (attempts < 3) {
            throw new Error(`Attempt ${attempts} failed`)
          }
          return 'eventual-success'
        },
        { maxRetries: 5, baseDelayMs: 5, maxDelayMs: 50 },
      )

      expect(result).toBe('eventual-success')
      expect(attempts).toBe(3)
    })

    it('should fail after max retries', async () => {
      let attempts = 0

      await expect(
        retryWithBackoff(
          async () => {
            attempts++
            throw new Error(`Attempt ${attempts} failed`)
          },
          { maxRetries: 3, baseDelayMs: 5, maxDelayMs: 50 },
        ),
      ).rejects.toThrow('Attempt 4 failed')

      expect(attempts).toBe(4) // 1 initial + 3 retries
    })

    it('should not retry when shouldRetry returns false', async () => {
      let attempts = 0

      class NonRetryableError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'NonRetryableError'
        }
      }

      await expect(
        retryWithBackoff(
          async () => {
            attempts++
            throw new NonRetryableError('Do not retry')
          },
          {
            maxRetries: 5,
            baseDelayMs: 5,
            maxDelayMs: 50,
            shouldRetry: (error) => !(error instanceof NonRetryableError),
          },
        ),
      ).rejects.toThrow('Do not retry')

      expect(attempts).toBe(1) // No retries
    })

    it('should measure increasing delays between attempts', async () => {
      const attemptTimes: number[] = []
      let attempts = 0

      const startTime = Date.now()

      try {
        await retryWithBackoff(
          async () => {
            attempts++
            attemptTimes.push(Date.now() - startTime)
            throw new Error('Always fail')
          },
          { maxRetries: 3, baseDelayMs: 20, maxDelayMs: 200 },
        )
      } catch {
        // Expected
      }

      // Verify delays increase (with some tolerance for timing)
      if (attemptTimes.length >= 3) {
        const delay1 = attemptTimes[1] - attemptTimes[0]
        const delay2 = attemptTimes[2] - attemptTimes[1]

        // delay2 should be roughly 2x delay1 (exponential backoff)
        expect(delay2).toBeGreaterThanOrEqual(delay1 * 1.5)
      }
    })
  })

  describe('Circuit breaker pattern', () => {
    enum CircuitState {
      CLOSED = 'CLOSED',
      OPEN = 'OPEN',
      HALF_OPEN = 'HALF_OPEN',
    }

    class CircuitBreaker {
      private state: CircuitState = CircuitState.CLOSED
      private failures = 0
      private lastFailureTime = 0

      constructor(
        private failureThreshold: number,
        private resetTimeoutMs: number,
      ) {}

      async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
          if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
            this.state = CircuitState.HALF_OPEN
          } else {
            throw new Error('Circuit is open')
          }
        }

        try {
          const result = await operation()

          if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.CLOSED
            this.failures = 0
          }

          return result
        } catch (error) {
          this.failures++
          this.lastFailureTime = Date.now()

          if (this.failures >= this.failureThreshold) {
            this.state = CircuitState.OPEN
          }

          throw error
        }
      }

      getState(): CircuitState {
        return this.state
      }
    }

    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker(3, 1000)
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should open after threshold failures', async () => {
      const breaker = new CircuitBreaker(3, 1000)

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Failure')
          })
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN)
    })

    it('should reject calls when open', async () => {
      const breaker = new CircuitBreaker(1, 10000)

      // Trip the circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Trip')
        })
      } catch {
        // Expected
      }

      // Should reject
      await expect(
        breaker.execute(async () => 'should-not-run'),
      ).rejects.toThrow('Circuit is open')
    })

    it('should transition to HALF_OPEN after timeout', async () => {
      const breaker = new CircuitBreaker(1, 50)

      // Trip the circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Trip')
        })
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN)

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 60))

      // Next call should transition to HALF_OPEN and execute
      const result = await breaker.execute(async () => 'recovered')

      expect(result).toBe('recovered')
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })
  })

  describe('Retry budget pattern', () => {
    class RetryBudget {
      private tokens: number
      private lastRefillTime: number

      constructor(
        private maxTokens: number,
        private refillRatePerSecond: number,
      ) {
        this.tokens = maxTokens
        this.lastRefillTime = Date.now()
      }

      canRetry(): boolean {
        this.refill()
        return this.tokens > 0
      }

      consumeRetry(): boolean {
        this.refill()
        if (this.tokens > 0) {
          this.tokens--
          return true
        }
        return false
      }

      private refill(): void {
        const now = Date.now()
        const elapsed = (now - this.lastRefillTime) / 1000
        const tokensToAdd = elapsed * this.refillRatePerSecond

        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
        this.lastRefillTime = now
      }

      getTokens(): number {
        this.refill()
        return Math.floor(this.tokens)
      }
    }

    it('should start with max tokens', () => {
      const budget = new RetryBudget(10, 1)
      expect(budget.getTokens()).toBe(10)
    })

    it('should consume tokens on retry', () => {
      const budget = new RetryBudget(10, 1)

      expect(budget.consumeRetry()).toBe(true)
      expect(budget.getTokens()).toBe(9)

      expect(budget.consumeRetry()).toBe(true)
      expect(budget.getTokens()).toBe(8)
    })

    it('should deny retries when budget exhausted', () => {
      const budget = new RetryBudget(2, 0) // No refill

      expect(budget.consumeRetry()).toBe(true)
      expect(budget.consumeRetry()).toBe(true)
      expect(budget.consumeRetry()).toBe(false)
      expect(budget.canRetry()).toBe(false)
    })

    it('should refill tokens over time', async () => {
      const budget = new RetryBudget(5, 100) // 100 tokens per second

      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        budget.consumeRetry()
      }

      expect(budget.getTokens()).toBe(0)

      // Wait for refill
      await new Promise((r) => setTimeout(r, 50))

      // Should have refilled some tokens
      expect(budget.getTokens()).toBeGreaterThan(0)
    })
  })

  describe('Transient error detection', () => {
    const isTransientError = (error: Error): boolean => {
      // HTTP status code based detection
      const statusCode = (error as any).statusCode || (error as any).status

      if (statusCode) {
        // 5xx server errors are often transient
        if (statusCode >= 500 && statusCode < 600) return true

        // 429 Too Many Requests is transient
        if (statusCode === 429) return true

        // 408 Request Timeout is transient
        if (statusCode === 408) return true
      }

      // AWS SDK specific errors
      const errorCode = (error as any).code

      const transientCodes = [
        'ProvisionedThroughputExceededException',
        'ThrottlingException',
        'ServiceUnavailable',
        'InternalServerError',
        'RequestLimitExceeded',
        'TooManyRequestsException',
      ]

      if (errorCode && transientCodes.includes(errorCode)) {
        return true
      }

      // Network errors
      const networkErrorMessages = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'socket hang up',
        'network error',
      ]

      if (networkErrorMessages.some((msg) => error.message.includes(msg))) {
        return true
      }

      return false
    }

    it('should detect HTTP 5xx as transient', () => {
      const error = new Error('Internal Server Error') as any
      error.statusCode = 500

      expect(isTransientError(error)).toBe(true)
    })

    it('should detect HTTP 429 as transient', () => {
      const error = new Error('Too Many Requests') as any
      error.statusCode = 429

      expect(isTransientError(error)).toBe(true)
    })

    it('should detect HTTP 400 as non-transient', () => {
      const error = new Error('Bad Request') as any
      error.statusCode = 400

      expect(isTransientError(error)).toBe(false)
    })

    it('should detect DynamoDB throttling as transient', () => {
      const error = new Error('Throughput exceeded') as any
      error.code = 'ProvisionedThroughputExceededException'

      expect(isTransientError(error)).toBe(true)
    })

    it('should detect network errors as transient', () => {
      const connectionReset = new Error('ECONNRESET')
      expect(isTransientError(connectionReset)).toBe(true)

      const timeout = new Error('ETIMEDOUT')
      expect(isTransientError(timeout)).toBe(true)

      const refused = new Error('ECONNREFUSED')
      expect(isTransientError(refused)).toBe(true)
    })

    it('should detect validation errors as non-transient', () => {
      const validationError = new Error('Invalid input')
      expect(isTransientError(validationError)).toBe(false)
    })
  })

  describe('Idempotency key pattern', () => {
    class IdempotentOperationTracker {
      private completedOperations = new Map<
        string,
        { result: any; timestamp: number }
      >()
      private ttlMs: number

      constructor(ttlMs: number = 3600000) {
        // 1 hour default
        this.ttlMs = ttlMs
      }

      isCompleted(idempotencyKey: string): boolean {
        const operation = this.completedOperations.get(idempotencyKey)
        if (!operation) return false

        // Check if expired
        if (Date.now() - operation.timestamp > this.ttlMs) {
          this.completedOperations.delete(idempotencyKey)
          return false
        }

        return true
      }

      getResult(idempotencyKey: string): any | undefined {
        const operation = this.completedOperations.get(idempotencyKey)
        return operation?.result
      }

      recordCompletion(idempotencyKey: string, result: any): void {
        this.completedOperations.set(idempotencyKey, {
          result,
          timestamp: Date.now(),
        })
      }
    }

    it('should track completed operations', () => {
      const tracker = new IdempotentOperationTracker()

      expect(tracker.isCompleted('op-1')).toBe(false)

      tracker.recordCompletion('op-1', { success: true })

      expect(tracker.isCompleted('op-1')).toBe(true)
      expect(tracker.getResult('op-1')).toEqual({ success: true })
    })

    it('should return cached result for duplicate operations', () => {
      const tracker = new IdempotentOperationTracker()
      let executionCount = 0

      const idempotentExecute = (key: string): any => {
        if (tracker.isCompleted(key)) {
          return tracker.getResult(key)
        }

        executionCount++
        const result = { executedAt: Date.now() }
        tracker.recordCompletion(key, result)
        return result
      }

      const result1 = idempotentExecute('op-123')
      const result2 = idempotentExecute('op-123')
      const result3 = idempotentExecute('op-123')

      expect(executionCount).toBe(1)
      expect(result1).toEqual(result2)
      expect(result2).toEqual(result3)
    })

    it('should expire old operations', async () => {
      const tracker = new IdempotentOperationTracker(50) // 50ms TTL

      tracker.recordCompletion('op-1', 'result')
      expect(tracker.isCompleted('op-1')).toBe(true)

      // Wait for expiration
      await new Promise((r) => setTimeout(r, 60))

      expect(tracker.isCompleted('op-1')).toBe(false)
    })
  })
})
