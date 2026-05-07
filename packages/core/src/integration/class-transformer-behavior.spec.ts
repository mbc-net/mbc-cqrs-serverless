/**
 * class-transformer Behavioral Tests
 *
 * These tests verify that class-transformer behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 */

import 'reflect-metadata'

import {
  Exclude,
  Expose,
  instanceToPlain,
  plainToInstance,
  Transform,
  Type,
} from 'class-transformer'

describe('class-transformer Behavioral Tests', () => {
  describe('plainToInstance basic behavior', () => {
    class SimpleClass {
      name: string
      value: number
    }

    it('should convert plain object to class instance', () => {
      const plain = { name: 'test', value: 42 }
      const instance = plainToInstance(SimpleClass, plain)

      expect(instance).toBeInstanceOf(SimpleClass)
      expect(instance.name).toBe('test')
      expect(instance.value).toBe(42)
    })

    it('should handle array of plain objects', () => {
      const plains = [
        { name: 'first', value: 1 },
        { name: 'second', value: 2 },
      ]
      const instances = plainToInstance(SimpleClass, plains)

      expect(Array.isArray(instances)).toBe(true)
      expect(instances).toHaveLength(2)
      expect(instances[0]).toBeInstanceOf(SimpleClass)
      expect(instances[1]).toBeInstanceOf(SimpleClass)
    })

    it('should ignore extra properties not in class', () => {
      const plain = { name: 'test', value: 42, extra: 'ignored' }
      const instance = plainToInstance(SimpleClass, plain)

      expect(instance.name).toBe('test')
      expect((instance as any).extra).toBe('ignored') // Still copied by default
    })

    it('should handle missing properties', () => {
      const plain = { name: 'test' }
      const instance = plainToInstance(SimpleClass, plain)

      expect(instance.name).toBe('test')
      expect(instance.value).toBeUndefined()
    })
  })

  describe('@Expose decorator behavior', () => {
    class ExposeClass {
      @Expose()
      publicField: string

      @Expose({ name: 'alias' })
      aliasedField: string

      hiddenField: string
    }

    it('should expose fields with @Expose when excludeExtraneousValues is true', () => {
      const plain = {
        publicField: 'public',
        aliasedField: 'aliased',
        hiddenField: 'hidden',
      }
      const instance = plainToInstance(ExposeClass, plain, {
        excludeExtraneousValues: true,
      })

      expect(instance.publicField).toBe('public')
      expect(instance.hiddenField).toBeUndefined()
    })

    it('should handle aliased property names', () => {
      const plain = {
        publicField: 'public',
        alias: 'from-alias',
      }
      const instance = plainToInstance(ExposeClass, plain, {
        excludeExtraneousValues: true,
      })

      expect(instance.aliasedField).toBe('from-alias')
    })
  })

  describe('@Exclude decorator behavior', () => {
    class ExcludeClass {
      name: string

      @Exclude()
      password: string

      @Exclude({ toPlainOnly: true })
      internalId: string
    }

    it('should exclude fields with @Exclude in instanceToPlain', () => {
      const instance = plainToInstance(ExcludeClass, {
        name: 'user',
        password: 'secret',
        internalId: 'internal-123',
      })
      const plain = instanceToPlain(instance)

      expect(plain.name).toBe('user')
      expect(plain.password).toBeUndefined()
      expect(plain.internalId).toBeUndefined()
    })

    it('should respect toPlainOnly option', () => {
      const plain = {
        name: 'user',
        password: 'secret',
        internalId: 'internal-123',
      }
      const instance = plainToInstance(ExcludeClass, plain)

      // internalId should be included when transforming TO instance
      expect(instance.internalId).toBe('internal-123')
      // But excluded when transforming TO plain
      expect(instanceToPlain(instance).internalId).toBeUndefined()
    })
  })

  describe('@Transform decorator behavior', () => {
    class TransformClass {
      @Transform(({ value }) => value?.toUpperCase())
      upperName: string

      @Transform(({ value }) => new Date(value))
      createdAt: Date

      @Transform(({ value }) => parseInt(value, 10))
      numericString: number

      @Transform(({ value, obj }) => `${obj.firstName} ${obj.lastName}`)
      fullName: string

      firstName: string
      lastName: string
    }

    it('should apply transformation function', () => {
      const plain = { upperName: 'hello' }
      const instance = plainToInstance(TransformClass, plain)

      expect(instance.upperName).toBe('HELLO')
    })

    it('should transform string to Date', () => {
      const plain = { createdAt: '2024-01-15T10:30:00Z' }
      const instance = plainToInstance(TransformClass, plain)

      expect(instance.createdAt).toBeInstanceOf(Date)
      expect(instance.createdAt.getFullYear()).toBe(2024)
    })

    it('should transform string to number', () => {
      const plain = { numericString: '42' }
      const instance = plainToInstance(TransformClass, plain)

      expect(instance.numericString).toBe(42)
      expect(typeof instance.numericString).toBe('number')
    })

    it('should have access to full object in transform', () => {
      const plain = { firstName: 'John', lastName: 'Doe', fullName: '' }
      const instance = plainToInstance(TransformClass, plain)

      expect(instance.fullName).toBe('John Doe')
    })

    it('should handle null/undefined values in transform', () => {
      const plain = { upperName: null }
      const instance = plainToInstance(TransformClass, plain)

      expect(instance.upperName).toBeUndefined() // null?.toUpperCase() is undefined
    })
  })

  describe('@Type decorator behavior', () => {
    class NestedClass {
      id: number
      name: string
    }

    class ParentClass {
      title: string

      @Type(() => NestedClass)
      nested: NestedClass

      @Type(() => NestedClass)
      nestedArray: NestedClass[]
    }

    it('should transform nested object to class instance', () => {
      const plain = {
        title: 'Parent',
        nested: { id: 1, name: 'Nested' },
      }
      const instance = plainToInstance(ParentClass, plain)

      expect(instance.nested).toBeInstanceOf(NestedClass)
      expect(instance.nested.id).toBe(1)
      expect(instance.nested.name).toBe('Nested')
    })

    it('should transform array of nested objects', () => {
      const plain = {
        title: 'Parent',
        nestedArray: [
          { id: 1, name: 'First' },
          { id: 2, name: 'Second' },
        ],
      }
      const instance = plainToInstance(ParentClass, plain)

      expect(Array.isArray(instance.nestedArray)).toBe(true)
      expect(instance.nestedArray[0]).toBeInstanceOf(NestedClass)
      expect(instance.nestedArray[1]).toBeInstanceOf(NestedClass)
    })

    it('should handle null nested object', () => {
      const plain = {
        title: 'Parent',
        nested: null,
      }
      const instance = plainToInstance(ParentClass, plain)

      expect(instance.nested).toBeNull()
    })

    it('should handle undefined nested object', () => {
      const plain = {
        title: 'Parent',
      }
      const instance = plainToInstance(ParentClass, plain)

      expect(instance.nested).toBeUndefined()
    })
  })

  describe('instanceToPlain behavior', () => {
    class PlainClass {
      name: string
      getValue(): string {
        return this.name.toUpperCase()
      }
    }

    it('should convert instance to plain object', () => {
      const instance = new PlainClass()
      instance.name = 'test'

      const plain = instanceToPlain(instance)

      expect(plain).toEqual({ name: 'test' })
      expect(typeof plain.getValue).toBe('undefined') // Methods are not included
    })

    it('should handle nested instances', () => {
      class Inner {
        value: number
      }

      class Outer {
        @Type(() => Inner)
        inner: Inner
      }

      const outer = new Outer()
      outer.inner = new Inner()
      outer.inner.value = 42

      const plain = instanceToPlain(outer)

      expect(plain).toEqual({ inner: { value: 42 } })
    })
  })

  describe('Options behavior', () => {
    class OptionsClass {
      @Expose({ groups: ['admin'] })
      adminOnly: string

      @Expose({ groups: ['user', 'admin'] })
      userVisible: string

      @Expose()
      public: string
    }

    it('should filter by groups when excludeExtraneousValues is used', () => {
      // Note: groups filtering requires excludeExtraneousValues or specific setup
      const plain = {
        adminOnly: 'secret',
        userVisible: 'shared',
        public: 'open',
      }

      // Transform with user group
      const userInstance = plainToInstance(OptionsClass, plain, {
        groups: ['user'],
        excludeExtraneousValues: true,
      })
      expect(userInstance.adminOnly).toBeUndefined()
      expect(userInstance.userVisible).toBe('shared')
      expect(userInstance.public).toBe('open')

      // Transform with admin group
      const adminInstance = plainToInstance(OptionsClass, plain, {
        groups: ['admin'],
        excludeExtraneousValues: true,
      })
      expect(adminInstance.adminOnly).toBe('secret')
      expect(adminInstance.userVisible).toBe('shared')
      expect(adminInstance.public).toBe('open')
    })

    it('should respect enableCircularCheck option', () => {
      class CircularClass {
        name: string
        @Type(() => CircularClass)
        self?: CircularClass
      }

      const instance = new CircularClass()
      instance.name = 'root'
      instance.self = instance // Circular reference

      // With circular check enabled, should not throw
      expect(() => {
        instanceToPlain(instance, { enableCircularCheck: true })
      }).not.toThrow()
    })
  })

  describe('Version strategy compatibility', () => {
    it('should handle version-based exclusion', () => {
      class VersionedClass {
        @Expose({ since: 1.0, until: 2.0 })
        v1Only: string

        @Expose({ since: 2.0 })
        v2AndLater: string

        @Expose()
        always: string
      }

      const instance = plainToInstance(VersionedClass, {
        v1Only: 'old',
        v2AndLater: 'new',
        always: 'constant',
      })

      const v1Plain = instanceToPlain(instance, { version: 1.5 })
      expect(v1Plain.v1Only).toBe('old')
      expect(v1Plain.v2AndLater).toBeUndefined()

      const v2Plain = instanceToPlain(instance, { version: 2.5 })
      expect(v2Plain.v1Only).toBeUndefined()
      expect(v2Plain.v2AndLater).toBe('new')
    })
  })
})
