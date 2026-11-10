import {
  getSystemId,
  stripSystemAttribute,
  toPublicRow,
  withSystemAttribute,
} from './system-attribute'

describe('system attribute helpers', () => {
  it('reads the owner from attributes', () => {
    expect(getSystemId({ attributes: { __systemId: 'app-a' } })).toBe('app-a')
  })
  it('returns undefined with no row, no attributes or no key', () => {
    expect(getSystemId()).toBeUndefined()
    expect(getSystemId(null)).toBeUndefined()
    expect(getSystemId({})).toBeUndefined()
    expect(getSystemId({ attributes: null })).toBeUndefined()
    expect(getSystemId({ attributes: 'x' })).toBeUndefined()
    expect(getSystemId({ attributes: { a: 1 } })).toBeUndefined()
    expect(getSystemId({ attributes: { __systemId: 5 } })).toBeUndefined()
  })
  it('removes the reserved key', () => {
    expect(stripSystemAttribute({ a: 1, __systemId: 'x' })).toEqual({ a: 1 })
  })
  it('passes undefined through', () => {
    expect(stripSystemAttribute(undefined)).toBeUndefined()
    expect(stripSystemAttribute(null)).toBeNull()
  })
  it('writes the owner over a client value', () => {
    expect(withSystemAttribute({ a: 1, __systemId: 'x' }, 'app-a')).toEqual({
      a: 1,
      __systemId: 'app-a',
    })
  })
  it('adds no key when the owner is undefined', () => {
    expect(withSystemAttribute({ a: 1 }, undefined)).toEqual({ a: 1 })
  })
  it('moves the owner to the top level and hides the key', () => {
    expect(toPublicRow({ attributes: { a: 1, __systemId: 'app-a' } })).toEqual({
      attributes: { a: 1 },
      systemId: 'app-a',
    })
  })
  it('keeps a value already on the row from the RDS column', () => {
    const row = { systemId: 'app-a', attributes: { a: 1 } }
    expect(toPublicRow(row)).toEqual({ systemId: 'app-a', attributes: { a: 1 } })
  })
  it('returns a row with no owner unchanged', () => {
    const row = { attributes: { a: 1 } }
    expect(toPublicRow(row)).toBe(row)
    const rds = { systemId: null, attributes: { a: 1 } }
    expect(toPublicRow(rds)).toBe(rds)
  })
})
