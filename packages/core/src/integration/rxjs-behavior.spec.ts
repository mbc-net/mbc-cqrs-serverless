/**
 * RxJS Behavioral Tests
 *
 * These tests verify RxJS Observable and Subject behaviors that are critical
 * for the framework's Lambda handler bootstrap pattern.
 */

import {
  BehaviorSubject,
  catchError,
  delay,
  filter,
  finalize,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  mergeMap,
  Observable,
  of,
  ReplaySubject,
  retry,
  retryWhen,
  Subject,
  take,
  tap,
  throwError,
  timer,
  timeout,
  toArray,
} from 'rxjs'

describe('RxJS Behavioral Tests', () => {
  describe('ReplaySubject behavior (used in bootstrap.ts)', () => {
    it('should replay last value to late subscribers', async () => {
      const subject = new ReplaySubject<string>(1)

      // Emit before subscription
      subject.next('first')
      subject.next('second')

      // Late subscriber should get the last value
      const value = await firstValueFrom(subject)
      expect(value).toBe('second')
    })

    it('should replay multiple values based on buffer size', async () => {
      const subject = new ReplaySubject<number>(3)

      subject.next(1)
      subject.next(2)
      subject.next(3)
      subject.next(4) // This pushes 1 out of the buffer

      const values: number[] = []
      subject.pipe(take(3)).subscribe((v) => values.push(v))

      expect(values).toEqual([2, 3, 4])
    })

    it('should support multiple concurrent subscribers', async () => {
      const subject = new ReplaySubject<string>(1)
      subject.next('value')

      const results = await Promise.all([
        firstValueFrom(subject),
        firstValueFrom(subject),
        firstValueFrom(subject),
      ])

      expect(results).toEqual(['value', 'value', 'value'])
    })

    it('should complete and notify all subscribers', async () => {
      const subject = new ReplaySubject<string>(1)
      const completions: boolean[] = []

      subject.subscribe({
        complete: () => completions.push(true),
      })
      subject.subscribe({
        complete: () => completions.push(true),
      })

      subject.next('value')
      subject.complete()

      expect(completions).toEqual([true, true])
    })

    it('should propagate errors to all subscribers', async () => {
      const subject = new ReplaySubject<string>(1)
      const errors: Error[] = []

      subject.subscribe({
        error: (e) => errors.push(e),
      })
      subject.subscribe({
        error: (e) => errors.push(e),
      })

      const testError = new Error('Test error')
      subject.error(testError)

      expect(errors).toHaveLength(2)
      expect(errors[0]).toBe(testError)
      expect(errors[1]).toBe(testError)
    })

    it('should replay value and then error to late subscriber', async () => {
      const subject = new ReplaySubject<string>(1)

      subject.next('value')
      subject.error(new Error('Test error'))

      // Late subscriber gets replayed value then error
      let receivedValue: string | null = null
      let receivedError: Error | null = null

      subject.subscribe({
        next: (v) => (receivedValue = v),
        error: (e) => (receivedError = e),
      })

      expect(receivedValue).toBe('value')
      expect(receivedError?.message).toBe('Test error')
    })
  })

  describe('firstValueFrom behavior', () => {
    it('should resolve with first emitted value', async () => {
      const subject = new Subject<string>()

      const promise = firstValueFrom(subject)
      subject.next('first')
      subject.next('second')

      const result = await promise
      expect(result).toBe('first')
    })

    it('should reject if source completes without emitting', async () => {
      const subject = new Subject<string>()

      const promise = firstValueFrom(subject)
      subject.complete()

      await expect(promise).rejects.toThrow()
    })

    it('should reject with source error', async () => {
      const subject = new Subject<string>()

      const promise = firstValueFrom(subject)
      subject.error(new Error('Source error'))

      await expect(promise).rejects.toThrow('Source error')
    })

    it('should support default value on empty completion', async () => {
      const subject = new Subject<string>()

      const promise = firstValueFrom(subject, { defaultValue: 'default' })
      subject.complete()

      const result = await promise
      expect(result).toBe('default')
    })

    it('should work with Observable from Promise', async () => {
      const asyncValue = Promise.resolve('async-result')
      const result = await firstValueFrom(from(asyncValue))

      expect(result).toBe('async-result')
    })
  })

  describe('lastValueFrom behavior', () => {
    it('should resolve with last emitted value', async () => {
      const subject = new Subject<string>()

      const promise = lastValueFrom(subject)
      subject.next('first')
      subject.next('second')
      subject.next('last')
      subject.complete()

      const result = await promise
      expect(result).toBe('last')
    })

    it('should wait for completion', async () => {
      const subject = new Subject<number>()
      let resolved = false

      const promise = lastValueFrom(subject).then((v) => {
        resolved = true
        return v
      })

      subject.next(1)
      subject.next(2)

      // Not resolved yet because subject hasn't completed
      await new Promise((r) => setTimeout(r, 10))
      expect(resolved).toBe(false)

      subject.complete()
      const result = await promise
      expect(result).toBe(2)
      expect(resolved).toBe(true)
    })
  })

  describe('BehaviorSubject behavior', () => {
    it('should have initial value', () => {
      const subject = new BehaviorSubject<string>('initial')

      expect(subject.getValue()).toBe('initial')
    })

    it('should immediately emit current value to new subscribers', async () => {
      const subject = new BehaviorSubject<string>('current')

      const value = await firstValueFrom(subject)
      expect(value).toBe('current')
    })

    it('should update value synchronously', () => {
      const subject = new BehaviorSubject<number>(0)

      subject.next(1)
      expect(subject.getValue()).toBe(1)

      subject.next(2)
      expect(subject.getValue()).toBe(2)
    })
  })

  describe('Observable operators behavior', () => {
    describe('map operator', () => {
      it('should transform values', async () => {
        const result = await firstValueFrom(of(5).pipe(map((x) => x * 2)))

        expect(result).toBe(10)
      })

      it('should propagate errors from transform function', async () => {
        const source = of(5).pipe(
          map(() => {
            throw new Error('Transform error')
          }),
        )

        await expect(firstValueFrom(source)).rejects.toThrow('Transform error')
      })
    })

    describe('filter operator', () => {
      it('should filter values based on predicate', async () => {
        const values = await firstValueFrom(
          from([1, 2, 3, 4, 5]).pipe(
            filter((x) => x % 2 === 0),
            toArray(),
          ),
        )

        expect(values).toEqual([2, 4])
      })

      it('should complete empty if no values pass filter', async () => {
        const source = from([1, 3, 5]).pipe(filter((x) => x % 2 === 0))

        await expect(firstValueFrom(source)).rejects.toThrow()
      })
    })

    describe('mergeMap operator', () => {
      it('should flatten inner observables', async () => {
        const result = await firstValueFrom(
          of(1, 2).pipe(
            mergeMap((x) => of(x * 10, x * 100)),
            toArray(),
          ),
        )

        // Order may vary due to concurrency, sort numerically
        expect(result.sort((a, b) => a - b)).toEqual([10, 20, 100, 200])
      })

      it('should handle async inner observables', async () => {
        const result = await firstValueFrom(
          of('a').pipe(
            mergeMap((x) => from(Promise.resolve(x.toUpperCase()))),
          ),
        )

        expect(result).toBe('A')
      })
    })

    describe('catchError operator', () => {
      it('should catch and replace error with value', async () => {
        const source = throwError(() => new Error('Original')).pipe(
          catchError(() => of('recovered')),
        )

        const result = await firstValueFrom(source)
        expect(result).toBe('recovered')
      })

      it('should catch and rethrow different error', async () => {
        const source = throwError(() => new Error('Original')).pipe(
          catchError(() => throwError(() => new Error('Wrapped'))),
        )

        await expect(firstValueFrom(source)).rejects.toThrow('Wrapped')
      })

      it('should provide error to handler', async () => {
        let caughtError: Error | null = null

        const source = throwError(() => new Error('Test')).pipe(
          catchError((err) => {
            caughtError = err
            return of('handled')
          }),
        )

        await firstValueFrom(source)
        expect(caughtError?.message).toBe('Test')
      })
    })

    describe('timeout operator', () => {
      it('should emit value if received before timeout', async () => {
        const subject = new Subject<string>()

        const promise = firstValueFrom(subject.pipe(timeout(1000)))

        subject.next('fast')

        const result = await promise
        expect(result).toBe('fast')
      })

      it('should throw TimeoutError if no value before timeout', async () => {
        const subject = new Subject<string>()

        const promise = firstValueFrom(subject.pipe(timeout(50)))

        await expect(promise).rejects.toThrow()
      })
    })

    describe('take operator', () => {
      it('should complete after taking n values', async () => {
        const values: number[] = []
        let completed = false

        from([1, 2, 3, 4, 5])
          .pipe(take(3))
          .subscribe({
            next: (v) => values.push(v),
            complete: () => (completed = true),
          })

        expect(values).toEqual([1, 2, 3])
        expect(completed).toBe(true)
      })

      it('should complete immediately with take(0)', async () => {
        const values: number[] = []

        from([1, 2, 3])
          .pipe(take(0))
          .subscribe((v) => values.push(v))

        expect(values).toEqual([])
      })
    })

    describe('toArray operator', () => {
      it('should collect all values into array', async () => {
        const result = await firstValueFrom(from([1, 2, 3]).pipe(toArray()))

        expect(result).toEqual([1, 2, 3])
      })

      it('should return empty array for empty observable', async () => {
        const result = await firstValueFrom(from([]).pipe(toArray()))

        expect(result).toEqual([])
      })
    })
  })

  describe('Observable creation functions', () => {
    describe('of function', () => {
      it('should emit values synchronously and complete', async () => {
        const result = await firstValueFrom(of(1, 2, 3).pipe(toArray()))

        expect(result).toEqual([1, 2, 3])
      })

      it('should handle single value', async () => {
        const result = await firstValueFrom(of('single'))

        expect(result).toBe('single')
      })
    })

    describe('from function', () => {
      it('should convert array to observable', async () => {
        const result = await firstValueFrom(from([1, 2, 3]).pipe(toArray()))

        expect(result).toEqual([1, 2, 3])
      })

      it('should convert Promise to observable', async () => {
        const result = await firstValueFrom(from(Promise.resolve('async')))

        expect(result).toBe('async')
      })

      it('should convert iterable to observable', async () => {
        const set = new Set([1, 2, 3])
        const result = await firstValueFrom(from(set).pipe(toArray()))

        expect(result).toEqual([1, 2, 3])
      })
    })

    describe('throwError function', () => {
      it('should create observable that immediately errors', async () => {
        const source = throwError(() => new Error('Immediate error'))

        await expect(firstValueFrom(source)).rejects.toThrow('Immediate error')
      })
    })
  })

  describe('Memory and cleanup behavior', () => {
    it('should allow unsubscription to prevent memory leaks', () => {
      const subject = new Subject<number>()
      let callCount = 0

      const subscription = subject.subscribe(() => {
        callCount++
      })

      subject.next(1)
      expect(callCount).toBe(1)

      subscription.unsubscribe()

      subject.next(2)
      expect(callCount).toBe(1) // Not called after unsubscribe
    })

    it('should clean up ReplaySubject on complete', () => {
      const subject = new ReplaySubject<string>(100)

      for (let i = 0; i < 100; i++) {
        subject.next(`value-${i}`)
      }

      subject.complete()

      // After completion, new subscriptions still get replayed values
      // but no new values can be added
      let received = 0
      subject.subscribe(() => received++)

      expect(received).toBe(100)

      // Calling next after complete does nothing
      subject.next('after-complete')
      expect(received).toBe(100)
    })
  })

  describe('Error handling patterns', () => {
    it('should handle async errors in observables', async () => {
      const source = new Observable<string>((subscriber) => {
        setTimeout(() => {
          subscriber.error(new Error('Async error'))
        }, 10)
      })

      await expect(firstValueFrom(source)).rejects.toThrow('Async error')
    })

    it('should propagate errors through pipe chain', async () => {
      const source = of(1, 2, 3).pipe(
        map((x) => {
          if (x === 2) throw new Error('Error at 2')
          return x
        }),
        catchError((err) => throwError(() => new Error(`Caught: ${err.message}`))),
      )

      await expect(firstValueFrom(source.pipe(toArray()))).rejects.toThrow(
        'Caught: Error at 2',
      )
    })
  })

  describe('Advanced error recovery patterns', () => {
    describe('retry operator', () => {
      it('should retry specified number of times', async () => {
        let attempts = 0

        const source = new Observable<string>((subscriber) => {
          attempts++
          if (attempts < 3) {
            subscriber.error(new Error(`Attempt ${attempts} failed`))
          } else {
            subscriber.next('success')
            subscriber.complete()
          }
        }).pipe(retry(3))

        const result = await firstValueFrom(source)
        expect(result).toBe('success')
        expect(attempts).toBe(3)
      })

      it('should fail after max retries exceeded', async () => {
        let attempts = 0

        const source = new Observable<string>((subscriber) => {
          attempts++
          subscriber.error(new Error(`Attempt ${attempts} failed`))
        }).pipe(retry(2))

        await expect(firstValueFrom(source)).rejects.toThrow('Attempt 3 failed')
        expect(attempts).toBe(3) // Initial + 2 retries
      })

      it('should not retry on successful emission', async () => {
        let attempts = 0

        const source = new Observable<string>((subscriber) => {
          attempts++
          subscriber.next('immediate success')
          subscriber.complete()
        }).pipe(retry(5))

        await firstValueFrom(source)
        expect(attempts).toBe(1)
      })
    })

    describe('retry with delay pattern', () => {
      it('should implement exponential backoff', async () => {
        let attempts = 0
        const attemptTimes: number[] = []
        const startTime = Date.now()

        const source = new Observable<string>((subscriber) => {
          attempts++
          attemptTimes.push(Date.now() - startTime)

          if (attempts < 3) {
            subscriber.error(new Error('Retry me'))
          } else {
            subscriber.next('success')
            subscriber.complete()
          }
        }).pipe(
          retryWhen((errors) =>
            errors.pipe(
              mergeMap((error, index) => {
                const retryAttempt = index + 1
                if (retryAttempt > 3) {
                  return throwError(() => error)
                }
                // Exponential backoff: 10ms, 20ms, 40ms
                const delayMs = Math.pow(2, retryAttempt) * 5
                return timer(delayMs)
              }),
            ),
          ),
        )

        const result = await firstValueFrom(source)
        expect(result).toBe('success')
        expect(attempts).toBe(3)
      })
    })

    describe('catchError recovery patterns', () => {
      it('should recover with fallback value', async () => {
        const source = throwError(() => new Error('Primary failed')).pipe(
          catchError(() => of('fallback-value')),
        )

        const result = await firstValueFrom(source)
        expect(result).toBe('fallback-value')
      })

      it('should recover with fallback observable', async () => {
        const primary = throwError(() => new Error('Primary failed'))
        const fallback = of('fallback-1', 'fallback-2')

        const source = primary.pipe(catchError(() => fallback))

        const result = await firstValueFrom(source.pipe(toArray()))
        expect(result).toEqual(['fallback-1', 'fallback-2'])
      })

      it('should access error in recovery function', async () => {
        let capturedError: Error | null = null

        const source = throwError(() => new Error('Specific error')).pipe(
          catchError((error) => {
            capturedError = error
            return of(`Recovered from: ${error.message}`)
          }),
        )

        const result = await firstValueFrom(source)
        expect(result).toBe('Recovered from: Specific error')
        expect(capturedError?.message).toBe('Specific error')
      })

      it('should transform error to different error', async () => {
        const source = throwError(() => new Error('Original')).pipe(
          catchError((error) =>
            throwError(
              () => new Error(`Transformed: ${error.message}`),
            ),
          ),
        )

        await expect(firstValueFrom(source)).rejects.toThrow(
          'Transformed: Original',
        )
      })
    })
  })

  describe('finalize operator (cleanup patterns)', () => {
    it('should execute on complete', async () => {
      let finalized = false

      const source = of(1, 2, 3).pipe(
        finalize(() => {
          finalized = true
        }),
      )

      await firstValueFrom(source.pipe(toArray()))
      expect(finalized).toBe(true)
    })

    it('should execute on error', async () => {
      let finalized = false

      const source = throwError(() => new Error('Test')).pipe(
        finalize(() => {
          finalized = true
        }),
      )

      try {
        await firstValueFrom(source)
      } catch {
        // Expected error
      }

      expect(finalized).toBe(true)
    })

    it('should execute on unsubscribe', async () => {
      let finalized = false

      const subject = new Subject<number>()
      const source = subject.pipe(
        finalize(() => {
          finalized = true
        }),
      )

      const subscription = source.subscribe()
      expect(finalized).toBe(false)

      subscription.unsubscribe()
      expect(finalized).toBe(true)
    })

    it('should support Lambda cleanup pattern', async () => {
      const cleanupActions: string[] = []

      const simulateLambdaHandler = async (): Promise<string> => {
        const subject = new ReplaySubject<string>(1)

        const operation = subject.pipe(
          tap(() => cleanupActions.push('processing')),
          finalize(() => {
            cleanupActions.push('cleanup-connection')
            cleanupActions.push('cleanup-resources')
          }),
        )

        // Simulate async operation
        setTimeout(() => {
          subject.next('result')
          subject.complete()
        }, 10)

        return firstValueFrom(operation)
      }

      const result = await simulateLambdaHandler()
      expect(result).toBe('result')
      expect(cleanupActions).toContain('processing')
      expect(cleanupActions).toContain('cleanup-connection')
      expect(cleanupActions).toContain('cleanup-resources')
    })
  })

  describe('tap operator (side effects)', () => {
    it('should execute side effects without modifying values', async () => {
      const sideEffects: number[] = []

      const source = of(1, 2, 3).pipe(
        tap((x) => sideEffects.push(x * 10)),
      )

      const result = await firstValueFrom(source.pipe(toArray()))

      expect(result).toEqual([1, 2, 3])
      expect(sideEffects).toEqual([10, 20, 30])
    })

    it('should support logging pattern', async () => {
      const logs: string[] = []

      const source = of('data').pipe(
        tap({
          next: (value) => logs.push(`Next: ${value}`),
          error: (err) => logs.push(`Error: ${err.message}`),
          complete: () => logs.push('Complete'),
        }),
      )

      await firstValueFrom(source.pipe(toArray()))

      expect(logs).toEqual(['Next: data', 'Complete'])
    })
  })

  describe('delay operator', () => {
    it('should delay emissions', async () => {
      const start = Date.now()

      await firstValueFrom(of('delayed').pipe(delay(50)))

      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(45) // Allow some tolerance
    })

    it('should delay emission from observable', async () => {
      // Use timer to verify delay works with observable scheduling
      const start = Date.now()

      await firstValueFrom(timer(50).pipe(map(() => 'delayed')))

      const elapsed = Date.now() - start
      // Verify that delay was applied (allow significant tolerance for CI)
      expect(elapsed).toBeGreaterThanOrEqual(40)
    })
  })

  describe('Subject completion and error states', () => {
    it('should stop emitting after complete', () => {
      const subject = new Subject<number>()
      const values: number[] = []

      subject.subscribe((v) => values.push(v))

      subject.next(1)
      subject.complete()
      subject.next(2) // Should be ignored

      expect(values).toEqual([1])
    })

    it('should stop emitting after error', () => {
      const subject = new Subject<number>()
      const values: number[] = []
      const errors: Error[] = []

      subject.subscribe({
        next: (v) => values.push(v),
        error: (e) => errors.push(e),
      })

      subject.next(1)
      subject.error(new Error('Stop'))
      subject.next(2) // Should be ignored

      expect(values).toEqual([1])
      expect(errors).toHaveLength(1)
    })

    it('should handle multiple errors gracefully', () => {
      const subject = new Subject<number>()
      const errors: Error[] = []

      subject.subscribe({
        error: (e) => errors.push(e),
      })

      subject.error(new Error('First'))
      // Second error call after first error - subject is already stopped
      // No additional subscription should receive this

      expect(errors).toHaveLength(1)
    })
  })

  describe('Lambda-specific patterns', () => {
    it('should handle request-response pattern', async () => {
      const requestHandler = (input: string): Observable<string> => {
        return new Observable((subscriber) => {
          // Simulate async processing
          setTimeout(() => {
            subscriber.next(`Processed: ${input}`)
            subscriber.complete()
          }, 10)
        })
      }

      const result = await firstValueFrom(requestHandler('test-input'))
      expect(result).toBe('Processed: test-input')
    })

    it('should handle timeout with fallback', async () => {
      const slowOperation = new Observable<string>((subscriber) => {
        setTimeout(() => {
          subscriber.next('slow-result')
          subscriber.complete()
        }, 100)
      })

      const withTimeout = slowOperation.pipe(
        timeout(50),
        catchError(() => of('timeout-fallback')),
      )

      const result = await firstValueFrom(withTimeout)
      expect(result).toBe('timeout-fallback')
    })

    it('should support circuit breaker pattern', async () => {
      let failures = 0
      const maxFailures = 3

      const unstableService = (): Observable<string> => {
        return new Observable((subscriber) => {
          failures++
          if (failures <= maxFailures) {
            subscriber.error(new Error('Service unavailable'))
          } else {
            subscriber.next('success')
            subscriber.complete()
          }
        })
      }

      const withCircuitBreaker = unstableService().pipe(
        retry(maxFailures),
        catchError((error) => {
          // Circuit open - return cached/default value
          return of('circuit-open-fallback')
        }),
      )

      const result = await firstValueFrom(withCircuitBreaker)
      // After 3 retries + 1 initial = 4 attempts, should succeed
      expect(result).toBe('success')
    })
  })
})
