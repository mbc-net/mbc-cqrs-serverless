import { isObject, mergeDeep, objectBytes } from './object'

// jest test for mergeDeep function from ./object.ts file
describe('mergeDeep', () => {
  it('should merge two objects', () => {
    const obj1 = { a: 1, b: 2 }
    const obj2 = { b: 3, c: 4 }
    const result = mergeDeep(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  // test more deeply nested objects
  it('should merge deeply nested objects', () => {
    const obj1 = { a: 1, b: { c: 2, d: 3 } }
    const obj2 = { b: { d: 4, e: 5 } }
    const result = mergeDeep(obj1, obj2)
    expect(result).toEqual({ a: 1, b: { c: 2, d: 4, e: 5 } })
    expect(result.b).toBeInstanceOf(Object)
  })

  // test 3 nested objects
  it('should merge 3 nested objects', () => {
    const obj1 = { a: 1, b: { c: 2, d: 3 } }
    const obj2 = { b: { d: 4, e: 5 } }
    const obj3 = { b: { d: 6, f: 7 } }
    const result = mergeDeep(obj1, obj2, obj3)
    expect(result).toEqual({ a: 1, b: { c: 2, d: 6, e: 5, f: 7 } })
    expect(result.b).toBeInstanceOf(Object)
    expect(result.b.d).toBe(6)
    expect(result.b.e).toBe(5)
    expect(result.b.f).toBe(7)
    expect(result.b.c).toBe(2)
    expect(result.a).toBe(1)
    expect(result.b.d).not.toBe(3)
    expect(result.b.d).not.toBe(4)
    expect(result.b.e).not.toBe(3)
    expect(result.b.f).not.toBe(3)
  })

  it('should return the target object when no sources are provided', () => {
    const target = { a: 1, b: 2 }
    const result = mergeDeep(target)
    expect(result).toEqual(target)
  })

  it('should deep merge two objects', () => {
    const target = { a: { x: 1 }, b: { y: 2 } }
    const source = { a: { y: 3 }, b: { x: 4 } }
    const expected = { a: { x: 1, y: 3 }, b: { y: 2, x: 4 } }
    const result = mergeDeep(target, source)
    expect(result).toEqual(expected)
  })

  it('should deep merge multiple objects', () => {
    const target = { a: { x: 1 }, b: { y: 2 } }
    const source1 = { a: { y: 3 }, b: { x: 4 } }
    const source2 = { a: { z: 5 }, b: { w: 6 } }
    const expected = { a: { x: 1, y: 3, z: 5 }, b: { y: 2, x: 4, w: 6 } }
    const result = mergeDeep(target, source1, source2)
    expect(result).toEqual(expected)
  })

  it('should handle primitive values', () => {
    const target = { a: 1, b: 2 }
    const source = { a: 3, b: 4 }
    const expected = { a: 3, b: 4 }
    const result = mergeDeep(target, source)
    expect(result).toEqual(expected)
  })
})

// test for objectBytes function
describe('objectBytes', () => {
  it('should calculate the object bytes', () => {
    const obj = { a: 1, b: 2 }
    const bytes = objectBytes(obj)
    expect(bytes).toBe(new Blob([JSON.stringify(obj)]).size)
  })

  it('should return the correct byte length for an empty object', () => {
    const obj = {}
    const result = objectBytes(obj)
    expect(result).toBe(2) // empty object "{}" has 2 bytes
  })

  it('should return the correct byte length for an object with properties', () => {
    const obj = { name: 'John', age: 30 }
    const result = objectBytes(obj)
    expect(result).toBe(24) // object with properties has 24 bytes
  })

  it('should return the correct byte length for an object with nested objects', () => {
    const obj = { name: 'John', address: { city: 'New York', country: 'USA' } }
    const result = objectBytes(obj)
    expect(result).toBe(61) // object with nested objects has 61 bytes
  })
})

// test for isObject function
describe('isObject', () => {
  it('should check if an object is an object', () => {
    expect(isObject({ a: 1, b: 2 })).toBe(true)
    expect(isObject(new Date())).toBe(true)
    expect(isObject(new Error())).toBe(true)
    expect(isObject(new RegExp(''))).toBe(true)
  })

  // check not an object
  it('should check if an object is not an object', () => {
    expect(isObject('hello')).toBe(false)
    expect(isObject(123)).toBe(false)
    expect(isObject(true)).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject([])).toBe(false)
    expect(isObject(Symbol('foo'))).toBe(false)
    expect(isObject(function () {})).toBe(false)
    expect(isObject(async function () {})).toBe(false)
    expect(isObject(async () => {})).toBe(false)
    expect(isObject(function* () {})).toBe(false)
    expect(isObject(class A {})).toBe(false)
    expect(
      isObject(
        class B {
          a = 1
        },
      ),
    ).toBe(false)
    class A {}
    expect(isObject(class C extends A {})).toBe(false)
  })
})
