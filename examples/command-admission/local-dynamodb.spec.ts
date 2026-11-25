import { localClient } from './local-dynamodb'

describe('local-only endpoint guard', () => {
  it.each([
    '',
    'https://localhost:8000',
    'http://example.com:8000',
    'http://127.0.0.1:0',
    'http://127.0.0.1:65536',
    'http://user:password@localhost:8000',
    'http://localhost:8000/path',
    'http://localhost:8000?query',
    'http://localhost:8000#fragment',
    'http://localhost:8000\n',
  ])('rejects %j before creating a client', (endpoint) => {
    expect(() => localClient(endpoint)).toThrow('Expected http://')
  })
  it.each(['http://127.0.0.1:8000', 'http://localhost:18765/'])(
    'accepts %s without making a request',
    (endpoint) => {
      const client = localClient(endpoint)
      client.destroy()
    },
  )
})
