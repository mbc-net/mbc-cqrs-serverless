/**
 * RxJS Schedulers Integration Tests
 *
 * This file tests RxJS scheduler behavior:
 * - asyncScheduler behavior
 * - queueScheduler behavior
 * - asapScheduler behavior
 * - Scheduler timing and ordering
 * - TestScheduler for time-based testing
 *
 * These tests verify that RxJS scheduler patterns work correctly
 * across package version updates.
 */
import {
  asyncScheduler,
  asapScheduler,
  queueScheduler,
  animationFrameScheduler,
  of,
  interval,
  timer,
  scheduled,
  Observable,
  observeOn,
  subscribeOn,
} from 'rxjs'
import { take, map, delay, tap } from 'rxjs/operators'
import { TestScheduler } from 'rxjs/testing'

describe('RxJS Schedulers Integration', () => {
  // ============================================================================
  // Scheduler Availability Tests
  // ============================================================================
  describe('Scheduler Availability', () => {
    it('should have asyncScheduler available', () => {
      expect(asyncScheduler).toBeDefined()
      expect(typeof asyncScheduler.schedule).toBe('function')
      expect(typeof asyncScheduler.now).toBe('function')
    })

    it('should have queueScheduler available', () => {
      expect(queueScheduler).toBeDefined()
      expect(typeof queueScheduler.schedule).toBe('function')
    })

    it('should have asapScheduler available', () => {
      expect(asapScheduler).toBeDefined()
      expect(typeof asapScheduler.schedule).toBe('function')
    })

    it('should have animationFrameScheduler available', () => {
      expect(animationFrameScheduler).toBeDefined()
      expect(typeof animationFrameScheduler.schedule).toBe('function')
    })
  })

  // ============================================================================
  // asyncScheduler Tests
  // ============================================================================
  describe('asyncScheduler', () => {
    it('should execute callback asynchronously', (done) => {
      const executionOrder: string[] = []

      executionOrder.push('before schedule')

      asyncScheduler.schedule(() => {
        executionOrder.push('scheduled callback')

        expect(executionOrder).toEqual([
          'before schedule',
          'after schedule',
          'scheduled callback',
        ])
        done()
      })

      executionOrder.push('after schedule')
    })

    it('should support delay parameter', (done) => {
      const start = Date.now()

      asyncScheduler.schedule(() => {
        const elapsed = Date.now() - start
        // Allow some variance for timer accuracy
        expect(elapsed).toBeGreaterThanOrEqual(45)
        done()
      }, 50)
    })

    it('should allow cancellation', (done) => {
      let executed = false

      const subscription = asyncScheduler.schedule(() => {
        executed = true
      }, 50)

      // Cancel before execution
      subscription.unsubscribe()

      // Wait longer than the delay to verify cancellation
      setTimeout(() => {
        expect(executed).toBe(false)
        done()
      }, 100)
    })

    it('should support state parameter', (done) => {
      interface State {
        count: number
      }

      asyncScheduler.schedule(
        function (state?: State) {
          expect(state?.count).toBe(5)
          done()
        },
        0,
        { count: 5 },
      )
    })

    it('should support recursive scheduling', (done) => {
      const values: number[] = []

      const countdown = function (
        this: { schedule: (state: number, delay: number) => void },
        state?: number,
      ) {
        if (state === undefined) return
        values.push(state)
        if (state > 0) {
          this.schedule(state - 1, 10)
        } else {
          expect(values).toEqual([3, 2, 1, 0])
          done()
        }
      }

      asyncScheduler.schedule(countdown as (this: unknown, state?: number) => void, 0, 3)
    })
  })

  // ============================================================================
  // queueScheduler Tests
  // ============================================================================
  describe('queueScheduler', () => {
    it('should execute tasks synchronously in queue order', () => {
      const executionOrder: string[] = []

      queueScheduler.schedule(() => {
        executionOrder.push('task1 start')

        queueScheduler.schedule(() => {
          executionOrder.push('task2')
        })

        executionOrder.push('task1 end')
      })

      // queueScheduler executes synchronously but maintains FIFO order
      expect(executionOrder).toEqual(['task1 start', 'task1 end', 'task2'])
    })

    it('should handle nested scheduling', () => {
      const executionOrder: number[] = []

      queueScheduler.schedule(() => {
        executionOrder.push(1)

        queueScheduler.schedule(() => {
          executionOrder.push(3)

          queueScheduler.schedule(() => {
            executionOrder.push(5)
          })

          executionOrder.push(4)
        })

        executionOrder.push(2)
      })

      expect(executionOrder).toEqual([1, 2, 3, 4, 5])
    })

    it('should support state passing', () => {
      const results: number[] = []

      queueScheduler.schedule(
        function (state?: number) {
          if (state !== undefined) {
            results.push(state * 2)
          }
        },
        0,
        21,
      )

      expect(results).toEqual([42])
    })
  })

  // ============================================================================
  // asapScheduler Tests
  // ============================================================================
  describe('asapScheduler', () => {
    it('should execute as soon as possible (microtask)', (done) => {
      const executionOrder: string[] = []

      executionOrder.push('before')

      asapScheduler.schedule(() => {
        executionOrder.push('asap')
      })

      Promise.resolve().then(() => {
        executionOrder.push('promise')
      })

      setTimeout(() => {
        executionOrder.push('setTimeout')
        // asapScheduler should execute before or around the same time as Promise
        expect(executionOrder).toContain('asap')
        expect(executionOrder).toContain('promise')
        done()
      }, 10)
    })

    it('should allow cancellation', (done) => {
      let executed = false

      const subscription = asapScheduler.schedule(() => {
        executed = true
      })

      subscription.unsubscribe()

      setTimeout(() => {
        expect(executed).toBe(false)
        done()
      }, 10)
    })
  })

  // ============================================================================
  // Scheduled Observable Tests
  // ============================================================================
  describe('Scheduled Observables', () => {
    it('should use scheduled() to emit on async scheduler', (done) => {
      const executionOrder: string[] = []

      executionOrder.push('before subscribe')

      scheduled([1, 2, 3], asyncScheduler).subscribe({
        next: (value) => executionOrder.push(`value: ${value}`),
        complete: () => {
          expect(executionOrder[0]).toBe('before subscribe')
          expect(executionOrder[1]).toBe('after subscribe')
          // Values should come after synchronous code
          expect(executionOrder).toContain('value: 1')
          expect(executionOrder).toContain('value: 2')
          expect(executionOrder).toContain('value: 3')
          done()
        },
      })

      executionOrder.push('after subscribe')
    })

    it('should use subscribeOn to control subscription timing', (done) => {
      const executionOrder: string[] = []

      executionOrder.push('before subscribe')

      of(1, 2, 3)
        .pipe(subscribeOn(asyncScheduler))
        .subscribe({
          next: (value) => executionOrder.push(`value: ${value}`),
          complete: () => {
            expect(executionOrder[0]).toBe('before subscribe')
            expect(executionOrder[1]).toBe('after subscribe')
            done()
          },
        })

      executionOrder.push('after subscribe')
    })

    it('should use observeOn to control emission timing', (done) => {
      const executionOrder: string[] = []

      executionOrder.push('before subscribe')

      of(1, 2, 3)
        .pipe(observeOn(asyncScheduler))
        .subscribe({
          next: (value) => executionOrder.push(`value: ${value}`),
          complete: () => {
            // With observeOn, emissions are delayed to async scheduler
            expect(executionOrder[0]).toBe('before subscribe')
            expect(executionOrder[1]).toBe('after subscribe')
            done()
          },
        })

      executionOrder.push('after subscribe')
    })
  })

  // ============================================================================
  // Timer and Interval with Schedulers
  // ============================================================================
  describe('Timer and Interval', () => {
    it('should create timer with asyncScheduler', (done) => {
      const start = Date.now()

      timer(50, asyncScheduler).subscribe({
        next: () => {
          const elapsed = Date.now() - start
          expect(elapsed).toBeGreaterThanOrEqual(45)
          done()
        },
      })
    })

    it('should create interval with asyncScheduler', (done) => {
      const values: number[] = []
      const start = Date.now()

      interval(20, asyncScheduler)
        .pipe(take(3))
        .subscribe({
          next: (value) => values.push(value),
          complete: () => {
            const elapsed = Date.now() - start
            expect(values).toEqual([0, 1, 2])
            // Should take at least 60ms (3 intervals of ~20ms)
            expect(elapsed).toBeGreaterThanOrEqual(55)
            done()
          },
        })
    })
  })

  // ============================================================================
  // TestScheduler Tests
  // ============================================================================
  describe('TestScheduler', () => {
    let testScheduler: TestScheduler

    beforeEach(() => {
      testScheduler = new TestScheduler((actual, expected) => {
        expect(actual).toEqual(expected)
      })
    })

    it('should support marble testing', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        const source$ = cold('a-b-c|')
        const expected = 'a-b-c|'

        expectObservable(source$).toBe(expected)
      })
    })

    it('should test delays with virtual time', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        const source$ = cold('a-b-c|').pipe(
          map((x) => x.toUpperCase()),
        )
        const expected = 'A-B-C|'

        expectObservable(source$).toBe(expected)
      })
    })

    it('should test interval with take', () => {
      testScheduler.run(({ expectObservable }) => {
        const source$ = interval(10, testScheduler).pipe(take(3))
        const expected = '10ms a 9ms b 9ms (c|)'

        expectObservable(source$).toBe(expected, { a: 0, b: 1, c: 2 })
      })
    })

    it('should test error scenarios', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        const source$ = cold('a-b-#', undefined, new Error('test error'))
        const expected = 'a-b-#'

        expectObservable(source$).toBe(expected, undefined, new Error('test error'))
      })
    })

    it('should test hot observables', () => {
      testScheduler.run(({ hot, expectObservable }) => {
        // Hot observable with subscription point (^)
        const source$ = hot('--a--b--c--|')
        const expected = '--a--b--c--|'

        expectObservable(source$).toBe(expected)
      })
    })

    it('should test subscription timing', () => {
      testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
        const source$ = cold('--a--b--c--|')
        const subs = '^----------!'

        expectObservable(source$).toBe('--a--b--c--|')
        expectSubscriptions(source$.subscriptions).toBe(subs)
      })
    })
  })

  // ============================================================================
  // Scheduler now() Tests
  // ============================================================================
  describe('Scheduler now()', () => {
    it('should return current timestamp', () => {
      const now = asyncScheduler.now()
      expect(typeof now).toBe('number')
      expect(now).toBeGreaterThan(0)
    })

    it('should return increasing timestamps', (done) => {
      const t1 = asyncScheduler.now()

      setTimeout(() => {
        const t2 = asyncScheduler.now()
        expect(t2).toBeGreaterThan(t1)
        done()
      }, 10)
    })
  })

  // ============================================================================
  // Delay Operator with Schedulers
  // ============================================================================
  describe('Delay Operator', () => {
    it('should delay emissions', (done) => {
      const start = Date.now()
      const values: number[] = []

      of(1, 2, 3)
        .pipe(delay(50, asyncScheduler))
        .subscribe({
          next: (value) => values.push(value),
          complete: () => {
            const elapsed = Date.now() - start
            expect(elapsed).toBeGreaterThanOrEqual(45)
            expect(values).toEqual([1, 2, 3])
            done()
          },
        })
    })
  })

  // ============================================================================
  // Scheduler Work Queue Tests
  // ============================================================================
  describe('Scheduler Work Queue', () => {
    it('should process multiple scheduled tasks', (done) => {
      const results: number[] = []

      asyncScheduler.schedule(() => results.push(1), 10)
      asyncScheduler.schedule(() => results.push(2), 20)
      asyncScheduler.schedule(() => results.push(3), 30)
      asyncScheduler.schedule(() => {
        expect(results).toEqual([1, 2, 3])
        done()
      }, 40)
    })

    it('should handle tasks scheduled with same delay', (done) => {
      const results: number[] = []

      asyncScheduler.schedule(() => results.push(1), 10)
      asyncScheduler.schedule(() => results.push(2), 10)
      asyncScheduler.schedule(() => results.push(3), 10)

      asyncScheduler.schedule(() => {
        // All should be executed, order may vary
        expect(results).toHaveLength(3)
        expect(results).toContain(1)
        expect(results).toContain(2)
        expect(results).toContain(3)
        done()
      }, 50)
    })
  })

  // ============================================================================
  // Scheduler Flush Tests
  // ============================================================================
  describe('Queue Scheduler Flush', () => {
    it('should execute all queued tasks synchronously', () => {
      const results: string[] = []

      queueScheduler.schedule(() => {
        results.push('A')
        queueScheduler.schedule(() => results.push('B'))
        queueScheduler.schedule(() => results.push('C'))
        results.push('D')
      })

      // All tasks completed synchronously
      expect(results).toEqual(['A', 'D', 'B', 'C'])
    })
  })

  // ============================================================================
  // Custom Scheduler Action Tests
  // ============================================================================
  describe('Custom Scheduler Actions', () => {
    it('should create observable with custom scheduling', () => {
      const results: number[] = []

      const customScheduled$ = new Observable<number>((subscriber) => {
        queueScheduler.schedule(() => {
          subscriber.next(1)
          queueScheduler.schedule(() => {
            subscriber.next(2)
            subscriber.complete()
          })
        })
      })

      customScheduled$.subscribe({
        next: (value) => results.push(value),
        complete: () => {
          expect(results).toEqual([1, 2])
        },
      })
    })
  })

  // ============================================================================
  // Scheduler Error Handling Tests
  // ============================================================================
  describe('Scheduler Error Handling', () => {
    it('should handle errors in scheduled tasks', (done) => {
      const error = new Error('Scheduled task error')

      // Create an observable that schedules work
      scheduled([1, 2, 3], asyncScheduler)
        .pipe(
          tap((value) => {
            if (value === 2) {
              throw error
            }
          }),
        )
        .subscribe({
          next: () => {},
          error: (err) => {
            expect(err).toBe(error)
            done()
          },
        })
    })
  })
})
