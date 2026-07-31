import { generateId, parseTwoSegmentPkSkFromId, sortKeyBaseFromId } from './key'

describe('parseTwoSegmentPkSkFromId', () => {
  it('should split type#tenant and sk with extra hashes', () => {
    const pk = 'USER_TENANT#tenant-A'
    const skBase = 'USER_TENANT#item-1'
    const itemId = generateId(pk, skBase)
    expect(parseTwoSegmentPkSkFromId(itemId)).toEqual({ pk, skBase })
  })

  it('should return undefined when fewer than 3 segments', () => {
    expect(parseTwoSegmentPkSkFromId('ONLY')).toBeUndefined()
    expect(parseTwoSegmentPkSkFromId('A#B')).toBeUndefined()
  })

  it('should match sortKeyBaseFromId when pk is known', () => {
    const pk = 'SEQ#tenant-x'
    const skBase = 'FOO#BAR#baz'
    const itemId = generateId(pk, skBase)
    expect(parseTwoSegmentPkSkFromId(itemId)?.skBase).toBe(
      sortKeyBaseFromId(pk, itemId),
    )
  })
})
