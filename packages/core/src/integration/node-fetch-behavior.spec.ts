/**
 * node-fetch Behavioral Tests
 *
 * These tests verify node-fetch behaviors that are critical
 * for the framework's AppSync and external API communication.
 *
 * NOTE: These tests require external network access to httpbin.org
 * They may be flaky in CI environments due to network issues.
 * Consider running with --testPathIgnorePatterns when network is unavailable.
 */

import fetch, { Response, Headers, Request, FetchError } from 'node-fetch'

// Module export tests (no network required)
describe('node-fetch Module Exports', () => {
  it('should export fetch as default', () => {
    expect(typeof fetch).toBe('function')
  })

  it('should export Response class', () => {
    expect(typeof Response).toBe('function')
  })

  it('should export Headers class', () => {
    expect(typeof Headers).toBe('function')
  })

  it('should export Request class', () => {
    expect(typeof Request).toBe('function')
  })

  it('should export FetchError class', () => {
    expect(typeof FetchError).toBe('function')
  })

  it('should create Headers instance with object', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Custom': 'value',
    })

    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-custom')).toBe('value')
  })

  it('should support Headers iteration', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Accept': 'text/plain',
    })

    const keys: string[] = []
    headers.forEach((value, key) => {
      keys.push(key)
    })

    expect(keys).toContain('content-type')
    expect(keys).toContain('accept')
  })

  it('should create Request instance', () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(request.url).toBe('https://example.com/api')
    expect(request.method).toBe('POST')
  })
})

// Network-dependent tests are SKIPPED by default due to external service reliability issues
// To run these tests locally, set RUN_NETWORK_TESTS=true
const describeOrSkip =
  process.env.RUN_NETWORK_TESTS === 'true' ? describe : describe.skip

