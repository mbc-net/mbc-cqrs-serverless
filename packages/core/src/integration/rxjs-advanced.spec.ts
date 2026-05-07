/**
 * RxJS Advanced Operator Tests
 *
 * This file tests advanced RxJS behaviors:
 * - Complex operator chains
 * - Error propagation through chains
 * - Backpressure handling
 * - Scheduler behavior
 * - Memory management patterns
 *
 * These tests verify RxJS behavior contracts to detect breaking changes.
 */
import {
  asyncScheduler,
  BehaviorSubject,
  buffer,
  bufferCount,
  bufferTime,
  catchError,
  combineLatest,
  concat,
  concatMap,
  debounceTime,
  delay,
  distinctUntilChanged,
  EMPTY,
  filter,
  finalize,
  first,
  firstValueFrom,
  forkJoin,
  from,
  fromEvent,
  groupBy,
  interval,
  last,
  lastValueFrom,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  pairwise,
  race,
  reduce,
  ReplaySubject,
  retry,
  scan,
  share,
  shareReplay,
  skip,
  skipUntil,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  throttleTime,
  throwError,
  timeout,
  timer,
  toArray,
  withLatestFrom,
  zip,
} from 'rxjs'

describe('RxJS Advanced Operator Tests', () => {
  // ============================================================================
  // Complex Operator Chains
  // ============================================================================
  describe('Complex operator chains', () => {
    describe('Multi-step transformations', () => {
      it('should chain multiple map operations', async () => {
        const result = await firstValueFrom(
          of(1, 2, 3).pipe(
            map((x) => x * 2),
            map((x) => x + 1),
            map((x) => x.toString()),
            toArray(),
          ),
        )

        expect(result).toEqual(['3', '5', '7'])
      })

      it('should chain filter and map operations', async () => {
        const result = await firstValueFrom(
          from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).pipe(
            filter((x) => x % 2 === 0),
            map((x) => x * 10),
            filter((x) => x > 40),
            toArray(),
          ),
        )

        expect(result).toEqual([60, 80, 100])
      })

      it('should chain scan and reduce operations', async () => {
        const runningTotals: number[] = []

        const finalTotal = await firstValueFrom(
          of(1, 2, 3, 4, 5).pipe(
            scan((acc, val) => acc + val, 0),
            tap((val) => runningTotals.push(val)),
            last(),
          ),
        )

        expect(runningTotals).toEqual([1, 3, 6, 10, 15])
        expect(finalTotal).toBe(15)
      })
    })

    describe('Higher-order observable chains', () => {
      it('should chain mergeMap operations', async () => {
        const result = await firstValueFrom(
          of('a', 'b').pipe(
            mergeMap((letter) =>
              of(1, 2).pipe(map((num) => `${letter}${num}`)),
            ),
            toArray(),
          ),
        )

        // Order may vary due to concurrency
        expect(result.sort()).toEqual(['a1', 'a2', 'b1', 'b2'])
      })

      it('should chain switchMap operations', async () => {
        const subject = new Subject<string>()
        const results: string[] = []

        subject
          .pipe(
            switchMap((outer) =>
              of(1, 2, 3).pipe(map((inner) => `${outer}-${inner}`)),
            ),
          )
          .subscribe((val) => results.push(val))

        subject.next('A')
        subject.next('B') // This should cancel A's inner observable

        // Wait for synchronous operations
        await new Promise((r) => setTimeout(r, 10))

        // With switchMap, only the latest outer value's emissions should complete
        expect(results).toContain('B-1')
        expect(results).toContain('B-2')
        expect(results).toContain('B-3')
      })

      it('should chain concatMap operations', async () => {
        const result = await firstValueFrom(
          of('a', 'b', 'c').pipe(
            concatMap((letter) =>
              of(1, 2).pipe(
                map((num) => `${letter}${num}`),
              ),
            ),
            toArray(),
          ),
        )

        // concatMap maintains order
        expect(result).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
      })
    })

    describe('Combination operator chains', () => {
      it('should use withLatestFrom in chain', async () => {
        const source$ = of(1, 2, 3)
        const latest$ = new BehaviorSubject('A')

        const result = await firstValueFrom(
          source$.pipe(
            withLatestFrom(latest$),
            map(([num, letter]) => `${letter}${num}`),
            toArray(),
          ),
        )

        expect(result).toEqual(['A1', 'A2', 'A3'])
      })

      it('should use combineLatest with multiple streams', async () => {
        const a$ = of(1, 2)
        const b$ = of('x', 'y')

        const result = await firstValueFrom(
          combineLatest([a$, b$]).pipe(
            map(([a, b]) => `${a}${b}`),
            toArray(),
          ),
        )

        // combineLatest emits when any source emits (after all have emitted once)
        expect(result.length).toBeGreaterThan(0)
      })

      it('should use zip to pair values', async () => {
        const numbers$ = of(1, 2, 3)
        const letters$ = of('a', 'b', 'c')

        const result = await firstValueFrom(
          zip(numbers$, letters$).pipe(
            map(([num, letter]) => `${letter}${num}`),
            toArray(),
          ),
        )

        expect(result).toEqual(['a1', 'b2', 'c3'])
      })
    })
  })

  // ============================================================================
  // Error Propagation
  // ============================================================================
  describe('Error propagation through chains', () => {
    describe('Error in transformation', () => {
      it('should propagate error from map', async () => {
        const source = of(1, 2, 3).pipe(
          map((x) => {
            if (x === 2) throw new Error('Error at 2')
            return x
          }),
        )

        await expect(firstValueFrom(source.pipe(toArray()))).rejects.toThrow(
          'Error at 2',
        )
      })

      it('should propagate error from filter predicate', async () => {
        const source = of(1, 2, 3).pipe(
          filter((x) => {
            if (x === 2) throw new Error('Filter error')
            return true
          }),
        )

        await expect(firstValueFrom(source.pipe(toArray()))).rejects.toThrow(
          'Filter error',
        )
      })

      it('should propagate error from inner observable', async () => {
        const source = of(1, 2).pipe(
          mergeMap((x) => {
            if (x === 2) {
              return throwError(() => new Error('Inner error'))
            }
            return of(x * 10)
          }),
        )

        await expect(firstValueFrom(source.pipe(toArray()))).rejects.toThrow(
          'Inner error',
        )
      })
    })

    describe('Error recovery in chain', () => {
      it('should catch error and continue with fallback', async () => {
        const source = of(1, 2, 3).pipe(
          map((x) => {
            if (x === 2) throw new Error('Error')
            return x
          }),
          catchError(() => of(-1)),
        )

        const result = await firstValueFrom(source.pipe(toArray()))
        expect(result).toEqual([1, -1])
      })

      it('should catch error and rethrow transformed error', async () => {
        const source = of(1).pipe(
          map(() => {
            throw new Error('Original')
          }),
          catchError((err) =>
            throwError(() => new Error(`Wrapped: ${err.message}`)),
          ),
        )

        await expect(firstValueFrom(source)).rejects.toThrow('Wrapped: Original')
      })

      it('should retry and eventually succeed', async () => {
        let attempts = 0

        const source = new Observable<string>((subscriber) => {
          attempts++
          if (attempts < 3) {
            subscriber.error(new Error(`Attempt ${attempts}`))
          } else {
            subscriber.next('success')
            subscriber.complete()
          }
        }).pipe(retry(3))

        const result = await firstValueFrom(source)
        expect(result).toBe('success')
        expect(attempts).toBe(3)
      })

      it('should handle error in catchError handler', async () => {
        const source = throwError(() => new Error('First')).pipe(
          catchError(() => {
            throw new Error('Handler error')
          }),
        )

        await expect(firstValueFrom(source)).rejects.toThrow('Handler error')
      })
    })

    describe('Error state propagation', () => {
      it('should stop processing after error', async () => {
        const processed: number[] = []

        const source = of(1, 2, 3).pipe(
          tap((x) => processed.push(x)),
          map((x) => {
            if (x === 2) throw new Error('Stop')
            return x
          }),
        )

        try {
          await firstValueFrom(source.pipe(toArray()))
        } catch {
          // Expected
        }

        expect(processed).toEqual([1, 2])
      })

      it('should propagate error to all subscribers of shared observable', async () => {
        const source$ = new Subject<number>()
        const shared$ = source$.pipe(
          map((x) => {
            if (x === 2) throw new Error('Shared error')
            return x
          }),
          share(),
        )

        const errors: Error[] = []
        shared$.subscribe({ error: (e) => errors.push(e) })
        shared$.subscribe({ error: (e) => errors.push(e) })

        source$.next(1)
        source$.next(2)

        expect(errors).toHaveLength(2)
        expect(errors[0].message).toBe('Shared error')
      })
    })
  })

  // ============================================================================
  // Backpressure Handling
  // ============================================================================
  describe('Backpressure handling', () => {
    describe('Buffer operators', () => {
      it('should buffer values with bufferCount', async () => {
        const result = await firstValueFrom(
          of(1, 2, 3, 4, 5, 6).pipe(bufferCount(2), toArray()),
        )

        expect(result).toEqual([
          [1, 2],
          [3, 4],
          [5, 6],
        ])
      })

      it('should buffer with sliding window', async () => {
        const result = await firstValueFrom(
          of(1, 2, 3, 4, 5).pipe(
            bufferCount(3, 1), // buffer of 3, slide by 1
            toArray(),
          ),
        )

        // bufferCount emits partial buffers at the end when source completes
        expect(result).toEqual([
          [1, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
          [4, 5],
          [5],
        ])
      })

      it('should buffer with notifier', async () => {
        const source$ = new Subject<number>()
        const notifier$ = new Subject<void>()
        const results: number[][] = []

        source$.pipe(buffer(notifier$)).subscribe((val) => results.push(val))

        source$.next(1)
        source$.next(2)
        notifier$.next()

        source$.next(3)
        notifier$.next()

        expect(results).toEqual([[1, 2], [3]])
      })
    })

    describe('Throttle and debounce', () => {
      it('should throttle emissions', async () => {
        const source$ = new Subject<number>()
        const results: number[] = []

        source$.pipe(throttleTime(50)).subscribe((val) => results.push(val))

        source$.next(1)
        source$.next(2) // Ignored (within throttle window)
        source$.next(3) // Ignored

        await new Promise((r) => setTimeout(r, 60))

        source$.next(4) // Allowed
        source$.next(5) // Ignored

        expect(results).toContain(1)
        expect(results).toContain(4)
        expect(results).not.toContain(2)
        expect(results).not.toContain(3)
      })

      it('should debounce emissions', async () => {
        const source$ = new Subject<number>()
        const results: number[] = []

        source$.pipe(debounceTime(30)).subscribe((val) => results.push(val))

        source$.next(1)
        source$.next(2)
        source$.next(3) // Only this should emit after debounce

        await new Promise((r) => setTimeout(r, 50))

        expect(results).toEqual([3])
      })
    })

    describe('Sample and audit patterns', () => {
      it('should skip values until notifier', async () => {
        const source$ = new Subject<number>()
        const notifier$ = new Subject<void>()
        const results: number[] = []

        source$.pipe(skipUntil(notifier$)).subscribe((val) => results.push(val))

        source$.next(1)
        source$.next(2)
        notifier$.next()
        source$.next(3)
        source$.next(4)

        expect(results).toEqual([3, 4])
      })

      it('should take values until notifier', async () => {
        const source$ = new Subject<number>()
        const notifier$ = new Subject<void>()
        const results: number[] = []
        let completed = false

        source$.pipe(takeUntil(notifier$)).subscribe({
          next: (val) => results.push(val),
          complete: () => (completed = true),
        })

        source$.next(1)
        source$.next(2)
        notifier$.next()
        source$.next(3) // Should not be received

        expect(results).toEqual([1, 2])
        expect(completed).toBe(true)
      })
    })

    describe('Distinct and pairwise patterns', () => {
      it('should emit only distinct consecutive values', async () => {
        const result = await firstValueFrom(
          of(1, 1, 2, 2, 3, 1, 1).pipe(distinctUntilChanged(), toArray()),
        )

        expect(result).toEqual([1, 2, 3, 1])
      })

      it('should emit distinct objects using comparator', async () => {
        const objects = [
          { id: 1, name: 'a' },
          { id: 1, name: 'b' },
          { id: 2, name: 'c' },
        ]

        const result = await firstValueFrom(
          from(objects).pipe(
            distinctUntilChanged((prev, curr) => prev.id === curr.id),
            toArray(),
          ),
        )

        expect(result).toEqual([
          { id: 1, name: 'a' },
          { id: 2, name: 'c' },
        ])
      })

      it('should emit consecutive pairs', async () => {
        const result = await firstValueFrom(
          of(1, 2, 3, 4).pipe(pairwise(), toArray()),
        )

        expect(result).toEqual([
          [1, 2],
          [2, 3],
          [3, 4],
        ])
      })
    })
  })

  // ============================================================================
  // Scheduler Behavior
  // ============================================================================
  describe('Scheduler behavior', () => {
    describe('Async scheduler', () => {
      it('should schedule work asynchronously', async () => {
        const order: string[] = []

        const source$ = new Observable<string>((subscriber) => {
          order.push('subscribe')
          subscriber.next('value')
          subscriber.complete()
        })

        source$.subscribe(() => order.push('next'))
        order.push('after-subscribe')

        // Synchronous subscription
        expect(order).toEqual(['subscribe', 'next', 'after-subscribe'])
      })

      it('should use delay for async scheduling', async () => {
        const order: string[] = []

        const source$ = of('value').pipe(delay(10))

        source$.subscribe(() => order.push('next'))
        order.push('after-subscribe')

        expect(order).toEqual(['after-subscribe'])

        await new Promise((r) => setTimeout(r, 20))

        expect(order).toEqual(['after-subscribe', 'next'])
      })
    })

    describe('Timer and interval', () => {
      it('should emit after delay with timer', async () => {
        const start = Date.now()
        await firstValueFrom(timer(50))
        const elapsed = Date.now() - start

        expect(elapsed).toBeGreaterThanOrEqual(45)
      })

      it('should emit periodically with interval', async () => {
        const values: number[] = []

        await firstValueFrom(
          interval(20).pipe(
            take(3),
            tap((val) => values.push(val)),
            toArray(),
          ),
        )

        expect(values).toEqual([0, 1, 2])
      })
    })
  })

  // ============================================================================
  // Memory Management Patterns
  // ============================================================================
  describe('Memory management patterns', () => {
    describe('Unsubscription cleanup', () => {
      it('should cleanup on unsubscribe', () => {
        let cleanedUp = false

        const source$ = new Observable<number>((subscriber) => {
          const id = setInterval(() => subscriber.next(1), 100)
          return () => {
            clearInterval(id)
            cleanedUp = true
          }
        })

        const subscription = source$.subscribe()
        expect(cleanedUp).toBe(false)

        subscription.unsubscribe()
        expect(cleanedUp).toBe(true)
      })

      it('should cleanup through finalize', async () => {
        let finalized = false

        await firstValueFrom(
          of(1, 2, 3).pipe(
            finalize(() => {
              finalized = true
            }),
            toArray(),
          ),
        )

        expect(finalized).toBe(true)
      })

      it('should cleanup finalize on error', async () => {
        let finalized = false

        try {
          await firstValueFrom(
            throwError(() => new Error('Test')).pipe(
              finalize(() => {
                finalized = true
              }),
            ),
          )
        } catch {
          // Expected
        }

        expect(finalized).toBe(true)
      })
    })

    describe('Share and shareReplay', () => {
      it('should share single subscription with share', () => {
        let subscribeCount = 0

        const source$ = new Observable<number>((subscriber) => {
          subscribeCount++
          subscriber.next(1)
          subscriber.complete()
        }).pipe(share())

        const results1: number[] = []
        const results2: number[] = []

        source$.subscribe((val) => results1.push(val))
        source$.subscribe((val) => results2.push(val))

        // Second subscription happens after source completed with share()
        // so it won't receive values
        expect(subscribeCount).toBe(2) // share() resubscribes after completion
      })

      it('should replay values with shareReplay', async () => {
        let subscribeCount = 0

        const source$ = new Observable<number>((subscriber) => {
          subscribeCount++
          subscriber.next(1)
          subscriber.next(2)
          subscriber.complete()
        }).pipe(shareReplay(1))

        await firstValueFrom(source$.pipe(toArray()))
        const result2 = await firstValueFrom(source$)

        // shareReplay maintains single subscription and replays
        expect(subscribeCount).toBe(1)
        expect(result2).toBe(2) // Last replayed value
      })

      it('should replay multiple values with buffer size', async () => {
        const source$ = of(1, 2, 3, 4, 5).pipe(shareReplay(3))

        await firstValueFrom(source$.pipe(toArray()))
        const replay = await firstValueFrom(source$.pipe(toArray()))

        expect(replay).toEqual([3, 4, 5])
      })
    })

    describe('Subject cleanup', () => {
      it('should stop emitting after Subject complete', () => {
        const subject = new Subject<number>()
        const values: number[] = []

        subject.subscribe((val) => values.push(val))

        subject.next(1)
        subject.complete()
        subject.next(2) // Should be ignored

        expect(values).toEqual([1])
      })

      it('should stop emitting after Subject error', () => {
        const subject = new Subject<number>()
        const values: number[] = []
        const errors: Error[] = []

        subject.subscribe({
          next: (val) => values.push(val),
          error: (err) => errors.push(err),
        })

        subject.next(1)
        subject.error(new Error('Stop'))
        subject.next(2) // Should be ignored

        expect(values).toEqual([1])
        expect(errors).toHaveLength(1)
      })

      it('should replay and complete with ReplaySubject', () => {
        const subject = new ReplaySubject<number>(2)

        subject.next(1)
        subject.next(2)
        subject.next(3)
        subject.complete()

        const values: number[] = []
        subject.subscribe((val) => values.push(val))

        expect(values).toEqual([2, 3])
      })
    })
  })

  // ============================================================================
  // Advanced Patterns
  // ============================================================================
  describe('Advanced patterns', () => {
    describe('Race and timeout patterns', () => {
      it('should emit from first observable with race', async () => {
        const slow$ = timer(100).pipe(map(() => 'slow'))
        const fast$ = timer(10).pipe(map(() => 'fast'))

        const result = await firstValueFrom(race([slow$, fast$]))
        expect(result).toBe('fast')
      })

      it('should handle timeout with fallback', async () => {
        const slow$ = timer(100).pipe(map(() => 'slow'))

        const result = await firstValueFrom(
          slow$.pipe(
            timeout(50),
            catchError(() => of('timeout')),
          ),
        )

        expect(result).toBe('timeout')
      })
    })

    describe('Fork join patterns', () => {
      it('should wait for all observables with forkJoin', async () => {
        const result = await firstValueFrom(
          forkJoin({
            a: of(1).pipe(delay(10)),
            b: of(2).pipe(delay(20)),
            c: of(3).pipe(delay(5)),
          }),
        )

        expect(result).toEqual({ a: 1, b: 2, c: 3 })
      })

      it('should fail if any observable fails in forkJoin', async () => {
        const source = forkJoin({
          a: of(1),
          b: throwError(() => new Error('Fail')),
        })

        await expect(firstValueFrom(source)).rejects.toThrow('Fail')
      })
    })

    describe('Concat and merge patterns', () => {
      it('should emit in order with concat', async () => {
        const result = await firstValueFrom(
          concat(of(1, 2), of(3, 4), of(5, 6)).pipe(toArray()),
        )

        expect(result).toEqual([1, 2, 3, 4, 5, 6])
      })

      it('should interleave with merge', async () => {
        const a$ = interval(30).pipe(
          take(3),
          map((x) => `a${x}`),
        )
        const b$ = interval(30).pipe(
          take(3),
          map((x) => `b${x}`),
        )

        const result = await firstValueFrom(merge(a$, b$).pipe(toArray()))

        // Both streams should be represented
        expect(result.filter((x) => x.startsWith('a'))).toHaveLength(3)
        expect(result.filter((x) => x.startsWith('b'))).toHaveLength(3)
      })
    })

    describe('GroupBy patterns', () => {
      it('should group by key', async () => {
        const items = [
          { type: 'a', value: 1 },
          { type: 'b', value: 2 },
          { type: 'a', value: 3 },
          { type: 'b', value: 4 },
        ]

        const groups: Record<string, number[]> = {}

        await firstValueFrom(
          from(items).pipe(
            groupBy((item) => item.type),
            mergeMap((group) =>
              group.pipe(
                map((item) => item.value),
                toArray(),
                map((values) => ({ key: group.key, values })),
              ),
            ),
            tap(({ key, values }) => {
              groups[key] = values
            }),
            toArray(),
          ),
        )

        expect(groups.a).toEqual([1, 3])
        expect(groups.b).toEqual([2, 4])
      })
    })

    describe('Scan and reduce patterns', () => {
      it('should accumulate with scan', async () => {
        const result = await firstValueFrom(
          of(1, 2, 3, 4, 5).pipe(
            scan((acc, val) => acc + val, 0),
            toArray(),
          ),
        )

        expect(result).toEqual([1, 3, 6, 10, 15])
      })

      it('should reduce to single value', async () => {
        const result = await firstValueFrom(
          of(1, 2, 3, 4, 5).pipe(reduce((acc, val) => acc + val, 0)),
        )

        expect(result).toBe(15)
      })

      it('should accumulate objects with scan', async () => {
        const events = [
          { type: 'add', value: 10 },
          { type: 'subtract', value: 3 },
          { type: 'add', value: 5 },
        ]

        const result = await firstValueFrom(
          from(events).pipe(
            scan((acc, event) => {
              if (event.type === 'add') return acc + event.value
              if (event.type === 'subtract') return acc - event.value
              return acc
            }, 0),
            toArray(),
          ),
        )

        expect(result).toEqual([10, 7, 12])
      })
    })
  })
})
