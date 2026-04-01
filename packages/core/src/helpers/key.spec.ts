import { generateId, parsePkSkFromId, sortKeyBaseFromId } from './key'

describe('parsePkSkFromId', () => {
  it('should split type#tenant and sk with extra hashes', () => {
    const pk = 'USER_TENANT#tenant-A'
    const skBase = 'USER_TENANT#item-1'
    const itemId = generateId(pk, skBase)
    expect(parsePkSkFromId(itemId)).toEqual({ pk, skBase })
  })

  it('should return undefined when fewer than 3 segments', () => {
    expect(parsePkSkFromId('ONLY')).toBeUndefined()
    expect(parsePkSkFromId('A#B')).toBeUndefined()
  })

  it('should match sortKeyBaseFromId when pk is known', () => {
    const pk = 'SEQ#tenant-x'
    const skBase = 'FOO#BAR#baz'
    const itemId = generateId(pk, skBase)
    expect(parsePkSkFromId(itemId)?.skBase).toBe(sortKeyBaseFromId(pk, itemId))
  })
})