describeOrSkip('node-fetch Network Behavioral Tests', () => {
  // Use httpbin.org for testing HTTP behaviors
  const TEST_URL = 'https://httpbin.org'

  // Increase timeout for network tests
  jest.setTimeout(30000)

  describe('Response object structure', () => {
    it('should have expected Response properties', async () => {
      const response = await fetch(`${TEST_URL}/get`)

      expect(response).toBeInstanceOf(Response)
      expect(typeof response.ok).toBe('boolean')
      expect(typeof response.status).toBe('number')
      expect(typeof response.statusText).toBe('string')
      expect(typeof response.url).toBe('string')
      expect(response.headers).toBeInstanceOf(Headers)
    })

    it('should have body consumption methods', async () => {
      const response = await fetch(`${TEST_URL}/get`)

      expect(typeof response.json).toBe('function')
      expect(typeof response.text).toBe('function')
      expect(typeof response.buffer).toBe('function')
      expect(typeof response.arrayBuffer).toBe('function')
    })

    it('should only allow body to be consumed once', async () => {
      const response = await fetch(`${TEST_URL}/get`)

      await response.json()

      // Second consumption should fail
      await expect(response.json()).rejects.toThrow()
    })

    it('should track if body was used', async () => {
      const response = await fetch(`${TEST_URL}/get`)

      expect(response.bodyUsed).toBe(false)

      await response.json()

      expect(response.bodyUsed).toBe(true)
    })
  })

  describe('HTTP status codes', () => {
    it('should handle 200 OK', async () => {
      const response = await fetch(`${TEST_URL}/status/200`)

      expect(response.status).toBe(200)
      expect(response.ok).toBe(true)
    })

    it('should handle 201 Created', async () => {
      const response = await fetch(`${TEST_URL}/status/201`)

      expect(response.status).toBe(201)
      expect(response.ok).toBe(true)
    })

    it('should handle 204 No Content', async () => {
      const response = await fetch(`${TEST_URL}/status/204`)

      expect(response.status).toBe(204)
      expect(response.ok).toBe(true)
    })

    it('should handle 400 Bad Request (ok = false)', async () => {
      const response = await fetch(`${TEST_URL}/status/400`)

      expect(response.status).toBe(400)
      expect(response.ok).toBe(false)
    })

    it('should handle 401 Unauthorized (ok = false)', async () => {
      const response = await fetch(`${TEST_URL}/status/401`)

      expect(response.status).toBe(401)
      expect(response.ok).toBe(false)
    })

    it('should handle 403 Forbidden (ok = false)', async () => {
      const response = await fetch(`${TEST_URL}/status/403`)

      expect(response.status).toBe(403)
      expect(response.ok).toBe(false)
    })

    it('should handle 404 Not Found (ok = false)', async () => {
      const response = await fetch(`${TEST_URL}/status/404`)

      expect(response.status).toBe(404)
      expect(response.ok).toBe(false)
    })

    it('should handle 500 Internal Server Error (ok = false)', async () => {
      const response = await fetch(`${TEST_URL}/status/500`)

      expect(response.status).toBe(500)
      expect(response.ok).toBe(false)
    })

    it('should NOT throw for error status codes', async () => {
      // fetch does NOT throw for HTTP errors
      const response = await fetch(`${TEST_URL}/status/500`)

      expect(response.status).toBe(500)
    })
  })

  describe('JSON parsing', () => {
    it('should parse valid JSON response', async () => {
      const response = await fetch(`${TEST_URL}/json`)
      const data = await response.json()

      expect(typeof data).toBe('object')
      expect(data).not.toBeNull()
    })

    it('should throw when parsing non-JSON as JSON', async () => {
      const response = await fetch(`${TEST_URL}/html`)

      await expect(response.json()).rejects.toThrow()
    })

    it('should handle empty response body', async () => {
      const response = await fetch(`${TEST_URL}/status/204`)

      // 204 has no body, json() should fail
      await expect(response.json()).rejects.toThrow()
    })
  })

  describe('Headers handling', () => {
    it('should send custom headers', async () => {
      const response = await fetch(`${TEST_URL}/headers`, {
        headers: {
          'X-Custom-Header': 'custom-value',
          'Content-Type': 'application/json',
        },
      })
      const data = await response.json()

      expect(data.headers['X-Custom-Header']).toBe('custom-value')
    })

    it('should read response headers', async () => {
      const response = await fetch(`${TEST_URL}/response-headers?X-Test=test-value`)

      expect(response.headers.get('X-Test')).toBe('test-value')
    })

    it('should handle case-insensitive header names', async () => {
      const response = await fetch(`${TEST_URL}/get`)

      // Headers are case-insensitive
      const contentType1 = response.headers.get('content-type')
      const contentType2 = response.headers.get('Content-Type')
      const contentType3 = response.headers.get('CONTENT-TYPE')

      expect(contentType1).toBe(contentType2)
      expect(contentType2).toBe(contentType3)
    })

    it('should support Headers class', async () => {
      const headers = new Headers()
      headers.append('X-Test', 'value1')
      headers.append('X-Test', 'value2')

      const response = await fetch(`${TEST_URL}/headers`, { headers })
      const data = await response.json()

      // Multiple values are comma-separated
      expect(data.headers['X-Test']).toContain('value1')
    })
  })

  describe('Request methods', () => {
    it('should make GET request by default', async () => {
      const response = await fetch(`${TEST_URL}/get`)
      const data = await response.json()

      expect(data.url).toContain('/get')
    })

    it('should make POST request with body', async () => {
      const response = await fetch(`${TEST_URL}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      })
      const data = await response.json()

      expect(data.json).toEqual({ key: 'value' })
    })

    it('should make PUT request', async () => {
      const response = await fetch(`${TEST_URL}/put`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updated: true }),
      })

      expect(response.status).toBe(200)
    })

    it('should make DELETE request', async () => {
      const response = await fetch(`${TEST_URL}/delete`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(200)
    })

    it('should make PATCH request', async () => {
      const response = await fetch(`${TEST_URL}/patch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patched: true }),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Request class', () => {
    it('should create Request object', () => {
      const request = new Request(`${TEST_URL}/get`, {
        method: 'GET',
        headers: { 'X-Custom': 'value' },
      })

      expect(request.url).toBe(`${TEST_URL}/get`)
      expect(request.method).toBe('GET')
      expect(request.headers.get('X-Custom')).toBe('value')
    })

    it('should use Request object in fetch', async () => {
      const request = new Request(`${TEST_URL}/get`)
      const response = await fetch(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Timeout and abort', () => {
    it('should respect timeout option', async () => {
      // Request to endpoint that delays response
      await expect(
        fetch(`${TEST_URL}/delay/5`, { timeout: 100 }),
      ).rejects.toThrow()
    }, 10000)

    it('should throw FetchError on timeout', async () => {
      try {
        await fetch(`${TEST_URL}/delay/5`, { timeout: 100 })
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError)
        expect((error as FetchError).type).toBe('request-timeout')
      }
    }, 10000)
  })

  describe('Redirects', () => {
    it('should follow redirects by default', async () => {
      const response = await fetch(`${TEST_URL}/redirect/1`)

      expect(response.status).toBe(200)
      expect(response.url).toContain('/get')
    })

    it('should respect redirect: manual option', async () => {
      const response = await fetch(`${TEST_URL}/redirect/1`, {
        redirect: 'manual',
      })

      expect(response.status).toBe(302)
    })

    it('should throw on redirect: error option', async () => {
      await expect(
        fetch(`${TEST_URL}/redirect/1`, { redirect: 'error' }),
      ).rejects.toThrow()
    })
  })

  describe('Network errors', () => {
    it('should throw FetchError for invalid URL', async () => {
      await expect(fetch('http://invalid.invalid.invalid')).rejects.toThrow()
    })

    it('should throw FetchError for connection refused', async () => {
      await expect(fetch('http://localhost:59999')).rejects.toThrow()
    })

    it('FetchError should have type property', async () => {
      try {
        await fetch('http://invalid.invalid.invalid')
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError)
        expect((error as FetchError).type).toBeDefined()
      }
    })
  })

  describe('Response body types', () => {
    it('should get response as text', async () => {
      const response = await fetch(`${TEST_URL}/get`)
      const text = await response.text()

      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
    })

    it('should get response as buffer', async () => {
      const response = await fetch(`${TEST_URL}/bytes/100`)
      const buffer = await response.buffer()

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBe(100)
    })

    it('should get response as ArrayBuffer', async () => {
      const response = await fetch(`${TEST_URL}/bytes/100`)
      const arrayBuffer = await response.arrayBuffer()

      expect(arrayBuffer).toBeInstanceOf(ArrayBuffer)
      expect(arrayBuffer.byteLength).toBe(100)
    })
  })

  describe('Content-Type handling', () => {
    it('should auto-set Content-Type for JSON body', async () => {
      const response = await fetch(`${TEST_URL}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
      const data = await response.json()

      expect(data.headers['Content-Type']).toContain('application/json')
    })

    it('should handle form-urlencoded', async () => {
      const params = new URLSearchParams()
      params.append('field1', 'value1')
      params.append('field2', 'value2')

      const response = await fetch(`${TEST_URL}/post`, {
        method: 'POST',
        body: params,
      })
      const data = await response.json()

      expect(data.form.field1).toBe('value1')
      expect(data.form.field2).toBe('value2')
    })
  })

  describe('Clone behavior', () => {
    it('should clone response for multiple body reads', async () => {
      const response = await fetch(`${TEST_URL}/get`)
      const clone = response.clone()

      const json1 = await response.json()
      const json2 = await clone.json()

      expect(json1).toEqual(json2)
    })

    it('should not affect original when reading clone', async () => {
      const response = await fetch(`${TEST_URL}/get`)
      const clone = response.clone()

      await clone.json()

      expect(response.bodyUsed).toBe(false)
    })
  })

  describe('Use case: AppSync GraphQL request', () => {
    it('should format GraphQL request correctly', async () => {
      const graphqlQuery = {
        query: '{ __typename }',
        variables: {},
      }

      const response = await fetch(`${TEST_URL}/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphqlQuery),
      })

      const data = await response.json()
      expect(data.json.query).toBe('{ __typename }')
    })

    it('should handle signed request headers', async () => {
      const signedHeaders = {
        'Content-Type': 'application/json',
        Authorization: 'AWS4-HMAC-SHA256 Credential=...',
        'X-Amz-Date': '20240115T120000Z',
      }

      const response = await fetch(`${TEST_URL}/headers`, {
        method: 'POST',
        headers: signedHeaders,
        body: JSON.stringify({ query: 'test' }),
      })

      const data = await response.json()
      expect(data.headers['Authorization']).toContain('AWS4-HMAC-SHA256')
      expect(data.headers['X-Amz-Date']).toBe('20240115T120000Z')
    })
  })
})
