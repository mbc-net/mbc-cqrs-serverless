import { CommandModel, DataModel } from '../interfaces'
import { transformCommandToData } from './transform'

const makeCmd = (overrides: Partial<CommandModel> = {}): CommandModel => ({
  pk: 'USER#tenant-A',
  sk: 'USER#item-1@3',
  id: 'USER#tenant-A#USER#item-1',
  code: 'USER#item-1',
  name: 'item-1',
  version: 3,
  tenantCode: 'tenant-A',
  type: 'USER',
  isDeleted: false,
  attributes: { role: 'admin' },
  createdAt: new Date('2024-01-03'),
  updatedAt: new Date('2024-01-04'),
  createdBy: 'user-new',
  updatedBy: 'user-new',
  createdIp: '10.0.0.2',
  updatedIp: '10.0.0.2',
  ...overrides,
})

const makeExisting = (overrides: Partial<DataModel> = {}): DataModel => ({
  pk: 'USER#tenant-A',
  sk: 'USER#item-1',
  id: 'USER#tenant-A#USER#item-1',
  code: 'USER#item-1',
  name: 'item-1',
  version: 2,
  tenantCode: 'tenant-A',
  type: 'USER',
  attributes: { role: 'viewer' },
  cpk: 'USER#tenant-A',
  csk: 'USER#item-1@2',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  createdBy: 'user-original',
  updatedBy: 'user-original',
  createdIp: '10.0.0.1',
  updatedIp: '10.0.0.1',
  ...overrides,
})

describe('transformCommandToData', () => {
  it('should map all command fields correctly', () => {
    const cmd = makeCmd()
    const result = transformCommandToData(cmd)

    expect(result.pk).toBe('USER#tenant-A')
    expect(result.sk).toBe('USER#item-1')
    expect(result.version).toBe(3)
    expect(result.csk).toBe('USER#item-1@3')
    expect(result.attributes).toEqual({ role: 'admin' })
  })

  it('should preserve createdAt/createdBy/createdIp from existing', () => {
    const cmd = makeCmd()
    const existing = makeExisting()
    const result = transformCommandToData(cmd, existing)

    expect(result.createdAt).toEqual(new Date('2024-01-01'))
    expect(result.createdBy).toBe('user-original')
    expect(result.createdIp).toBe('10.0.0.1')
  })

  it('should use command createdAt/createdBy/createdIp when no existing', () => {
    const cmd = makeCmd()
    const result = transformCommandToData(cmd)

    expect(result.createdAt).toEqual(new Date('2024-01-03'))
    expect(result.createdBy).toBe('user-new')
    expect(result.createdIp).toBe('10.0.0.2')
  })

  it('should always use command updatedAt/updatedBy/updatedIp', () => {
    const cmd = makeCmd()
    const existing = makeExisting()
    const result = transformCommandToData(cmd, existing)

    expect(result.updatedAt).toEqual(new Date('2024-01-04'))
    expect(result.updatedBy).toBe('user-new')
    expect(result.updatedIp).toBe('10.0.0.2')
  })

  it('should reflect isDeleted from command', () => {
    const cmd = makeCmd({ isDeleted: true })
    const result = transformCommandToData(cmd)
    expect(result.isDeleted).toBe(true)
  })
})
