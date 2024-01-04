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
})

// test for objectBytes function
describe('objectBytes', () => {
  it('should calculate the object bytes', () => {
    const obj = { a: 1, b: 2 }
    const bytes = objectBytes(obj)
    expect(bytes).toBe(18)
  })
})

// test for isObject function
describe('isObject', () => {
  it('should check if an object is an object', () => {
    const obj = { a: 1, b: 2 }
    expect(isObject(obj)).toBe(true)
  })

  // check not an object
  it('should check if an object is not an object', () => {
    const obj = 'hello'
    expect(isObject(obj)).toBe(false)
    expect(isObject(123)).toBe(false)
    expect(isObject(true)).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject([])).toBe(false)
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject(new Date())).toBe(true)
    expect(isObject(new Error())).toBe(true)
    expect(isObject(new RegExp(''))).toBe(true)
    expect(isObject(Symbol('foo'))).toBe(true)
    expect(isObject(function () {})).toBe(true)
    expect(isObject(async function () {})).toBe(true)
    expect(isObject(async () => {})).toBe(true)
    expect(isObject(function* () {})).toBe(true)
    expect(isObject(class A {})).toBe(true)
    expect(
      isObject(
        class B {
          a = 1
        },
      ),
    ).toBe(true)
    class A {}
    expect(isObject(class C extends A {})).toBe(true)
  })
})
