import { readFileSync } from 'fs'
import { join } from 'path'

// Read as text: the template's imports only resolve inside a generated application.
describe('template master-rds.handler', () => {
  it('writes systemId on both update and create', () => {
    const src = readFileSync(
      join(__dirname, '../src/templates/master/handler/master-rds.handler.ts'),
      'utf8',
    )
    expect(src.match(/systemId: getSystemId\(cmd\)/g)).toHaveLength(2)
  })
})
