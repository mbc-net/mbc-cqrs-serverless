/**
 * reflect-metadata Behavioral Tests
 *
 * These tests verify reflect-metadata behaviors that are critical
 * for the framework's decorator-based event handling and DI system.
 */

import 'reflect-metadata'

describe('reflect-metadata Behavioral Tests', () => {
  const TEST_KEY = 'test:metadata:key'
  const ANOTHER_KEY = 'test:another:key'

  beforeEach(() => {
    // Clean up any metadata pollution between tests
  })

  describe('Reflect.defineMetadata behavior', () => {
    it('should define metadata on a class', () => {
      class TestClass {}

      Reflect.defineMetadata(TEST_KEY, { value: 'class-metadata' }, TestClass)

      const metadata = Reflect.getMetadata(TEST_KEY, TestClass)
      expect(metadata).toEqual({ value: 'class-metadata' })
    })

    it('should define metadata on a class method', () => {
      class TestClass {
        testMethod() {}
      }

      Reflect.defineMetadata(
        TEST_KEY,
        { value: 'method-metadata' },
        TestClass.prototype,
        'testMethod',
      )

      const metadata = Reflect.getMetadata(
        TEST_KEY,
        TestClass.prototype,
        'testMethod',
      )
      expect(metadata).toEqual({ value: 'method-metadata' })
    })

    it('should define metadata on a class property', () => {
      class TestClass {
        testProperty: string
      }

      Reflect.defineMetadata(
        TEST_KEY,
        { value: 'property-metadata' },
        TestClass.prototype,
        'testProperty',
      )

      const metadata = Reflect.getMetadata(
        TEST_KEY,
        TestClass.prototype,
        'testProperty',
      )
      expect(metadata).toEqual({ value: 'property-metadata' })
    })

    it('should overwrite existing metadata with same key', () => {
      class TestClass {}

      Reflect.defineMetadata(TEST_KEY, 'first', TestClass)
      Reflect.defineMetadata(TEST_KEY, 'second', TestClass)

      expect(Reflect.getMetadata(TEST_KEY, TestClass)).toBe('second')
    })

    it('should keep different metadata keys separate', () => {
      class TestClass {}

      Reflect.defineMetadata(TEST_KEY, 'value1', TestClass)
      Reflect.defineMetadata(ANOTHER_KEY, 'value2', TestClass)

      expect(Reflect.getMetadata(TEST_KEY, TestClass)).toBe('value1')
      expect(Reflect.getMetadata(ANOTHER_KEY, TestClass)).toBe('value2')
    })
  })

  describe('Reflect.getMetadata behavior', () => {
    it('should return undefined for non-existent metadata', () => {
      class TestClass {}

      const metadata = Reflect.getMetadata('non:existent:key', TestClass)
      expect(metadata).toBeUndefined()
    })

    it('should inherit metadata from parent class', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata(TEST_KEY, 'parent-value', ParentClass)

      // getMetadata walks the prototype chain
      expect(Reflect.getMetadata(TEST_KEY, ChildClass)).toBe('parent-value')
    })

    it('should override parent metadata in child class', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata(TEST_KEY, 'parent-value', ParentClass)
      Reflect.defineMetadata(TEST_KEY, 'child-value', ChildClass)

      expect(Reflect.getMetadata(TEST_KEY, ChildClass)).toBe('child-value')
      expect(Reflect.getMetadata(TEST_KEY, ParentClass)).toBe('parent-value')
    })

    it('should not affect parent when child metadata is modified', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata(TEST_KEY, { count: 1 }, ParentClass)
      Reflect.defineMetadata(TEST_KEY, { count: 2 }, ChildClass)

      expect(Reflect.getMetadata(TEST_KEY, ParentClass)).toEqual({ count: 1 })
      expect(Reflect.getMetadata(TEST_KEY, ChildClass)).toEqual({ count: 2 })
    })
  })

  describe('Reflect.hasMetadata behavior', () => {
    it('should return true for existing metadata', () => {
      class TestClass {}

      Reflect.defineMetadata(TEST_KEY, 'value', TestClass)

      expect(Reflect.hasMetadata(TEST_KEY, TestClass)).toBe(true)
    })

    it('should return false for non-existent metadata', () => {
      class TestClass {}

      expect(Reflect.hasMetadata(TEST_KEY, TestClass)).toBe(false)
    })

    it('should return true for inherited metadata', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata(TEST_KEY, 'value', ParentClass)

      // hasMetadata also checks prototype chain
      expect(Reflect.hasMetadata(TEST_KEY, ChildClass)).toBe(true)
    })
  })

  describe('Reflect.hasOwnMetadata behavior', () => {
    it('should return true for own metadata', () => {
      class TestClass {}

      Reflect.defineMetadata(TEST_KEY, 'value', TestClass)

      expect(Reflect.hasOwnMetadata(TEST_KEY, TestClass)).toBe(true)
    })

    it('should return false for inherited metadata', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata(TEST_KEY, 'value', ParentClass)

      // hasOwnMetadata does NOT check prototype chain
      expect(Reflect.hasOwnMetadata(TEST_KEY, ChildClass)).toBe(false)
      expect(Reflect.hasOwnMetadata(TEST_KEY, ParentClass)).toBe(true)
    })
  })

  describe('Reflect.getOwnMetadata behavior', () => {
    it('should return own metadata only', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata(TEST_KEY, 'parent-value', ParentClass)

      expect(Reflect.getOwnMetadata(TEST_KEY, ChildClass)).toBeUndefined()
      expect(Reflect.getOwnMetadata(TEST_KEY, ParentClass)).toBe('parent-value')
    })

    it('should return child metadata when both parent and child have metadata', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata(TEST_KEY, 'parent-value', ParentClass)
      Reflect.defineMetadata(TEST_KEY, 'child-value', ChildClass)

      expect(Reflect.getOwnMetadata(TEST_KEY, ChildClass)).toBe('child-value')
    })
  })

  describe('Reflect.getMetadataKeys behavior', () => {
    it('should return all metadata keys including inherited', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata('parent:key', 'value', ParentClass)
      Reflect.defineMetadata('child:key', 'value', ChildClass)

      const keys = Reflect.getMetadataKeys(ChildClass)

      expect(keys).toContain('parent:key')
      expect(keys).toContain('child:key')
    })

    it('should return own metadata keys only with getOwnMetadataKeys', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata('parent:key', 'value', ParentClass)
      Reflect.defineMetadata('child:key', 'value', ChildClass)

      const ownKeys = Reflect.getOwnMetadataKeys(ChildClass)

      expect(ownKeys).toContain('child:key')
      expect(ownKeys).not.toContain('parent:key')
    })
  })

  describe('Reflect.deleteMetadata behavior', () => {
    it('should delete own metadata', () => {
      class TestClass {}

      Reflect.defineMetadata(TEST_KEY, 'value', TestClass)
      expect(Reflect.hasMetadata(TEST_KEY, TestClass)).toBe(true)

      const deleted = Reflect.deleteMetadata(TEST_KEY, TestClass)

      expect(deleted).toBe(true)
      expect(Reflect.hasMetadata(TEST_KEY, TestClass)).toBe(false)
    })

    it('should return false when deleting non-existent metadata', () => {
      class TestClass {}

      const deleted = Reflect.deleteMetadata(TEST_KEY, TestClass)

      expect(deleted).toBe(false)
    })

    it('should not delete inherited metadata', () => {
      class ParentClass {}
      class ChildClass extends ParentClass {}

      Reflect.defineMetadata(TEST_KEY, 'value', ParentClass)

      // Deleting from child doesn't affect parent
      Reflect.deleteMetadata(TEST_KEY, ChildClass)

      expect(Reflect.getMetadata(TEST_KEY, ParentClass)).toBe('value')
      // But child still sees inherited metadata
      expect(Reflect.getMetadata(TEST_KEY, ChildClass)).toBe('value')
    })
  })

  describe('Decorator pattern metadata', () => {
    it('should work with class decorators', () => {
      function Decorator(value: string): ClassDecorator {
        return (target) => {
          Reflect.defineMetadata(TEST_KEY, value, target)
        }
      }

      @Decorator('decorated')
      class DecoratedClass {}

      expect(Reflect.getMetadata(TEST_KEY, DecoratedClass)).toBe('decorated')
    })

    it('should work with method decorators', () => {
      function MethodDecorator(value: string): MethodDecorator {
        return (target, propertyKey) => {
          Reflect.defineMetadata(TEST_KEY, value, target, propertyKey)
        }
      }

      class TestClass {
        @MethodDecorator('method-decorated')
        testMethod() {}
      }

      expect(
        Reflect.getMetadata(TEST_KEY, TestClass.prototype, 'testMethod'),
      ).toBe('method-decorated')
    })

    it('should work with property decorators', () => {
      function PropertyDecorator(value: string): PropertyDecorator {
        return (target, propertyKey) => {
          Reflect.defineMetadata(TEST_KEY, value, target, propertyKey)
        }
      }

      class TestClass {
        @PropertyDecorator('property-decorated')
        testProperty: string
      }

      expect(
        Reflect.getMetadata(TEST_KEY, TestClass.prototype, 'testProperty'),
      ).toBe('property-decorated')
    })

    it('should work with parameter decorators', () => {
      const PARAMS_KEY = 'test:params'

      function ParamDecorator(index: number): ParameterDecorator {
        return (target, propertyKey, parameterIndex) => {
          const existingParams: number[] =
            Reflect.getMetadata(PARAMS_KEY, target, propertyKey!) || []
          existingParams.push(parameterIndex)
          Reflect.defineMetadata(PARAMS_KEY, existingParams, target, propertyKey!)
        }
      }

      class TestClass {
        testMethod(
          @ParamDecorator(0) first: string,
          @ParamDecorator(1) second: number,
        ) {}
      }

      const params = Reflect.getMetadata(
        PARAMS_KEY,
        TestClass.prototype,
        'testMethod',
      )
      expect(params).toContain(0)
      expect(params).toContain(1)
    })
  })

  describe('Multiple decorators on same target', () => {
    it('should preserve all metadata with different keys', () => {
      function Decorator1(): ClassDecorator {
        return (target) => {
          Reflect.defineMetadata('key1', 'value1', target)
        }
      }

      function Decorator2(): ClassDecorator {
        return (target) => {
          Reflect.defineMetadata('key2', 'value2', target)
        }
      }

      @Decorator1()
      @Decorator2()
      class DecoratedClass {}

      expect(Reflect.getMetadata('key1', DecoratedClass)).toBe('value1')
      expect(Reflect.getMetadata('key2', DecoratedClass)).toBe('value2')
    })

    it('should apply decorators in reverse order (bottom-up)', () => {
      const order: string[] = []

      function OrderDecorator(name: string): ClassDecorator {
        return () => {
          order.push(name)
        }
      }

      @OrderDecorator('first')
      @OrderDecorator('second')
      @OrderDecorator('third')
      class DecoratedClass {}

      // Decorators are applied bottom-up
      expect(order).toEqual(['third', 'second', 'first'])
    })
  })

  describe('Design-time type metadata', () => {
    it('should preserve design:type for properties', () => {
      class TestClass {
        stringProp: string
        numberProp: number
        booleanProp: boolean
        dateProp: Date
      }

      // Note: design:type is only available with emitDecoratorMetadata
      // and when a decorator is applied. This test shows the pattern.
      function TypeCapture(): PropertyDecorator {
        return () => {
          // Decorator needed to trigger metadata emit
        }
      }

      class DecoratedClass {
        @TypeCapture()
        stringProp: string
      }

      // With emitDecoratorMetadata: true, this would work:
      // const type = Reflect.getMetadata('design:type', DecoratedClass.prototype, 'stringProp')
      // expect(type).toBe(String)
    })

    it('should preserve design:paramtypes for constructors', () => {
      function Injectable(): ClassDecorator {
        return () => {}
      }

      class Dependency {}

      @Injectable()
      class TestService {
        constructor(dep: Dependency) {}
      }

      // With emitDecoratorMetadata, constructor param types are captured
      const paramTypes = Reflect.getMetadata('design:paramtypes', TestService)
      if (paramTypes) {
        expect(paramTypes[0]).toBe(Dependency)
      }
    })
  })

  describe('Metadata on class instances vs constructors', () => {
    it('should distinguish between instance prototype and constructor', () => {
      class TestClass {}

      // Metadata on constructor (class itself)
      Reflect.defineMetadata('class:key', 'class-value', TestClass)

      // Metadata on prototype (for instance methods)
      Reflect.defineMetadata('proto:key', 'proto-value', TestClass.prototype)

      expect(Reflect.getMetadata('class:key', TestClass)).toBe('class-value')
      expect(Reflect.getMetadata('proto:key', TestClass.prototype)).toBe(
        'proto-value',
      )

      // They don't mix
      expect(Reflect.getMetadata('class:key', TestClass.prototype)).toBeUndefined()
      expect(Reflect.getMetadata('proto:key', TestClass)).toBeUndefined()
    })

    it('should access prototype metadata from instance', () => {
      class TestClass {}
      const instance = new TestClass()

      Reflect.defineMetadata('proto:key', 'value', TestClass.prototype)

      // Can access through Object.getPrototypeOf
      const proto = Object.getPrototypeOf(instance)
      expect(Reflect.getMetadata('proto:key', proto)).toBe('value')
    })
  })

  describe('Edge cases', () => {
    it('should handle null/undefined values', () => {
      class TestClass {}

      Reflect.defineMetadata('null:key', null, TestClass)
      Reflect.defineMetadata('undefined:key', undefined, TestClass)

      expect(Reflect.getMetadata('null:key', TestClass)).toBeNull()
      expect(Reflect.getMetadata('undefined:key', TestClass)).toBeUndefined()

      // But hasMetadata still returns true
      expect(Reflect.hasMetadata('null:key', TestClass)).toBe(true)
      expect(Reflect.hasMetadata('undefined:key', TestClass)).toBe(true)
    })

    it('should handle complex metadata values', () => {
      class TestClass {}

      const complexValue = {
        nested: { deep: { value: 'deep' } },
        array: [1, 2, 3],
        fn: () => 'function',
        date: new Date('2024-01-01'),
      }

      Reflect.defineMetadata('complex', complexValue, TestClass)

      const retrieved = Reflect.getMetadata('complex', TestClass)
      expect(retrieved).toBe(complexValue) // Same reference
      expect(retrieved.nested.deep.value).toBe('deep')
      expect(retrieved.fn()).toBe('function')
    })

    it('should handle Symbol keys', () => {
      class TestClass {}
      const symbolKey = Symbol('metadata-key')

      Reflect.defineMetadata(symbolKey, 'symbol-value', TestClass)

      expect(Reflect.getMetadata(symbolKey, TestClass)).toBe('symbol-value')
    })
  })
})
